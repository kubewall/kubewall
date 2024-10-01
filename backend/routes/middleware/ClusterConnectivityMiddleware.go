package middleware

import (
	"fmt"
	"github.com/charmbracelet/log"
	"github.com/kubewall/kubewall/backend/container"
	"github.com/labstack/echo/v4"
	"net/http"
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

			if !container.Cache().Has(isAbleToConnectToClusterCacheKey) {
				_, err = container.DiscoveryClient(config, cluster).ServerVersion()
				if err != nil {
					log.Error("failed to connect to cluster", "err", err)
					container.Cache().Set(isAbleToConnectToClusterCacheKey, false)
					return c.JSON(http.StatusInternalServerError, err.Error())
				}
				container.Cache().Set(isAbleToConnectToClusterCacheKey, true)
			}

			value, _ := container.Cache().Get(isAbleToConnectToClusterCacheKey)
			if value == false {
				log.Error("previously failed to connect to this cluster, please read-load config or check network-connection")
				return c.JSON(http.StatusInternalServerError, "Cluster is not available or failed to connect to cluster, please check network connection")
			}

			return next(c)
		}
	}
}
