package middleware

import (
	"strings"

	"github.com/labstack/echo/v4"
)

func shouldSkip(c echo.Context) bool {
	return strings.Contains(c.Path(), "api/v1/app") ||
		c.Path() == "" ||
		c.Path() == "/" ||
		c.Path() == "/healthz" ||
		strings.Contains(c.Path(), "/api/v1/mcp/llm/v1")
}
