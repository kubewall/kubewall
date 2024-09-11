package cmd

import (
	"fmt"

	"github.com/spf13/cobra"
)

var Version = "unknown"

func init() {
	rootCmd.AddCommand(versionCmd)
}

var versionCmd = &cobra.Command{
	Use:   "version",
	Short: "Print the version of kubewall",
	Long:  `All software has a version (semantic at best). This is kubewall's'`,
	Run: func(cmd *cobra.Command, args []string) {
		fmt.Println(Version)
	},
}
