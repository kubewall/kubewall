package limitranges

import (
	"fmt"
	"sort"
	"time"

	"github.com/maruel/natural"
	"k8s.io/apimachinery/pkg/types"

	v1 "k8s.io/api/core/v1"
)

type LimitRange struct {
	UID       types.UID `json:"uid"`
	Namespace string    `json:"namespace"`
	Name      string    `json:"name"`
	Spec      Spec      `json:"spec"`
	Age       time.Time `json:"age"`
}

type Spec struct {
	LimitCount int `json:"limitCount"`
}

func TransformLimitRange(secrets []v1.LimitRange) []LimitRange {
	list := make([]LimitRange, 0)

	for _, d := range secrets {
		list = append(list, TransformLimitRangeItem(d))
	}

	sort.Slice(list, func(i, j int) bool {
		return natural.Less(fmt.Sprintf("%s-%s", list[i].Name, list[i].Namespace), fmt.Sprintf("%s-%s", list[j].Name, list[j].Namespace))
	})

	return list
}

func TransformLimitRangeItem(item v1.LimitRange) LimitRange {
	return LimitRange{
		UID:       item.GetUID(),
		Namespace: item.GetNamespace(),
		Name:      item.GetName(),
		Spec: Spec{
			LimitCount: len(item.Spec.Limits),
		},
		Age: item.CreationTimestamp.Time,
	}
}
