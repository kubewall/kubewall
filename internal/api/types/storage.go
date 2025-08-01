package types

// PersistentVolumeClaimListResponse represents a persistent volume claim in the list view
type PersistentVolumeClaimListResponse struct {
	Age        string `json:"age"`
	HasUpdated bool   `json:"hasUpdated"`
	Name       string `json:"name"`
	Namespace  string `json:"namespace"`
	UID        string `json:"uid"`
	Spec       struct {
		AccessModes []string `json:"accessModes"`
		Resources   struct {
			Requests map[string]string `json:"requests"`
			Limits   map[string]string `json:"limits"`
		} `json:"resources"`
		StorageClassName string `json:"storageClassName"`
		VolumeMode       string `json:"volumeMode"`
	} `json:"spec"`
	Status struct {
		Phase string `json:"phase"`
	} `json:"status"`
}

// PersistentVolumeListResponse represents a persistent volume in the list view
type PersistentVolumeListResponse struct {
	Age        string `json:"age"`
	HasUpdated bool   `json:"hasUpdated"`
	Name       string `json:"name"`
	UID        string `json:"uid"`
	Spec       struct {
		Capacity         map[string]string `json:"capacity"`
		AccessModes      []string          `json:"accessModes"`
		StorageClassName string            `json:"storageClassName"`
		VolumeMode       string            `json:"volumeMode"`
	} `json:"spec"`
	Status struct {
		Phase string `json:"phase"`
	} `json:"status"`
}

// StorageClassListResponse represents a storage class in the list view
type StorageClassListResponse struct {
	Age               string `json:"age"`
	HasUpdated        bool   `json:"hasUpdated"`
	Name              string `json:"name"`
	UID               string `json:"uid"`
	Provisioner       string `json:"provisioner"`
	ReclaimPolicy     string `json:"reclaimPolicy"`
	VolumeBindingMode string `json:"VolumeBindingMode"`
}
