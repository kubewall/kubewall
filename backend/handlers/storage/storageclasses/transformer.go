package storageclasses

import (
	"fmt"
	"github.com/maruel/natural"
	v1 "k8s.io/api/core/v1"
	storageV1 "k8s.io/api/storage/v1"
	"sort"
	"time"
)

type StorageClass struct {
	Namespace         string                            `json:"namespace"`
	Name              string                            `json:"name"`
	Age               time.Time                         `json:"age"`
	Provisioner       string                            `json:"provisioner"`
	ReclaimPolicy     *v1.PersistentVolumeReclaimPolicy `json:"reclaimPolicy"`
	VolumeBindingMode *storageV1.VolumeBindingMode      `json:"VolumeBindingMode"`
}

func TransformStorageClass(items []storageV1.StorageClass) []StorageClass {
	list := make([]StorageClass, 0)

	for _, d := range items {
		list = append(list, TransformStorageClassItem(d))
	}

	sort.Slice(list, func(i, j int) bool {
		return natural.Less(fmt.Sprintf("%s-%s", list[i].Name, list[i].Namespace), fmt.Sprintf("%s-%s", list[j].Name, list[j].Namespace))
	})

	return list
}

func TransformStorageClassItem(item storageV1.StorageClass) StorageClass {
	return StorageClass{
		Namespace:         item.GetNamespace(),
		Name:              item.GetName(),
		Provisioner:       item.Provisioner,
		ReclaimPolicy:     item.ReclaimPolicy,
		VolumeBindingMode: item.VolumeBindingMode,
		Age:               item.CreationTimestamp.Time,
	}
}
