package main

import (
	"github.com/kubewall/kubewall/backend/cmd"
)

// version specify version of application using ldflags
var version = "dev"

func main() {
	cmd.Version = version
	cmd.Execute()
}
