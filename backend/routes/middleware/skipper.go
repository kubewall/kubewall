package middleware

import (
	"github.com/labstack/echo/v4"
	"strings"
)

func shouldSkip(c echo.Context) bool {
	return strings.Contains(c.Path(), "api/v1/app") ||
		c.Path() == "" ||
		c.Path() == "/" ||
		c.Path() == "/healthz"
}
