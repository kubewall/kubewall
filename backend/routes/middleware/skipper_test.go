package middleware

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/kubewall/kubewall/backend/addons"
	"github.com/labstack/echo/v4"
)

// TestShouldSkip covers the two addon exemption levels: a route may opt out of
// every cluster middleware, or only out of the cache middleware so it keeps
// validation and connectivity checks without activating the cluster.
func TestShouldSkip(t *testing.T) {
	addons.Register(addons.Module{
		Name: "skipper-test",
		SkipMiddlewareList: []addons.SkipRule{
			{Paths: []string{"/skip-all"}},
			{Paths: []string{"/skip-cache"}, Middlewares: []string{ClusterCache}},
		},
	})

	tests := []struct {
		path       string
		queryParam bool
		connect    bool
		cache      bool
	}{
		{path: "/skip-all", queryParam: true, connect: true, cache: true},
		{path: "/skip-cache", queryParam: false, connect: false, cache: true},
		{path: "/api/v1/app/config", queryParam: true, connect: true, cache: true},
		{path: "/healthz", queryParam: true, connect: true, cache: true},
		{path: "/", queryParam: true, connect: true, cache: true},
		{path: "/api/v1/pods", queryParam: false, connect: false, cache: false},
	}

	for _, tt := range tests {
		t.Run(tt.path, func(t *testing.T) {
			e := echo.New()
			c := e.NewContext(httptest.NewRequest(http.MethodGet, "/", nil), httptest.NewRecorder())
			c.SetPath(tt.path)

			for _, want := range []struct {
				middleware string
				skip       bool
			}{
				{ClusterQueryParam, tt.queryParam},
				{ClusterConnectivity, tt.connect},
				{ClusterCache, tt.cache},
			} {
				if got := shouldSkip(c, want.middleware); got != want.skip {
					t.Errorf("shouldSkip(%q, %q) = %v, want %v", tt.path, want.middleware, got, want.skip)
				}
			}
		})
	}
}
