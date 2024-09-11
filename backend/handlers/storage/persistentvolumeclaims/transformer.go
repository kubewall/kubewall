package persistentvolumeclaims

import (
	"fmt"
	"github.com/maruel/natural"
	"sort"
	"time"

	coreV1 "k8s.io/api/core/v1"
)

type PVCList struct {
	Namespace string    `json:"namespace"`
	Name      string    `json:"name"`
	Age       time.Time `json:"age"`
	Spec      Spec      `json:"spec"`
	Status    Status    `json:"status"`
}

type Spec struct {
	VolumeName       string                       `json:"volumeName"`
	StorageClassName *string                      `json:"storageClassName"`
	VolumeMode       *coreV1.PersistentVolumeMode `json:"volumeMode"`
	Storage          string                       `json:"storage"`
}

type Status struct {
	Phase string `json:"phase"`
}

func TransformPersistentVolumeClaimsList(pvcs []coreV1.PersistentVolumeClaim) []PVCList {
	list := make([]PVCList, 0)

	for _, d := range pvcs {
		list = append(list, TransformPersistentVolumeClaimItems(d))
	}

	sort.Slice(list, func(i, j int) bool {
		return natural.Less(fmt.Sprintf("%s-%s", list[i].Name, list[i].Namespace), fmt.Sprintf("%s-%s", list[j].Name, list[j].Namespace))
	})

	return list
}

func TransformPersistentVolumeClaimItems(pvc coreV1.PersistentVolumeClaim) PVCList {
	var storage string

	if pvc.Spec.Resources.Requests.Storage() != nil {
		storage = pvc.Spec.Resources.Requests.Storage().String()
	}

	return PVCList{
		Namespace: pvc.GetNamespace(),
		Name:      pvc.GetName(),
		Age:       pvc.CreationTimestamp.Time,
		Spec: Spec{
			VolumeName:       pvc.Spec.VolumeName,
			StorageClassName: pvc.Spec.StorageClassName,
			VolumeMode:       pvc.Spec.VolumeMode,
			Storage:          storage,
		},
		Status: Status{
			Phase: string(pvc.Status.Phase),
		},
	}
}
