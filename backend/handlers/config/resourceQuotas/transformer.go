package resourcequotas

import (
	"fmt"
	"sort"
	"time"

	"github.com/maruel/natural"
	"k8s.io/apimachinery/pkg/types"

	v1 "k8s.io/api/core/v1"
)

type ResourceQuota struct {
	UID       types.UID `json:"uid"`
	Namespace string    `json:"namespace"`
	Name      string    `json:"name"`
	Age       time.Time `json:"age"`
}

func TransformLimitRange(items []v1.ResourceQuota) []ResourceQuota {
	list := make([]ResourceQuota, 0)

	for _, d := range items {
		list = append(list, TransformLimitRangeItem(d))
	}

	sort.Slice(list, func(i, j int) bool {
		return natural.Less(fmt.Sprintf("%s-%s", list[i].Name, list[i].Namespace), fmt.Sprintf("%s-%s", list[j].Name, list[j].Namespace))
	})

	return list
}

func TransformLimitRangeItem(item v1.ResourceQuota) ResourceQuota {
	return ResourceQuota{
		UID:       item.GetUID(),
		Namespace: item.GetNamespace(),
		Name:      item.GetName(),
		Age:       item.CreationTimestamp.Time,
	}
}
