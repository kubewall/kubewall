package middleware

import (
	"fmt"
	"github.com/kubewall/kubewall/backend/container"
	"github.com/labstack/echo/v4"
	"k8s.io/client-go/kubernetes"
	"net/http"
	"strings"
)

const NoNamespacedResources = "%s-%s-nonNamespacedResources"
const MetricAPIAvailableKey = "%s-%s-metricAPIAvailableKey"

func CacheMiddleware(container container.Container) echo.MiddlewareFunc {
	return func(next echo.HandlerFunc) echo.HandlerFunc {
		return func(c echo.Context) error {
			if strings.Contains(c.Path(), "api/v1/app") || c.Path() == "" || c.Path() == "/" {
				return next(c)
			}

			config := c.QueryParam("config")
			cluster := c.QueryParam("cluster")

			noNamespacedResourceKey := fmt.Sprintf(NoNamespacedResources, config, cluster)
			metricAPIAvailableKey := fmt.Sprintf(MetricAPIAvailableKey, config, cluster)

			if container.Cache().Has(metricAPIAvailableKey) == false {
				container.Cache().Set(metricAPIAvailableKey, isMetricsAPIAvailable(container.ClientSet(config, cluster)))
			}

			if container.Cache().Has(noNamespacedResourceKey) {
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
			container.Cache().Set(noNamespacedResourceKey, resources)

			return next(c)
		}
	}
}

// isMetricsAPIAvailable checks if the metrics.k8s.io API group is available on the cluster
func isMetricsAPIAvailable(clientset *kubernetes.Clientset) bool {
	// Fetch the list of API groups
	apiGroupList, err := clientset.Discovery().ServerGroups()
	if err != nil {
		return false
	}

	// Loop through the API groups to check for metrics.k8s.io
	for _, group := range apiGroupList.Groups {
		if group.Name == "metrics.k8s.io" {
			return true
		}
	}

	// If we reach here, the metrics API was not found
	return false
}
