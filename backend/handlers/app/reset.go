package app

import (
	"sync"

	"github.com/charmbracelet/log"
	"github.com/kubewall/kubewall/backend/container"
	"github.com/kubewall/kubewall/backend/handlers/base"
)

var resetMu sync.Mutex

func resetApp(c container.Container) {
	resetMu.Lock()
	defer resetMu.Unlock()
	log.Info("reset: tearing down all cluster state")
	c.PortForwarder().StopAll()
	c.SSE().Close()
	c.EventProcessor().Reset()
	c.Config().ReloadConfig()
	c.Cache().InvalidateAll()
	base.Reset()
	log.Info("reset: complete, clusters will reconnect on next request")
}
