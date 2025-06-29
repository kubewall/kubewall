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
				_, err = container.DiscoveryClient(config, cluster).ServerVersion()
				if err != nil {
					log.Error("failed to connect to cluster", "err", err)
					container.Cache().Set(isAbleToConnectToClusterCacheKey, false)
					return c.JSON(http.StatusInternalServerError, err.Error())
				}
				container.Cache().Set(isAbleToConnectToClusterCacheKey, true)
			}

			if value == false {
				log.Warn("previously failed to connect to this cluster, please read-load config or check network-connection")
			}

			return next(c)
		}
	}
}
