package base

import (
	"encoding/json"
	"fmt"
	"strings"

	"github.com/kubewall/kubewall/backend/handlers/helpers"
	"github.com/labstack/echo/v4"
	"sigs.k8s.io/yaml"
)

func (h *BaseHandler) getStreamIDAndItem(kind, namespace, name string) (string, any, bool, error) {
	if h.IsNamespacedResource(h.Kind) {
		streamID := fmt.Sprintf("%s-%s-%s-%s-%s", h.QueryConfig, h.QueryCluster, kind, namespace, name)
		item, exists, err := h.Informer.GetStore().GetByKey(fmt.Sprintf("%s/%s", namespace, name))
		return streamID, item, exists, err
	}

	item, exists, err := h.Informer.GetStore().GetByKey(name)
	return fmt.Sprintf("%s-%s-%s-%s", h.QueryConfig, h.QueryCluster, kind, name), item, exists, err
}

func (h *BaseHandler) marshalDetailData(item any, exists bool) []byte {
	if !exists {
		return []byte("{}")
	}
	data, err := json.Marshal(item)
	if err != nil {
		return []byte("{}")
	}
	return data
}

func (h *BaseHandler) marshalYAML(item any, exists bool) []byte {
	if !exists {
		return []byte("{}")
	}
	y, err := yaml.Marshal(item)
	if err != nil {
		return []byte("{}")
	}
	b, err := json.Marshal(echo.Map{
		"data": y,
	})
	if err != nil {
		return []byte("{}")
	}
	return b
}

func (h *BaseHandler) marshalListData(items []any, resourceName string) []byte {
	if len(items) == 0 {
		return []byte("[]")
	}

	data, err := h.TransformFunc(items, h)
	if err != nil {
		return []byte("[]")
	}

	var entries []map[string]any
	// Returning data will send CRD data
	if err := json.Unmarshal(data, &entries); err != nil || entries == nil {
		return data
	}

	for i := range entries {
		entries[i]["hasUpdated"] = h.isResourceUpdated(entries[i], resourceName)
	}

	finalData, err := json.Marshal(entries)

	if err != nil {
		return []byte("[]")
	}

	return finalData
}

func (h *BaseHandler) isResourceUpdated(entry map[string]any, resourceName string) bool {
	if name, ok := entry["name"].(string); ok {
		return strings.EqualFold(resourceName, name)
	}
	return false
}

func (h *BaseHandler) IsNamespacedResource(kind string) bool {
	resource, exists := helpers.FindResourceByKind(h.Container, h.QueryConfig, h.QueryCluster, kind)
	if !exists {
		helpers.RefreshAllResourcesCache(h.Container, h.QueryConfig, h.QueryCluster)
		resource, _ = helpers.FindResourceByKind(h.Container, h.QueryConfig, h.QueryCluster, kind)
	}
	return resource.Namespaced
}

func (h *BaseHandler) GetResourceByKind(kind string) helpers.Resource {
	resource, exists := helpers.FindResourceByKind(h.Container, h.QueryConfig, h.QueryCluster, kind)
	if !exists || resource.Name == "" {
		helpers.RefreshAllResourcesCache(h.Container, h.QueryConfig, h.QueryCluster)
		resource, _ = helpers.FindResourceByKind(h.Container, h.QueryConfig, h.QueryCluster, kind)
	}

	return resource
}
