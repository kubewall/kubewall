package types

// ServiceListResponse represents a service in the list view
type ServiceListResponse struct {
	Age        string `json:"age"`
	HasUpdated bool   `json:"hasUpdated"`
	Name       string `json:"name"`
	Namespace  string `json:"namespace"`
	UID        string `json:"uid"`
	Spec       struct {
		Ports                 string `json:"ports"`
		ClusterIP             string `json:"clusterIP"`
		Type                  string `json:"type"`
		SessionAffinity       string `json:"sessionAffinity"`
		IPFamilyPolicy        string `json:"ipFamilyPolicy"`
		InternalTrafficPolicy string `json:"internalTrafficPolicy"`
		ExternalIPs           string `json:"externalIPs"`
	} `json:"spec"`
}

// IngressListResponse represents an ingress in the list view
type IngressListResponse struct {
	Age        string `json:"age"`
	HasUpdated bool   `json:"hasUpdated"`
	Name       string `json:"name"`
	Namespace  string `json:"namespace"`
	UID        string `json:"uid"`
	Spec       struct {
		Rules []string `json:"rules"`
	} `json:"spec"`
}

// EndpointListResponse represents an endpoint in the list view
type EndpointListResponse struct {
	Age        string `json:"age"`
	HasUpdated bool   `json:"hasUpdated"`
	Name       string `json:"name"`
	Namespace  string `json:"namespace"`
	UID        string `json:"uid"`
	Subsets    struct {
		Addresses []string `json:"addresses"`
		Ports     []string `json:"ports"`
	} `json:"subsets"`
}
