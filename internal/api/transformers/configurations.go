package transformers

import (
	"time"

	"kubewall-backend/internal/api/types"

	autoscalingV2 "k8s.io/api/autoscaling/v2"
	v1 "k8s.io/api/core/v1"
	nodeV1 "k8s.io/api/node/v1"
	policyV1 "k8s.io/api/policy/v1"
	schedulingV1 "k8s.io/api/scheduling/v1"
)

// TransformConfigMapToResponse transforms a ConfigMap to the frontend response format
func TransformConfigMapToResponse(configMap *v1.ConfigMap) types.ConfigMapListResponse {
	age := ""
	if !configMap.CreationTimestamp.IsZero() {
		age = time.Since(configMap.CreationTimestamp.Time).String()
	}

	// Extract keys from data
	keys := make([]string, 0, len(configMap.Data))
	for key := range configMap.Data {
		keys = append(keys, key)
	}

	return types.ConfigMapListResponse{
		Age:        age,
		HasUpdated: false,
		Name:       configMap.Name,
		Namespace:  configMap.Namespace,
		UID:        string(configMap.UID),
		Data: struct {
			Keys []string `json:"keys"`
		}{
			Keys: keys,
		},
	}
}

// TransformSecretToResponse transforms a Secret to the frontend response format
func TransformSecretToResponse(secret *v1.Secret) types.SecretListResponse {
	age := ""
	if !secret.CreationTimestamp.IsZero() {
		age = time.Since(secret.CreationTimestamp.Time).String()
	}

	// Extract keys from data
	keys := make([]string, 0, len(secret.Data))
	for key := range secret.Data {
		keys = append(keys, key)
	}

	return types.SecretListResponse{
		Age:        age,
		HasUpdated: false,
		Name:       secret.Name,
		Namespace:  secret.Namespace,
		UID:        string(secret.UID),
		Type:       string(secret.Type),
		Data: struct {
			Keys []string `json:"keys"`
		}{
			Keys: keys,
		},
	}
}

// TransformHPAToResponse transforms an HPA to the frontend response format
func TransformHPAToResponse(hpa *autoscalingV2.HorizontalPodAutoscaler) types.HPAListResponse {
	age := ""
	if !hpa.CreationTimestamp.IsZero() {
		age = time.Since(hpa.CreationTimestamp.Time).String()
	}

	minPods := int32(0)
	maxPods := int32(0)
	if hpa.Spec.MinReplicas != nil {
		minPods = *hpa.Spec.MinReplicas
	}
	if hpa.Spec.MaxReplicas != 0 {
		maxPods = hpa.Spec.MaxReplicas
	}

	return types.HPAListResponse{
		Age:        age,
		HasUpdated: false,
		Name:       hpa.Name,
		Namespace:  hpa.Namespace,
		UID:        string(hpa.UID),
		Spec: struct {
			MinPods int32 `json:"minPods"`
			MaxPods int32 `json:"maxPods"`
		}{
			MinPods: minPods,
			MaxPods: maxPods,
		},
	}
}

// TransformLimitRangeToResponse transforms a LimitRange to the frontend response format
func TransformLimitRangeToResponse(limitRange *v1.LimitRange) types.LimitRangeListResponse {
	age := ""
	if !limitRange.CreationTimestamp.IsZero() {
		age = time.Since(limitRange.CreationTimestamp.Time).String()
	}

	return types.LimitRangeListResponse{
		Age:        age,
		HasUpdated: false,
		Name:       limitRange.Name,
		Namespace:  limitRange.Namespace,
		UID:        string(limitRange.UID),
		Spec: struct {
			LimitCount int `json:"limitCount"`
		}{
			LimitCount: len(limitRange.Spec.Limits),
		},
	}
}

// TransformResourceQuotaToResponse transforms a ResourceQuota to the frontend response format
func TransformResourceQuotaToResponse(quota *v1.ResourceQuota) types.ResourceQuotaListResponse {
	age := ""
	if !quota.CreationTimestamp.IsZero() {
		age = time.Since(quota.CreationTimestamp.Time).String()
	}

	// Convert hard limits to string map
	hard := make(map[string]string)
	for resource, value := range quota.Spec.Hard {
		hard[string(resource)] = value.String()
	}

	// Convert used resources to string map
	used := make(map[string]string)
	for resource, value := range quota.Status.Used {
		used[string(resource)] = value.String()
	}

	return types.ResourceQuotaListResponse{
		Age:        age,
		HasUpdated: false,
		Name:       quota.Name,
		Namespace:  quota.Namespace,
		UID:        string(quota.UID),
		Spec: struct {
			Hard map[string]string `json:"hard"`
		}{
			Hard: hard,
		},
		Status: struct {
			Used map[string]string `json:"used"`
		}{
			Used: used,
		},
	}
}

// TransformPodDisruptionBudgetToResponse transforms a PodDisruptionBudget to the frontend response format
func TransformPodDisruptionBudgetToResponse(pdb *policyV1.PodDisruptionBudget) types.PodDisruptionBudgetListResponse {
	age := ""
	if !pdb.CreationTimestamp.IsZero() {
		age = time.Since(pdb.CreationTimestamp.Time).String()
	}

	minAvailable := ""
	maxUnavailable := ""
	if pdb.Spec.MinAvailable != nil {
		minAvailable = pdb.Spec.MinAvailable.String()
	}
	if pdb.Spec.MaxUnavailable != nil {
		maxUnavailable = pdb.Spec.MaxUnavailable.String()
	}

	return types.PodDisruptionBudgetListResponse{
		Age:        age,
		HasUpdated: false,
		Name:       pdb.Name,
		Namespace:  pdb.Namespace,
		UID:        string(pdb.UID),
		Spec: struct {
			MinAvailable   string `json:"minAvailable"`
			MaxUnavailable string `json:"maxUnavailable"`
		}{
			MinAvailable:   minAvailable,
			MaxUnavailable: maxUnavailable,
		},
		Status: struct {
			CurrentHealthy     int32 `json:"currentHealthy"`
			DesiredHealthy     int32 `json:"desiredHealthy"`
			ExpectedPods       int32 `json:"expectedPods"`
			DisruptionsAllowed int32 `json:"disruptionsAllowed"`
		}{
			CurrentHealthy:     pdb.Status.CurrentHealthy,
			DesiredHealthy:     pdb.Status.DesiredHealthy,
			ExpectedPods:       pdb.Status.ExpectedPods,
			DisruptionsAllowed: pdb.Status.DisruptionsAllowed,
		},
	}
}

// TransformPriorityClassToResponse transforms a PriorityClass to the frontend response format
func TransformPriorityClassToResponse(priorityClass *schedulingV1.PriorityClass) types.PriorityClassListResponse {
	age := ""
	if !priorityClass.CreationTimestamp.IsZero() {
		age = time.Since(priorityClass.CreationTimestamp.Time).String()
	}

	return types.PriorityClassListResponse{
		Age:           age,
		HasUpdated:    false,
		Name:          priorityClass.Name,
		UID:           string(priorityClass.UID),
		Value:         priorityClass.Value,
		GlobalDefault: priorityClass.GlobalDefault,
		Description:   priorityClass.Description,
	}
}

// TransformRuntimeClassToResponse transforms a RuntimeClass to the frontend response format
func TransformRuntimeClassToResponse(runtimeClass *nodeV1.RuntimeClass) types.RuntimeClassListResponse {
	age := ""
	if !runtimeClass.CreationTimestamp.IsZero() {
		age = time.Since(runtimeClass.CreationTimestamp.Time).String()
	}

	return types.RuntimeClassListResponse{
		Age:        age,
		HasUpdated: false,
		Name:       runtimeClass.Name,
		UID:        string(runtimeClass.UID),
		Handler:    runtimeClass.Handler,
	}
}
