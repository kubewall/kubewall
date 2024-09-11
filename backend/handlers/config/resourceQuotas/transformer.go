package resourcequotas

import (
	"fmt"
	"github.com/maruel/natural"
	"sort"
	"time"

	v1 "k8s.io/api/core/v1"
)

type ResourceQuota struct {
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
		Namespace: item.GetNamespace(),
		Name:      item.GetName(),
		Age:       item.CreationTimestamp.Time,
	}
}
