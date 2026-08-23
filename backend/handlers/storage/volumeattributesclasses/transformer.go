package volumeattributesclasses

import (
	"sort"
	"time"

	"github.com/maruel/natural"
	storageV1 "k8s.io/api/storage/v1"
	"k8s.io/apimachinery/pkg/types"
)

type VolumeAttributesClass struct {
	UID        types.UID `json:"uid"`
	Name       string    `json:"name"`
	Age        time.Time `json:"age"`
	DriverName string    `json:"driverName"`
}

func TransformVolumeAttributesClass(items []storageV1.VolumeAttributesClass) []VolumeAttributesClass {
	list := make([]VolumeAttributesClass, 0)

	for _, d := range items {
		list = append(list, TransformVolumeAttributesClassItem(d))
	}

	sort.Slice(list, func(i, j int) bool {
		return natural.Less(list[i].Name, list[j].Name)
	})

	return list
}

func TransformVolumeAttributesClassItem(item storageV1.VolumeAttributesClass) VolumeAttributesClass {
	return VolumeAttributesClass{
		UID:        item.GetUID(),
		Name:       item.GetName(),
		Age:        item.CreationTimestamp.Time,
		DriverName: item.DriverName,
	}
}
