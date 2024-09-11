package middleware

import (
	"strings"

	"github.com/kubewall/kubewall/backend/container"

	"github.com/labstack/echo/v4"
)

func ClusterQueryParamMiddleware(container container.Container) echo.MiddlewareFunc {
	return func(next echo.HandlerFunc) echo.HandlerFunc {
		return func(c echo.Context) error {
			if strings.Contains(c.Path(), "api/v1/app") || c.Path() == "" || c.Path() == "/" {
				return next(c)
			}

			if c.QueryParam("cluster") == "" {
				return c.JSON(400, "?cluster={clusterName} query param is required")
			}

			if _, ok := container.Config().KubeConfig[c.QueryParam("config")]; !ok {
				return c.JSON(400, "selected config is not present")
			}

			for _, v := range container.Config().KubeConfig {
				if strings.EqualFold(v.Name, c.QueryParam("cluster")) {
					if !v.FileExists {
						return c.JSON(400, "selected cluster is not present in config")
					}
				}
			}

			for _, v := range container.Config().KubeConfig[c.QueryParam("config")].Clusters {
				if v.Name == c.QueryParam("cluster") {
					return next(c)
				}
			}
			return c.JSON(400, "selected cluster is not present in config")
		}
	}
}
