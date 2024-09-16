package cmd

import (
	"fmt"
	"github.com/kubewall/kubewall/backend/config"
	"github.com/kubewall/kubewall/backend/container"
	"github.com/kubewall/kubewall/backend/routes"
	"github.com/labstack/echo/v4"
	"github.com/pkg/browser"
	"github.com/spf13/cobra"
	"os"
)

func init() {
	rootCmd.PersistentFlags().String("certFile", "", "absolute path to certificate file")
	rootCmd.PersistentFlags().String("keyFile", "", "absolute path to key file")
	rootCmd.PersistentFlags().StringP("port", "p", ":7080", "port to listen on")
	rootCmd.PersistentFlags().Int("k8s-client-qps", 50, "maximum QPS to the master from client")
	rootCmd.PersistentFlags().Int("k8s-client-burst", 50, "Maximum burst for throttle")
	rootCmd.PersistentFlags().Bool("no-open", false, "Do not open the default browser")
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

	cfg := config.NewAppConfig(Version, k8sClientQPS, k9sClientBurst)
	cfg.LoadAppConfig()

	c := container.NewContainer(env, cfg)
	e := echo.New()
	startBanner()
	routes.ConfigureRoutes(e, c)

	port, err := cmd.Flags().GetString("port")
	if err != nil {
		return err
	}
	if port[0] != ':' {
		port = ":" + port
	}

	certFile, err := cmd.Flags().GetString("certFile")
	if err != nil {
		return err
	}
	keyFile, err := cmd.Flags().GetString("keyFile")
	if err != nil {
		return err
	}
	noOpen, err := cmd.Flags().GetBool("no-open")
	if err != nil {
		return err
	}

	isSecure := certFile != "" || keyFile != ""

	openDefaultBrowser(noOpen, isSecure, port)

	if isSecure {
		if err = e.StartTLS(port, certFile, keyFile); err != nil {
			return err
		}
		return nil
	}

	if err = e.Start(port); err != nil {
		return err
	}
	return nil
}

func openDefaultBrowser(noOpen, isSecure bool, port string) {
	if noOpen {
		return
	}
	url := fmt.Sprintf("http://localhost%s", port)
	if isSecure {
		url = fmt.Sprintf("https://localhost%s", port)
	}
	// we are going to ignore error in this case
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
