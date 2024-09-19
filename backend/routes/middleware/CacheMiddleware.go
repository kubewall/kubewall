package middleware

import (
	"fmt"
	"github.com/kubewall/kubewall/backend/container"
	"github.com/kubewall/kubewall/backend/handlers/helpers"
	"github.com/labstack/echo/v4"
	"strings"
)

func CacheMiddleware(container container.Container) echo.MiddlewareFunc {
	return func(next echo.HandlerFunc) echo.HandlerFunc {
		return func(c echo.Context) error {
			if strings.Contains(c.Path(), "api/v1/app") || c.Path() == "" || c.Path() == "/" {
				return next(c)
			}

			config := c.QueryParam("config")
			cluster := c.QueryParam("cluster")

			allResourcesKey := fmt.Sprintf(helpers.AllResourcesCacheKeyFormat, config, cluster)
			metricAPIAvailableKey := fmt.Sprintf(helpers.IsMetricServerAvailableCacheKeyFormat, config, cluster)

			if !container.Cache().Has(metricAPIAvailableKey) {
				helpers.CacheIfIsMetricsAPIAvailable(container, config, cluster)
			}

			if !container.Cache().Has(allResourcesKey) {
				helpers.CacheAllResources(container, config, cluster)
			}

			return next(c)
		}
	}
}
