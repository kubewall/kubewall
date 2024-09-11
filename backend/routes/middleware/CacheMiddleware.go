package middleware

import (
	"fmt"
	"github.com/kubewall/kubewall/backend/container"
	"github.com/labstack/echo/v4"
	"net/http"
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
			cacheKey := fmt.Sprintf("%s-%s-nonNamespacedResources", config, cluster)

			if container.Cache().Has(cacheKey) {
				return next(c)
			}
			apiResources, err := container.ClientSet(config, cluster).Discovery().ServerPreferredResources()
			if err != nil {
				return c.JSON(http.StatusInternalServerError, err)
			}

			var resources []string
			for _, group := range apiResources {
				for _, resource := range group.APIResources {
					if !resource.Namespaced {
						resources = append(resources, resource.Kind)
					}
				}
			}
			container.Cache().Set(cacheKey, resources)

			return next(c)
		}
	}
}
