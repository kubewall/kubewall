package types

import "time"

// BaseResponse contains common fields that all resource responses share
type BaseResponse struct {
	Age        string `json:"age"`
	HasUpdated bool   `json:"hasUpdated"`
	Name       string `json:"name"`
	UID        string `json:"uid"`
}

// NamespacedResponse extends BaseResponse with namespace information
type NamespacedResponse struct {
	BaseResponse
	Namespace string `json:"namespace"`
}

// ResourceVersionResponse extends BaseResponse with resource version information
type ResourceVersionResponse struct {
	BaseResponse
	ResourceVersion string `json:"resourceVersion"`
}

// Condition represents a resource condition
type Condition struct {
	Type   string `json:"type"`
	Status string `json:"status"`
}

// TimeFormat formats a time.Time to RFC3339 string, handling zero values
func TimeFormat(t time.Time) string {
	if t.IsZero() {
		return ""
	}
	return t.Format(time.RFC3339)
}
