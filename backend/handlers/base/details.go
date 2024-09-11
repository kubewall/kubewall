package base

import (
	"encoding/json"
	"fmt"
	"github.com/labstack/echo/v4"
	"sigs.k8s.io/yaml"
)

func (h *BaseHandler) getStreamIDAndItem(namespace, name string) (string, any, bool, error) {
	if h.isNamespaceResource(h.Kind) {
		streamID := fmt.Sprintf("%s-%s", namespace, name)
		item, exists, err := h.Informer.GetStore().GetByKey(fmt.Sprintf("%s/%s", namespace, name))
		return streamID, item, exists, err
	}

	item, exists, err := h.Informer.GetStore().GetByKey(name)
	return name, item, exists, err
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
