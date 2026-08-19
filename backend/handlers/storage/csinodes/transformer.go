package csinodes

import (
	"sort"
	"strings"
	"time"

	"github.com/maruel/natural"
	storageV1 "k8s.io/api/storage/v1"
	"k8s.io/apimachinery/pkg/types"
)

type CSINode struct {
	UID     types.UID `json:"uid"`
	Name    string    `json:"name"`
	Age     time.Time `json:"age"`
	Drivers string    `json:"drivers"`
}

func TransformCSINode(items []storageV1.CSINode) []CSINode {
	list := make([]CSINode, 0)

	for _, d := range items {
		list = append(list, TransformCSINodeItem(d))
	}

	sort.Slice(list, func(i, j int) bool {
		return natural.Less(list[i].Name, list[j].Name)
	})

	return list
}

func TransformCSINodeItem(item storageV1.CSINode) CSINode {
	// kubectl prints a bare count here; the driver names are what tells you
	// whether the node actually registered the driver you are looking for.
	drivers := make([]string, 0, len(item.Spec.Drivers))
	for _, driver := range item.Spec.Drivers {
		drivers = append(drivers, driver.Name)
	}

	return CSINode{
		UID:     item.GetUID(),
		Name:    item.GetName(),
		Age:     item.CreationTimestamp.Time,
		Drivers: strings.Join(drivers, ", "),
	}
}
