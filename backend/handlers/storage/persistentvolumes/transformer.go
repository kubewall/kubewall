package persistentvolumes

import (
	"fmt"
	"github.com/maruel/natural"
	v1 "k8s.io/api/core/v1"
	"sort"
	"time"
)

type PVList struct {
	Namespace string    `json:"namespace"`
	Name      string    `json:"name"`
	Age       time.Time `json:"age"`
	Spec      Spec      `json:"spec"`
	Status    Status    `json:"status"`
}

type Spec struct {
	StorageClassName string                   `json:"storageClassName"`
	VolumeMode       *v1.PersistentVolumeMode `json:"volumeMode"`
	ClaimRef         string                   `json:"claimRef"`
}

type Status struct {
	Phase string `json:"phase"`
}

func TransformPersistentVolumeList(pvs []v1.PersistentVolume) []PVList {
	list := make([]PVList, 0)

	for _, d := range pvs {
		list = append(list, TransformPersistentVolumeItem(d))
	}

	sort.Slice(list, func(i, j int) bool {
		return natural.Less(fmt.Sprintf("%s-%s", list[i].Name, list[i].Namespace), fmt.Sprintf("%s-%s", list[j].Name, list[j].Namespace))
	})

	return list
}

func TransformPersistentVolumeItem(pv v1.PersistentVolume) PVList {
	var claimRef string
	if pv.Spec.ClaimRef != nil {
		claimRef = pv.Spec.ClaimRef.Name
	}

	return PVList{
		Namespace: pv.GetNamespace(),
		Name:      pv.GetName(),
		Age:       pv.CreationTimestamp.Time,
		Spec: Spec{
			ClaimRef:         claimRef,
			StorageClassName: pv.Spec.StorageClassName,
			VolumeMode:       pv.Spec.VolumeMode,
		},
		Status: Status{
			Phase: string(pv.Status.Phase),
		},
	}
}
