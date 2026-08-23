package csidrivers

import (
	"sort"
	"strings"
	"time"

	"github.com/maruel/natural"
	storageV1 "k8s.io/api/storage/v1"
	"k8s.io/apimachinery/pkg/types"
)

type CSIDriver struct {
	UID             types.UID `json:"uid"`
	Name            string    `json:"name"`
	Age             time.Time `json:"age"`
	AttachRequired  *bool     `json:"attachRequired"`
	PodInfoOnMount  *bool     `json:"podInfoOnMount"`
	StorageCapacity *bool     `json:"storageCapacity"`
	Modes           string    `json:"modes"`
}

func TransformCSIDriver(items []storageV1.CSIDriver) []CSIDriver {
	list := make([]CSIDriver, 0)

	for _, d := range items {
		list = append(list, TransformCSIDriverItem(d))
	}

	sort.Slice(list, func(i, j int) bool {
		return natural.Less(list[i].Name, list[j].Name)
	})

	return list
}

func TransformCSIDriverItem(item storageV1.CSIDriver) CSIDriver {
	modes := make([]string, 0, len(item.Spec.VolumeLifecycleModes))
	for _, mode := range item.Spec.VolumeLifecycleModes {
		modes = append(modes, string(mode))
	}

	return CSIDriver{
		UID:             item.GetUID(),
		Name:            item.GetName(),
		Age:             item.CreationTimestamp.Time,
		AttachRequired:  item.Spec.AttachRequired,
		PodInfoOnMount:  item.Spec.PodInfoOnMount,
		StorageCapacity: item.Spec.StorageCapacity,
		Modes:           strings.Join(modes, ", "),
	}
}
