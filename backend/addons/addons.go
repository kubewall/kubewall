package addons

import (
	"fmt"
	"sync"

	"github.com/kubewall/kubewall/backend/container"
	"github.com/labstack/echo/v4"
)

// Module is a statically linked addon. Private builds enable modules by
// blank-importing the private package from their main package.
type Module struct {
	Name                  string
	RegisterMiddleware    func(*echo.Echo, container.Container)
	RegisterRoutes        func(*echo.Echo, container.Container)
	SkipClusterMiddleware func(echo.Context) bool
}

var registry = struct {
	sync.RWMutex
	modules []Module
	names   map[string]struct{}
}{
	names: make(map[string]struct{}),
}

// Register adds an addon module. It is intended to be called from init.
func Register(module Module) {
	if module.Name == "" {
		panic("addons: module name is required")
	}
	if module.RegisterMiddleware == nil && module.RegisterRoutes == nil && module.SkipClusterMiddleware == nil {
		panic(fmt.Sprintf("addons: module %q has no hooks", module.Name))
	}

	registry.Lock()
	defer registry.Unlock()

	if _, exists := registry.names[module.Name]; exists {
		panic(fmt.Sprintf("addons: module %q already registered", module.Name))
	}
	registry.names[module.Name] = struct{}{}
	registry.modules = append(registry.modules, module)
}

// RegisterMiddleware installs every registered module's middleware.
func RegisterMiddleware(e *echo.Echo, appContainer container.Container) {
	for _, module := range modules() {
		if module.RegisterMiddleware != nil {
			module.RegisterMiddleware(e, appContainer)
		}
	}
}

// RegisterRoutes installs every registered module's routes.
func RegisterRoutes(e *echo.Echo, appContainer container.Container) {
	for _, module := range modules() {
		if module.RegisterRoutes != nil {
			module.RegisterRoutes(e, appContainer)
		}
	}
}

// ShouldSkipClusterMiddleware lets addons expose routes that do not require
// Kubernetes cluster query params, such as local test or health pages.
func ShouldSkipClusterMiddleware(c echo.Context) bool {
	for _, module := range modules() {
		if module.SkipClusterMiddleware != nil && module.SkipClusterMiddleware(c) {
			return true
		}
	}
	return false
}

func modules() []Module {
	registry.RLock()
	defer registry.RUnlock()

	out := make([]Module, len(registry.modules))
	copy(out, registry.modules)
	return out
}
