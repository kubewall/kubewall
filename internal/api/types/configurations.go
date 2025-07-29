package types

// ConfigMapListResponse represents the response format expected by the frontend for configmaps
type ConfigMapListResponse struct {
	Age        string `json:"age"`
	HasUpdated bool   `json:"hasUpdated"`
	Name       string `json:"name"`
	Namespace  string `json:"namespace"`
	UID        string `json:"uid"`
	Data       struct {
		Keys []string `json:"keys"`
	} `json:"data"`
}

// SecretListResponse represents the response format expected by the frontend for secrets
type SecretListResponse struct {
	Age        string `json:"age"`
	HasUpdated bool   `json:"hasUpdated"`
	Name       string `json:"name"`
	Namespace  string `json:"namespace"`
	UID        string `json:"uid"`
	Type       string `json:"type"`
	Data       struct {
		Keys []string `json:"keys"`
	} `json:"data"`
}

// HPAListResponse represents the response format expected by the frontend for HPAs
type HPAListResponse struct {
	Age        string `json:"age"`
	HasUpdated bool   `json:"hasUpdated"`
	Name       string `json:"name"`
	Namespace  string `json:"namespace"`
	UID        string `json:"uid"`
	Spec       struct {
		MinPods int32 `json:"minPods"`
		MaxPods int32 `json:"maxPods"`
	} `json:"spec"`
}

// LimitRangeListResponse represents the response format expected by the frontend for limit ranges
type LimitRangeListResponse struct {
	Age        string `json:"age"`
	HasUpdated bool   `json:"hasUpdated"`
	Name       string `json:"name"`
	Namespace  string `json:"namespace"`
	UID        string `json:"uid"`
	Spec       struct {
		LimitCount int `json:"limitCount"`
	} `json:"spec"`
}

// ResourceQuotaListResponse represents the response format expected by the frontend for resource quotas
type ResourceQuotaListResponse struct {
	Age        string `json:"age"`
	HasUpdated bool   `json:"hasUpdated"`
	Name       string `json:"name"`
	Namespace  string `json:"namespace"`
	UID        string `json:"uid"`
	Spec       struct {
		Hard map[string]string `json:"hard"`
	} `json:"spec"`
	Status struct {
		Used map[string]string `json:"used"`
	} `json:"status"`
}

// PodDisruptionBudgetListResponse represents the response format expected by the frontend for pod disruption budgets
type PodDisruptionBudgetListResponse struct {
	Age        string `json:"age"`
	HasUpdated bool   `json:"hasUpdated"`
	Name       string `json:"name"`
	Namespace  string `json:"namespace"`
	UID        string `json:"uid"`
	Spec       struct {
		MinAvailable   string `json:"minAvailable"`
		MaxUnavailable string `json:"maxUnavailable"`
	} `json:"spec"`
	Status struct {
		CurrentHealthy     int32 `json:"currentHealthy"`
		DesiredHealthy     int32 `json:"desiredHealthy"`
		ExpectedPods       int32 `json:"expectedPods"`
		DisruptionsAllowed int32 `json:"disruptionsAllowed"`
	} `json:"status"`
}

// PriorityClassListResponse represents the response format expected by the frontend for priority classes
type PriorityClassListResponse struct {
	Age           string `json:"age"`
	HasUpdated    bool   `json:"hasUpdated"`
	Name          string `json:"name"`
	UID           string `json:"uid"`
	Value         int32  `json:"value"`
	GlobalDefault bool   `json:"globalDefault"`
	Description   string `json:"description"`
}

// RuntimeClassListResponse represents the response format expected by the frontend for runtime classes
type RuntimeClassListResponse struct {
	Age        string `json:"age"`
	HasUpdated bool   `json:"hasUpdated"`
	Name       string `json:"name"`
	UID        string `json:"uid"`
	Handler    string `json:"handler"`
}
