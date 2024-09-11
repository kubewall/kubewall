package horizontalpodautoscalers

import (
	"fmt"
	"github.com/maruel/natural"
	"sort"
	"time"

	autoScalingV2 "k8s.io/api/autoscaling/v2"
)

type ResourceQuota struct {
	Namespace string    `json:"namespace"`
	Name      string    `json:"name"`
	Spec      Spec      `json:"spec"`
	Age       time.Time `json:"age"`
}

type Spec struct {
	MinPods *int32 `json:"minPods"`
	MaxPods int32  `json:"maxPods"`
}

func TransformHorizontalPodAutoscaler(items []autoScalingV2.HorizontalPodAutoscaler) []ResourceQuota {
	list := make([]ResourceQuota, 0)

	for _, d := range items {
		list = append(list, TransformLimitRangeItem(d))
	}

	sort.Slice(list, func(i, j int) bool {
		return natural.Less(fmt.Sprintf("%s-%s", list[i].Name, list[i].Namespace), fmt.Sprintf("%s-%s", list[j].Name, list[j].Namespace))
	})

	return list
}

func TransformLimitRangeItem(item autoScalingV2.HorizontalPodAutoscaler) ResourceQuota {
	return ResourceQuota{
		Namespace: item.GetNamespace(),
		Name:      item.GetName(),
		Spec: Spec{
			MinPods: item.Spec.MinReplicas,
			MaxPods: item.Spec.MaxReplicas,
		},
		Age: item.CreationTimestamp.Time,
	}
}
