package helpers

import (
	"fmt"
	"strings"

	"github.com/charmbracelet/log"
	"github.com/kubewall/kubewall/backend/container"
	"k8s.io/client-go/discovery"
)

const AllResourcesCacheKeyFormat = "%s-%s-allResourcesCache"
const IsMetricServerAvailableCacheKeyFormat = "%s-%s-isMetricServerAvailableCache"

type Resource struct {
	Namespaced bool   `json:"namespaced"`
	Name       string `json:"name"`
	Kind       string `json:"kind"`
}

func CacheAllResources(container container.Container, config, cluster string) error {
	_, apiResourcesList, err := container.ClientSet(config, cluster).Discovery().ServerGroupsAndResources()
	if err != nil && !discovery.IsGroupDiscoveryFailedError(err) {
		return err // Only fail if it's not a partial discovery error
	}
	// Log partial errors for observability
	if err != nil {
		log.Info("partial discovery error", err)
	}

	allResource := make([]Resource, 0, 2000)
	for _, group := range apiResourcesList {
		for _, resource := range group.APIResources {
			allResource = append(allResource, Resource{
				Namespaced: resource.Namespaced,
				Name:       resource.Name,
				Kind:       resource.Kind,
			})
		}
		if strings.Contains(group.GroupVersion, "metrics.k8s.io") {
			container.Cache().Set(fmt.Sprintf(IsMetricServerAvailableCacheKeyFormat, config, cluster), true)
		}
	}
	container.Cache().Set(fmt.Sprintf(AllResourcesCacheKeyFormat, config, cluster), allResource)
	return nil
}

func GetAllResourcesFromCache(container container.Container, config, cluster string) ([]Resource, error) {
	cacheKey := fmt.Sprintf(AllResourcesCacheKeyFormat, config, cluster)
	c, exists := container.Cache().GetIfPresent(cacheKey)
	if !exists {
		return nil, fmt.Errorf("%s not found in cache", cacheKey)
	}
	return c.([]Resource), nil
}

func RefreshAllResourcesCache(container container.Container, config, cluster string) error {
	container.Cache().Invalidate(fmt.Sprintf(AllResourcesCacheKeyFormat, config, cluster))
	return CacheAllResources(container, config, cluster)
}

func FindResourceByKind(container container.Container, config, cluster, kind string) (Resource, bool) {
	resources, err := GetAllResourcesFromCache(container, config, cluster)
	if err != nil {
		log.Error("failed to find resource FindResourceByKind", "err", err)
		return Resource{}, false
	}
	for _, resource := range resources {
		if strings.EqualFold(kind, resource.Kind) {
			return resource, true
		}
	}
	return Resource{}, false
}
