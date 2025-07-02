package cmd

import (
	"fmt"
	"net"
	"os"

	"github.com/kubewall/kubewall/backend/config"
	"github.com/kubewall/kubewall/backend/container"
	"github.com/kubewall/kubewall/backend/routes"
	"github.com/labstack/echo/v4"
	"github.com/labstack/echo/v4/middleware"
	"github.com/pkg/browser"
	"github.com/spf13/cobra"
)

func init() {
	rootCmd.PersistentFlags().String("certFile", "", "absolute path to certificate file")
	rootCmd.PersistentFlags().String("keyFile", "", "absolute path to key file")
	rootCmd.PersistentFlags().StringP("port", "p", ":7080", "port to listen on [deprecated, use --listen instead]")
	rootCmd.PersistentFlags().StringP("listen", "l", "localhost:7080", "IP and port to listen on (e.g., localhost:7080 or :7080)")
	rootCmd.PersistentFlags().Int("k8s-client-qps", 100, "maximum QPS to the master from client")
	rootCmd.PersistentFlags().Int("k8s-client-burst", 200, "Maximum burst for throttle")
	rootCmd.PersistentFlags().Bool("no-open-browser", false, "Do not open the default browser")
}

var rootCmd = &cobra.Command{
	Use:   "kubewall",
	Short: "kubewall",
	Long:  `kubewall is a single binary web app to manage multiple clusters https://github.com/kubewall/kubewall`,
	RunE: func(cmd *cobra.Command, args []string) error {
		return Serve(cmd)
	},
}

func Execute() {
	if err := rootCmd.Execute(); err != nil {
		fmt.Println(err)
		os.Exit(1)
	}
}

func Serve(cmd *cobra.Command) error {
	env := config.NewEnv()

	k8sClientQPS, err := cmd.Flags().GetInt("k8s-client-qps")
	if err != nil {
		return err
	}
	k9sClientBurst, err := cmd.Flags().GetInt("k8s-client-burst")
	if err != nil {
		return err
	}
	// Determine listen address
	listenAddr, err := cmd.Flags().GetString("listen")
	if err != nil {
		return err
	}
	// Backward compatibility: fallback to --port if --listen is not set
	if listenAddr == "" {
		port, err := cmd.Flags().GetString("port")
		if err != nil {
			return err
		}
		if port == "" {
			listenAddr = "localhost:7080" // default
		} else if port[0] == ':' {
			listenAddr = "localhost" + port
		} else {
			listenAddr = "localhost:" + port
		}
	}
	certFile, err := cmd.Flags().GetString("certFile")
	if err != nil {
		return err
	}
	keyFile, err := cmd.Flags().GetString("keyFile")
	if err != nil {
		return err
	}
	noOpen, err := cmd.Flags().GetBool("no-open-browser")
	if err != nil {
		return err
	}

	isSecure := certFile != "" || keyFile != ""

	cfg := config.NewAppConfig(Version, listenAddr, k8sClientQPS, k9sClientBurst, isSecure)
	cfg.LoadAppConfig()

	c := container.NewContainer(env, cfg)
	e := echo.New()
	startBanner()
	routes.ConfigureRoutes(e, c)

	if !noOpen {
		openDefaultBrowser(c.Config().IsSecure, c.Config().ListenAddr)
	}

	if c.Config().IsSecure {
		e.Pre(middleware.HTTPSRedirect())
		if err = e.StartTLS(c.Config().ListenAddr, certFile, keyFile); err != nil {
			return err
		}
		return nil
	}

	if err = e.Start(c.Config().ListenAddr); err != nil {
		return err
	}
	return nil
}

func openDefaultBrowser(isSecure bool, listenAddr string) {
	// Split IP and Port
	host, port, err := net.SplitHostPort(listenAddr)
	if err != nil {
		// fallback if listenAddr is invalid
		host = "localhost"
		port = "7080"
	}
	// Default to localhost if no IP is provided (e.g., ":7080")
	if host == "" || host == "::" {
		host = "localhost"
	}
	scheme := "http"
	if isSecure {
		scheme = "https"
	}
	url := fmt.Sprintf("%s://%s:%s", scheme, host, port)
	// this will allow container apps to run
	browser.OpenURL(url)
}

func startBanner() {
	fmt.Println(" _          _                        _ _ ")
	fmt.Println("| | ___   _| |__   _____      ____ _| | |")
	fmt.Println("| |/ / | | | '_ \\ / _ \\ \\ /\\ / / _` | | |")
	fmt.Println("|   <| |_| | |_) |  __/\\ V  V / (_| | | |")
	fmt.Println("|_|\\_\\\\__,_|_.__/ \\___| \\_/\\_/ \\__,_|_|_|")
	fmt.Println("___________________________________________")
	fmt.Println("version:", Version)
	fmt.Println("commit:", Commit)
	fmt.Println("https://github.com/kubewall/kubewall")
	fmt.Println("___________________________________________")
}
