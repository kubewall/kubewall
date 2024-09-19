package helpers

import (
	"fmt"
	"github.com/kubewall/kubewall/backend/container"
	"strings"
)

const AllResourcesCacheKeyFormat = "%s-%s-allResourcesCache"
const IsMetricServerAvailableCacheKeyFormat = "%s-%s-isMetricServerAvailableCache"

type Resources struct {
	Namespaced bool   `json:"namespaced"`
	Name       string `json:"name"`
	Kind       string `json:"kind"`
}

func CacheAllResources(container container.Container, config, cluster string) error {
	apiResources, err := container.ClientSet(config, cluster).Discovery().ServerPreferredResources()
	if err != nil {
		return err
	}

	var allResource []Resources

	for _, group := range apiResources {
		for _, resource := range group.APIResources {
			allResource = append(allResource, Resources{
				Namespaced: resource.Namespaced,
				Name:       resource.Name,
				Kind:       resource.Kind,
			})
		}
	}
	container.Cache().Set(fmt.Sprintf(AllResourcesCacheKeyFormat, config, cluster), allResource)
	return nil
}

func GetAllResourcesFromCache(container container.Container, config, cluster string) ([]Resources, error) {
	cacheKey := fmt.Sprintf(AllResourcesCacheKeyFormat, config, cluster)
	c, exists := container.Cache().Get(cacheKey)
	if !exists {
		return nil, fmt.Errorf("%s not found in cache", cacheKey)
	}
	return c.([]Resources), nil
}

func ReCacheAllResources(container container.Container, config, cluster string) error {
	container.Cache().Delete(fmt.Sprintf(AllResourcesCacheKeyFormat, config, cluster))
	return CacheAllResources(container, config, cluster)
}

func GetResourceNameFromKind(container container.Container, config, cluster, kind string) (string, bool) {
	resources, _ := GetAllResourcesFromCache(container, config, cluster)
	for _, resource := range resources {
		if strings.EqualFold(kind, resource.Kind) {
			return resource.Name, true
		}
	}
	return "", false
}

func IsNamespacedResource(container container.Container, config, cluster, kind string) (bool, bool) {
	resources, _ := GetAllResourcesFromCache(container, config, cluster)
	for _, resource := range resources {
		if strings.EqualFold(kind, resource.Kind) {
			return resource.Namespaced, true
		}
	}
	return false, false
}

func CacheIfIsMetricsAPIAvailable(container container.Container, config string, cluster string) bool {
	var available bool

	apiGroupList, err := container.ClientSet(config, cluster).Discovery().ServerGroups()
	if err != nil {
		return false
	}

	// Loop through the API groups to check for metrics.k8s.io
	for _, group := range apiGroupList.Groups {
		if group.Name == "metrics.k8s.io" {
			available = true
		}
	}

	container.Cache().Set(fmt.Sprintf(IsMetricServerAvailableCacheKeyFormat, config, cluster), available)
	return false
}
