package middleware

import (
	"fmt"
	"net/http"

	"github.com/charmbracelet/log"
	"github.com/kubewall/kubewall/backend/container"
	"github.com/labstack/echo/v4"
)

func ClusterConnectivityMiddleware(container container.Container) echo.MiddlewareFunc {
	return func(next echo.HandlerFunc) echo.HandlerFunc {
		return func(c echo.Context) error {
			if shouldSkip(c) {
				return next(c)
			}

			var err error

			config := c.QueryParam("config")
			cluster := c.QueryParam("cluster")

			isAbleToConnectToClusterCacheKey := fmt.Sprintf("%s-%s-isAbleToConnectToCluster", config, cluster)

			value, exists := container.Cache().GetIfPresent(isAbleToConnectToClusterCacheKey)
			if !exists {
				discoveryClient := container.DiscoveryClient(config, cluster)
				if discoveryClient == nil {
					log.Error("failed to get discovery client for cluster", "config", config, "cluster", cluster)
					return c.JSON(http.StatusFailedDependency, "discovery client not available")
				}
				_, err = discoveryClient.ServerVersion()
				if err != nil {
					log.Error("failed to connect to cluster", "err", err)
					return c.JSON(http.StatusFailedDependency, err.Error())
				}
				container.Cache().Set(isAbleToConnectToClusterCacheKey, true)
			}

			if value == false {
				log.Warn("previously failed to connect to this cluster, please read-load config or check network-connection")
				container.Cache().Invalidate(isAbleToConnectToClusterCacheKey)
				return c.JSON(http.StatusFailedDependency, "previously failed to connect to this cluster, please read-load config or check network-connection")
			}

			return next(c)
		}
	}
}
