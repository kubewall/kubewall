package middleware

import (
	"fmt"

	"github.com/kubewall/kubewall/backend/container"
	"github.com/kubewall/kubewall/backend/handlers/helpers"
	"github.com/labstack/echo/v4"
)

func ClusterCacheMiddleware(container container.Container) echo.MiddlewareFunc {
	return func(next echo.HandlerFunc) echo.HandlerFunc {
		return func(c echo.Context) error {
			if shouldSkip(c) {
				return next(c)
			}

			config := c.QueryParam("config")
			cluster := c.QueryParam("cluster")

			allResourcesKey := fmt.Sprintf(helpers.AllResourcesCacheKeyFormat, config, cluster)
			metricAPIAvailableKey := fmt.Sprintf(helpers.IsMetricServerAvailableCacheKeyFormat, config, cluster)

			conn := container.Config().KubeConfig[config].Clusters[cluster]
			if !conn.IsConnected() {
				conn.MarkAsConnected()
			}

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
