package types

import (
	"time"
)

// HelmRelease represents a Helm release
type HelmRelease struct {
	Name        string    `json:"name"`
	Namespace   string    `json:"namespace"`
	Status      string    `json:"status"`
	Revision    int       `json:"revision"`
	Updated     time.Time `json:"updated"`
	Chart       string    `json:"chart"`
	AppVersion  string    `json:"appVersion"`
	Version     string    `json:"version"`
	Description string    `json:"description"`
	Notes       string    `json:"notes"`
	Values      string    `json:"values"`
	Manifests   string    `json:"manifests"`
	Deployments []string  `json:"deployments"`
}

// HelmReleaseHistory represents a Helm release revision
type HelmReleaseHistory struct {
	Revision    int       `json:"revision"`
	Updated     time.Time `json:"updated"`
	Status      string    `json:"status"`
	Chart       string    `json:"chart"`
	AppVersion  string    `json:"appVersion"`
	Description string    `json:"description"`
	IsLatest    bool      `json:"isLatest"`
}

// HelmReleaseList represents a list of Helm releases
type HelmReleaseList struct {
	Releases []HelmRelease `json:"releases"`
	Total    int           `json:"total"`
}

// HelmReleaseDetails represents detailed information about a Helm release
type HelmReleaseDetails struct {
	Release   HelmRelease          `json:"release"`
	History   []HelmReleaseHistory `json:"history"`
	Values    string               `json:"values"`
	Templates string               `json:"templates"`
	Manifests string               `json:"manifests"`
}

// HelmReleaseResponse represents the API response for Helm releases
type HelmReleaseResponse struct {
	BaseResponse
	Namespace string `json:"namespace"`
	Status    string `json:"status"`
	Revision  int    `json:"revision"`
	Updated   string `json:"updated"`
	Chart     string `json:"chart"`
	Version   string `json:"version"`
}

// HelmReleaseHistoryResponse represents the API response for Helm release history
type HelmReleaseHistoryResponse struct {
	Revision    int    `json:"revision"`
	Updated     string `json:"updated"`
	Status      string `json:"status"`
	Chart       string `json:"chart"`
	AppVersion  string `json:"appVersion"`
	Description string `json:"description"`
	IsLatest    bool   `json:"isLatest"`
}

// HelmReleaseResource represents a Kubernetes resource created by a Helm release
type HelmReleaseResource struct {
	Name       string            `json:"name"`
	Kind       string            `json:"kind"`
	Namespace  string            `json:"namespace"`
	Status     string            `json:"status"`
	Age        string            `json:"age"`
	Created    string            `json:"created"`
	Labels     map[string]string `json:"labels,omitempty"`
	APIVersion string            `json:"apiVersion,omitempty"`
}

// HelmReleaseResourcesResponse represents the API response for Helm release resources
type HelmReleaseResourcesResponse struct {
	Resources []HelmReleaseResource `json:"resources"`
	Total     int                   `json:"total"`
	Summary   ResourceSummary       `json:"summary"`
}

// ResourceSummary provides a summary of resources by type and status
type ResourceSummary struct {
	ByType   map[string]int `json:"byType"`
	ByStatus map[string]int `json:"byStatus"`
	Total    int            `json:"total"`
}
