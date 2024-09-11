package priorityclasses

import (
	"fmt"
	"github.com/maruel/natural"
	v1 "k8s.io/api/core/v1"
	v12 "k8s.io/api/scheduling/v1"
	"sort"
	"time"
)

type PriorityClass struct {
	Namespace        string               `json:"namespace"`
	Name             string               `json:"name"`
	Value            int32                `json:"value"`
	GlobalDefault    bool                 `json:"globalDefault"`
	PreemptionPolicy *v1.PreemptionPolicy `json:"preemptionPolicy"`
	Age              time.Time            `json:"age"`
}

func TransformPriorityClassList(secrets []v12.PriorityClass) []PriorityClass {
	list := make([]PriorityClass, 0)

	for _, d := range secrets {
		list = append(list, TransformPriorityClassItem(d))
	}

	sort.Slice(list, func(i, j int) bool {
		return natural.Less(fmt.Sprintf("%s-%s", list[i].Name, list[i].Namespace), fmt.Sprintf("%s-%s", list[j].Name, list[j].Namespace))
	})

	return list
}

func TransformPriorityClassItem(item v12.PriorityClass) PriorityClass {
	return PriorityClass{
		Namespace:        item.GetNamespace(),
		Name:             item.GetName(),
		Value:            item.Value,
		GlobalDefault:    item.GlobalDefault,
		PreemptionPolicy: item.PreemptionPolicy,
		Age:              item.CreationTimestamp.Time,
	}
}
