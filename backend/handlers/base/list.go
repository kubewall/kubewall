package base

import (
	"encoding/json"
	"strings"
)

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
