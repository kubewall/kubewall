package cmd

import (
	"fmt"
	"github.com/kubewall/kubewall/backend/config"
	"github.com/kubewall/kubewall/backend/container"
	"github.com/kubewall/kubewall/backend/routes"
	"github.com/labstack/echo/v4"
	"github.com/spf13/cobra"
	"os"
)

func init() {
	rootCmd.PersistentFlags().String("certFile", "", "absolute path to certificate file")
	rootCmd.PersistentFlags().String("keyFile", "", "absolute path to key file")
	rootCmd.PersistentFlags().StringP("port", "p", ":7080", "port to listen on")
	rootCmd.PersistentFlags().Int("k8s-client-qps", 50, "maximum QPS to the master from client")
	rootCmd.PersistentFlags().Int("k8s-client-burst", 50, "Maximum burst for throttle")
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

	k8sClientQPS, _ := cmd.Flags().GetInt("k8s-client-qps")
	k9sClientBurst, _ := cmd.Flags().GetInt("k8s-client-burst")
	cfg := config.NewAppConfig(Version, k8sClientQPS, k9sClientBurst)
	cfg.LoadAppConfig()

	c := container.NewContainer(env, cfg)
	e := echo.New()

	routes.ConfigureRoutes(e, c)

	port, _ := cmd.Flags().GetString("port")
	if port[0] != ':' {
		port = ":" + port
	}
	certFile, _ := cmd.Flags().GetString("certFile")
	keyFile, _ := cmd.Flags().GetString("keyFile")

	if certFile == "" || keyFile == "" {
		err := e.Start(port)
		if err != nil {
			return err
		}
		return nil
	}
	err := e.StartTLS(port, certFile, keyFile)
	if err != nil {
		return err
	}
	return nil
}
