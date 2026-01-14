package middleware

import (
	"github.com/kubewall/kubewall/backend/container"

	"github.com/labstack/echo/v4"
)

func ClusterQueryParamMiddleware(container container.Container) echo.MiddlewareFunc {
	return func(next echo.HandlerFunc) echo.HandlerFunc {
		return func(c echo.Context) error {
			if shouldSkip(c) {
				return next(c)
			}

			config := c.QueryParam("config")
			cluster := c.QueryParam("cluster")

			if cluster == "" {
				return c.JSON(400, "?cluster={clusterName} query param is required")
			}

			// Check if config exists
			kubeConfig, ok := container.Config().KubeConfig[config]
			if !ok || kubeConfig == nil {
				return c.JSON(400, "selected config is not present")
			}

			// Check if file exists
			if !kubeConfig.FileExists {
				return c.JSON(400, "selected config file does not exist")
			}

			// Check if cluster exists in the config
			if kubeConfig.Clusters == nil {
				return c.JSON(400, "no clusters found in config")
			}

			clusterObj, ok := kubeConfig.Clusters[cluster]
			if !ok || clusterObj == nil {
				return c.JSON(400, "selected cluster is not present in config")
			}

			return next(c)
		}
	}
}
