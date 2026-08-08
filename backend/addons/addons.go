package addons

import (
	"fmt"
	"strings"
	"sync"

	"github.com/kubewall/kubewall/backend/container"
	"github.com/labstack/echo/v4"
)

type SkipRule struct {
	Paths       []string
	Middlewares []string
}

// Module is a statically linked addon. Private builds enable modules by
// blank-importing the private package from their main package.
type Module struct {
	Name               string
	RegisterMiddleware func(*echo.Echo, container.Container)
	RegisterRoutes     func(*echo.Echo, container.Container)
	SkipMiddlewareList []SkipRule
}

var registry = struct {
	sync.RWMutex
	modules []Module
	names   map[string]struct{}
	skipAll map[string]struct{}
	skips   map[string]map[string]struct{}
}{
	names:   make(map[string]struct{}),
	skipAll: make(map[string]struct{}),
	skips:   make(map[string]map[string]struct{}),
}

// Register adds an addon module. It is intended to be called from init.
func Register(module Module) {
	if module.Name == "" {
		panic("addons: module name is required")
	}
	if module.RegisterMiddleware == nil && module.RegisterRoutes == nil && len(module.SkipMiddlewareList) == 0 {
		panic(fmt.Sprintf("addons: module %q has no hooks", module.Name))
	}

	skipAll, skips, err := indexSkipRules(module.SkipMiddlewareList)
	if err != nil {
		panic(fmt.Sprintf("addons: module %q: %v", module.Name, err))
	}

	registry.Lock()
	defer registry.Unlock()

	if _, exists := registry.names[module.Name]; exists {
		panic(fmt.Sprintf("addons: module %q already registered", module.Name))
	}
	registry.names[module.Name] = struct{}{}
	registry.modules = append(registry.modules, module)

	for path := range skipAll {
		registry.skipAll[path] = struct{}{}
	}
	for middleware, paths := range skips {
		if registry.skips[middleware] == nil {
			registry.skips[middleware] = make(map[string]struct{}, len(paths))
		}
		for path := range paths {
			registry.skips[middleware][path] = struct{}{}
		}
	}
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

func ShouldSkip(c echo.Context, middleware string) bool {
	path := normalizePath(c.Path())
	if path == "" {
		return false
	}

	registry.RLock()
	defer registry.RUnlock()

	if _, all := registry.skipAll[path]; all {
		return true
	}
	_, skip := registry.skips[middleware][path]
	return skip
}

// indexSkipRules flattens skip rules into normalized path sets, rejecting rules
// that would silently never match.
func indexSkipRules(rules []SkipRule) (map[string]struct{}, map[string]map[string]struct{}, error) {
	skipAll := make(map[string]struct{})
	skips := make(map[string]map[string]struct{})

	for _, rule := range rules {
		if len(rule.Paths) == 0 {
			return nil, nil, fmt.Errorf("skip rule for %v has no paths", rule.Middlewares)
		}

		paths := make([]string, 0, len(rule.Paths))
		for _, path := range rule.Paths {
			normalized := normalizePath(path)
			if normalized == "" {
				return nil, nil, fmt.Errorf("skip rule for %v has an empty path", rule.Middlewares)
			}
			paths = append(paths, normalized)
		}

		if len(rule.Middlewares) == 0 {
			for _, path := range paths {
				skipAll[path] = struct{}{}
			}
			continue
		}

		for _, middleware := range rule.Middlewares {
			if middleware == "" {
				return nil, nil, fmt.Errorf("skip rule for %v names an empty middleware", rule.Paths)
			}
			if skips[middleware] == nil {
				skips[middleware] = make(map[string]struct{}, len(paths))
			}
			for _, path := range paths {
				skips[middleware][path] = struct{}{}
			}
		}
	}

	return skipAll, skips, nil
}

func normalizePath(path string) string {
	if path == "" {
		return ""
	}
	if !strings.HasPrefix(path, "/") {
		path = "/" + path
	}
	if len(path) > 1 {
		path = strings.TrimSuffix(path, "/")
	}
	return path
}

func modules() []Module {
	registry.RLock()
	defer registry.RUnlock()

	out := make([]Module, len(registry.modules))
	copy(out, registry.modules)
	return out
}
