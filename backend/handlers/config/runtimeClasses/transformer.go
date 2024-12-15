package runtimeclasses

import (
	"fmt"
	"sort"
	"time"

	"github.com/maruel/natural"
	v1 "k8s.io/api/node/v1"
	"k8s.io/apimachinery/pkg/types"
)

type RunTimeClass struct {
	UID       types.UID `json:"uid"`
	Namespace string    `json:"namespace"`
	Name      string    `json:"name"`
	Handler   string    `json:"handler"`
	Age       time.Time `json:"age"`
}

func TransformRunTimeClassList(secrets []v1.RuntimeClass) []RunTimeClass {
	list := make([]RunTimeClass, 0)

	for _, d := range secrets {
		list = append(list, TransformRunTimeClassItem(d))
	}

	sort.Slice(list, func(i, j int) bool {
		return natural.Less(fmt.Sprintf("%s-%s", list[i].Name, list[i].Namespace), fmt.Sprintf("%s-%s", list[j].Name, list[j].Namespace))
	})

	return list
}

func TransformRunTimeClassItem(item v1.RuntimeClass) RunTimeClass {
	return RunTimeClass{
		UID:       item.GetUID(),
		Namespace: item.GetNamespace(),
		Name:      item.GetName(),
		Handler:   item.Handler,
		Age:       item.CreationTimestamp.Time,
	}
}
