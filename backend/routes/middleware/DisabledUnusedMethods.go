package middleware

import (
	"slices"

	"github.com/kubewall/kubewall/backend/container"

	"github.com/labstack/echo/v4"
)

var disabledMethods = []string{"DELETE", "PUT", "PATCH", "POST"}

func DisableUnusedMethods(container container.Container) echo.MiddlewareFunc {
	return func(next echo.HandlerFunc) echo.HandlerFunc {
		return func(c echo.Context) error {
			if slices.Contains(disabledMethods, c.Request().Method) {
				return echo.ErrMethodNotAllowed
			}
			return next(c)
		}
	}
}
