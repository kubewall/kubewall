package addons

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/kubewall/kubewall/backend/container"
	"github.com/labstack/echo/v4"
)

func TestRegisterRoutes(t *testing.T) {
	resetRegistryForTest(t)

	called := false
	Register(Module{
		Name: "routes",
		RegisterRoutes: func(*echo.Echo, container.Container) {
			called = true
		},
	})

	RegisterRoutes(echo.New(), nil)
	if !called {
		t.Fatal("registered route hook was not called")
	}
}

func TestRegisterMiddleware(t *testing.T) {
	resetRegistryForTest(t)

	called := false
	Register(Module{
		Name: "middleware",
		RegisterMiddleware: func(*echo.Echo, container.Container) {
			called = true
		},
	})

	RegisterMiddleware(echo.New(), nil)
	if !called {
		t.Fatal("registered middleware hook was not called")
	}
}

// Stand-ins for the real identifiers, which are declared by the middlewares
// themselves in routes/middleware — a package that imports this one, so it
// cannot be imported back here.
const (
	ClusterQueryParam   = "cluster-query-param"
	ClusterConnectivity = "cluster-connectivity"
	ClusterCache        = "cluster-cache"
)

func TestShouldSkip(t *testing.T) {
	resetRegistryForTest(t)

	Register(Module{
		Name: "skipper",
		SkipMiddlewareList: []SkipRule{
			// No middlewares listed: exempt from all of them.
			{Paths: []string{"api/v1/no-cluster"}},
			// Only the cache middleware, so the route still gets validated.
			{Paths: []string{"api/v1/read-only", "api/v1/pods/:name/read-only"}, Middlewares: []string{ClusterCache}},
		},
	})

	tests := []struct {
		path string
		want map[string]bool
	}{
		{"/api/v1/no-cluster", map[string]bool{ClusterQueryParam: true, ClusterConnectivity: true, ClusterCache: true}},
		{"/api/v1/read-only", map[string]bool{ClusterQueryParam: false, ClusterConnectivity: false, ClusterCache: true}},
		// Registered without a leading slash, requested with one, and vice versa.
		{"api/v1/read-only", map[string]bool{ClusterQueryParam: false, ClusterCache: true}},
		{"/api/v1/read-only/", map[string]bool{ClusterCache: true}},
		// Path params keep their template form.
		{"/api/v1/pods/:name/read-only", map[string]bool{ClusterCache: true}},
		// Exact matching: a shared prefix must not inherit the exemption.
		{"/api/v1/read-only-settings", map[string]bool{ClusterQueryParam: false, ClusterCache: false}},
		{"/api/v1/pods", map[string]bool{ClusterQueryParam: false, ClusterConnectivity: false, ClusterCache: false}},
		// Unmatched route.
		{"", map[string]bool{ClusterCache: false}},
	}

	for _, tt := range tests {
		t.Run(tt.path, func(t *testing.T) {
			c := contextWithPath(tt.path)
			for middleware, want := range tt.want {
				if got := ShouldSkip(c, middleware); got != want {
					t.Errorf("ShouldSkip(%q, %q) = %v, want %v", tt.path, middleware, got, want)
				}
			}
		})
	}
}

func TestShouldSkipMergesModules(t *testing.T) {
	resetRegistryForTest(t)

	Register(Module{
		Name:               "first",
		SkipMiddlewareList: []SkipRule{{Paths: []string{"/a"}, Middlewares: []string{ClusterCache}}},
	})
	Register(Module{
		Name:               "second",
		SkipMiddlewareList: []SkipRule{{Paths: []string{"/b"}, Middlewares: []string{ClusterCache}}},
	})

	for _, path := range []string{"/a", "/b"} {
		if !ShouldSkip(contextWithPath(path), ClusterCache) {
			t.Errorf("path %q from one of two modules was not skipped", path)
		}
	}
}

func TestRegisterPanicsOnDuplicateName(t *testing.T) {
	resetRegistryForTest(t)

	module := Module{Name: "duplicate", RegisterRoutes: func(*echo.Echo, container.Container) {}}
	Register(module)

	assertPanics(t, "duplicate module registration", func() { Register(module) })
}

// A skip rule that can never match is a silent bug, so registration fails fast.
func TestRegisterPanicsOnUnusableSkipRules(t *testing.T) {
	tests := []struct {
		name   string
		module Module
	}{
		{"no paths", Module{Name: "no-paths", SkipMiddlewareList: []SkipRule{{Middlewares: []string{ClusterCache}}}}},
		{"empty path", Module{Name: "empty-path", SkipMiddlewareList: []SkipRule{{Paths: []string{""}}}}},
		{"empty middleware", Module{Name: "empty-mw", SkipMiddlewareList: []SkipRule{{Paths: []string{"/a"}, Middlewares: []string{""}}}}},
		{"no hooks", Module{Name: "empty"}},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			resetRegistryForTest(t)
			assertPanics(t, tt.name, func() { Register(tt.module) })

			// A rejected module must not leave anything behind.
			registry.RLock()
			defer registry.RUnlock()
			if len(registry.modules) != 0 || len(registry.skips) != 0 || len(registry.skipAll) != 0 {
				t.Fatalf("rejected module was partially registered: %d modules, %d skip entries, %d skip-all entries",
					len(registry.modules), len(registry.skips), len(registry.skipAll))
			}
		})
	}
}

func assertPanics(t *testing.T, what string, fn func()) {
	t.Helper()

	defer func() {
		if recover() == nil {
			t.Fatalf("expected %s to panic", what)
		}
	}()
	fn()
}

func contextWithPath(path string) echo.Context {
	e := echo.New()
	c := e.NewContext(httptest.NewRequest(http.MethodGet, "/", nil), httptest.NewRecorder())
	c.SetPath(path)
	return c
}

func resetRegistryForTest(t *testing.T) {
	t.Helper()

	registry.Lock()
	previousModules := registry.modules
	previousNames := registry.names
	previousSkipAll := registry.skipAll
	previousSkips := registry.skips
	registry.modules = nil
	registry.names = make(map[string]struct{})
	registry.skipAll = make(map[string]struct{})
	registry.skips = make(map[string]map[string]struct{})
	registry.Unlock()

	t.Cleanup(func() {
		registry.Lock()
		registry.modules = previousModules
		registry.names = previousNames
		registry.skipAll = previousSkipAll
		registry.skips = previousSkips
		registry.Unlock()
	})
}
