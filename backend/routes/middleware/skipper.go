package middleware

import (
	"strings"

	"github.com/kubewall/kubewall/backend/addons"
	"github.com/labstack/echo/v4"
)

func shouldSkip(c echo.Context) bool {
	return strings.Contains(c.Path(), "api/v1/app") ||
		addons.ShouldSkipClusterMiddleware(c) ||
		c.Path() == "" ||
		c.Path() == "/" ||
		c.Path() == "/healthz"
}
