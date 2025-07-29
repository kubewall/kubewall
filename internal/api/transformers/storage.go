package transformers

import (
	"kubewall-backend/internal/api/types"

	v1 "k8s.io/api/core/v1"
	storageV1 "k8s.io/api/storage/v1"
)

// TransformPVCToResponse transforms a Kubernetes persistent volume claim to the frontend-expected format
func TransformPVCToResponse(pvc *v1.PersistentVolumeClaim) types.PersistentVolumeClaimListResponse {
	age := types.TimeFormat(pvc.CreationTimestamp.Time)

	// Format access modes
	var accessModes []string
	for _, mode := range pvc.Spec.AccessModes {
		accessModes = append(accessModes, string(mode))
	}

	// Format resources
	requests := make(map[string]string)
	limits := make(map[string]string)

	if pvc.Spec.Resources.Requests != nil {
		for resource, quantity := range pvc.Spec.Resources.Requests {
			requests[string(resource)] = quantity.String()
		}
	}

	if pvc.Spec.Resources.Limits != nil {
		for resource, quantity := range pvc.Spec.Resources.Limits {
			limits[string(resource)] = quantity.String()
		}
	}

	// Get storage class name
	storageClassName := ""
	if pvc.Spec.StorageClassName != nil {
		storageClassName = *pvc.Spec.StorageClassName
	}

	// Get volume mode
	volumeMode := ""
	if pvc.Spec.VolumeMode != nil {
		volumeMode = string(*pvc.Spec.VolumeMode)
	}

	return types.PersistentVolumeClaimListResponse{
		Age:        age,
		HasUpdated: false, // This would be set based on resource version comparison
		Name:       pvc.Name,
		Namespace:  pvc.Namespace,
		UID:        string(pvc.UID),
		Spec: struct {
			AccessModes []string `json:"accessModes"`
			Resources   struct {
				Requests map[string]string `json:"requests"`
				Limits   map[string]string `json:"limits"`
			} `json:"resources"`
			StorageClassName string `json:"storageClassName"`
			VolumeMode       string `json:"volumeMode"`
		}{
			AccessModes: accessModes,
			Resources: struct {
				Requests map[string]string `json:"requests"`
				Limits   map[string]string `json:"limits"`
			}{
				Requests: requests,
				Limits:   limits,
			},
			StorageClassName: storageClassName,
			VolumeMode:       volumeMode,
		},
		Status: struct {
			Phase string `json:"phase"`
		}{
			Phase: string(pvc.Status.Phase),
		},
	}
}

// TransformPVToResponse transforms a Kubernetes persistent volume to the frontend-expected format
func TransformPVToResponse(pv *v1.PersistentVolume) types.PersistentVolumeListResponse {
	age := types.TimeFormat(pv.CreationTimestamp.Time)

	// Format access modes
	var accessModes []string
	for _, mode := range pv.Spec.AccessModes {
		accessModes = append(accessModes, string(mode))
	}

	// Format capacity
	capacity := make(map[string]string)
	for resource, quantity := range pv.Spec.Capacity {
		capacity[string(resource)] = quantity.String()
	}

	// Get storage class name
	storageClassName := ""
	if pv.Spec.StorageClassName != "" {
		storageClassName = pv.Spec.StorageClassName
	}

	// Get volume mode
	volumeMode := ""
	if pv.Spec.VolumeMode != nil {
		volumeMode = string(*pv.Spec.VolumeMode)
	}

	return types.PersistentVolumeListResponse{
		Age:        age,
		HasUpdated: false, // This would be set based on resource version comparison
		Name:       pv.Name,
		UID:        string(pv.UID),
		Spec: struct {
			Capacity         map[string]string `json:"capacity"`
			AccessModes      []string          `json:"accessModes"`
			StorageClassName string            `json:"storageClassName"`
			VolumeMode       string            `json:"volumeMode"`
		}{
			Capacity:         capacity,
			AccessModes:      accessModes,
			StorageClassName: storageClassName,
			VolumeMode:       volumeMode,
		},
		Status: struct {
			Phase string `json:"phase"`
		}{
			Phase: string(pv.Status.Phase),
		},
	}
}

// TransformStorageClassToResponse transforms a Kubernetes storage class to the frontend-expected format
func TransformStorageClassToResponse(sc *storageV1.StorageClass) types.StorageClassListResponse {
	age := types.TimeFormat(sc.CreationTimestamp.Time)

	return types.StorageClassListResponse{
		Age:        age,
		HasUpdated: false, // This would be set based on resource version comparison
		Name:       sc.Name,
		UID:        string(sc.UID),
		Spec: struct {
			Provisioner string `json:"provisioner"`
		}{
			Provisioner: sc.Provisioner,
		},
	}
}
