package main

import (
	"github.com/kubewall/kubewall/backend/cmd"
)

// version specify version of application using ldflags
var version = "dev"
var commit = "unknown"

func main() {
	cmd.Version = version
	cmd.Commit = commit
	cmd.Execute()
}
