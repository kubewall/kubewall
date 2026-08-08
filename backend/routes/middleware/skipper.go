package middleware

import (
	"strings"

	"github.com/kubewall/kubewall/backend/addons"
	"github.com/labstack/echo/v4"
)

func shouldSkip(c echo.Context, middleware string) bool {
	return strings.Contains(c.Path(), "api/v1/app") ||
		c.Path() == "" ||
		c.Path() == "/" ||
		c.Path() == "/healthz" ||
		addons.ShouldSkip(c, middleware)
}
