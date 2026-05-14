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

func TestShouldSkipClusterMiddleware(t *testing.T) {
	resetRegistryForTest(t)

	Register(Module{
		Name: "skipper",
		SkipClusterMiddleware: func(c echo.Context) bool {
			return c.Path() == "/local"
		},
	})

	e := echo.New()
	req := httptest.NewRequest(http.MethodGet, "/local", nil)
	rec := httptest.NewRecorder()
	c := e.NewContext(req, rec)
	c.SetPath("/local")

	if !ShouldSkipClusterMiddleware(c) {
		t.Fatal("registered skipper was not called")
	}
}

func TestRegisterPanicsOnDuplicateName(t *testing.T) {
	resetRegistryForTest(t)

	module := Module{Name: "duplicate", RegisterRoutes: func(*echo.Echo, container.Container) {}}
	Register(module)

	defer func() {
		if recover() == nil {
			t.Fatal("expected duplicate module registration to panic")
		}
	}()
	Register(module)
}

func resetRegistryForTest(t *testing.T) {
	t.Helper()

	registry.Lock()
	previousModules := registry.modules
	previousNames := registry.names
	registry.modules = nil
	registry.names = make(map[string]struct{})
	registry.Unlock()

	t.Cleanup(func() {
		registry.Lock()
		registry.modules = previousModules
		registry.names = previousNames
		registry.Unlock()
	})
}
