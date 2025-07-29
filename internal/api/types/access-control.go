package types

// ServiceAccountListResponse represents the response format expected by the frontend for service accounts
type ServiceAccountListResponse struct {
	BaseResponse
	Namespace string `json:"namespace"`
	Spec      struct {
		Secrets int `json:"secrets"`
	} `json:"spec"`
}

// RoleListResponse represents the response format expected by the frontend for roles
type RoleListResponse struct {
	NamespacedResponse
	Spec struct {
		Rules []string `json:"rules"`
	} `json:"spec"`
}

// RoleBindingListResponse represents the response format expected by the frontend for role bindings
type RoleBindingListResponse struct {
	NamespacedResponse
	Subjects struct {
		Bindings []string `json:"bindings"`
	} `json:"subjects"`
}

// ClusterRoleListResponse represents the response format expected by the frontend for cluster roles
type ClusterRoleListResponse struct {
	BaseResponse
	Spec struct {
		Rules []string `json:"rules"`
	} `json:"spec"`
}

// ClusterRoleBindingListResponse represents the response format expected by the frontend for cluster role bindings
type ClusterRoleBindingListResponse struct {
	BaseResponse
	Subjects struct {
		Bindings []string `json:"bindings"`
	} `json:"subjects"`
}
