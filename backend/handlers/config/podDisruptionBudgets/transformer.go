package poddisruptionbudgets

import (
	"fmt"
	"github.com/maruel/natural"
	policyV1 "k8s.io/api/policy/v1"
	"sort"
	"time"
)

type PodDisruptionBudget struct {
	Namespace string    `json:"namespace"`
	Name      string    `json:"name"`
	Spec      Spec      `json:"spec"`
	Status    Status    `json:"status"`
	Age       time.Time `json:"age"`
}

type Spec struct {
	MinAvailable   string `json:"minAvailable"`
	MaxUnavailable string `json:"maxUnavailable"`
}

type Status struct {
	CurrentHealthy int32 `json:"currentHealthy"`
}

func TransformPodDisruptionBudget(items []policyV1.PodDisruptionBudget) []PodDisruptionBudget {
	list := make([]PodDisruptionBudget, 0)

	for _, d := range items {
		list = append(list, TransformPodDisruptionBudgetItem(d))
	}

	sort.Slice(list, func(i, j int) bool {
		return natural.Less(fmt.Sprintf("%s-%s", list[i].Name, list[i].Namespace), fmt.Sprintf("%s-%s", list[j].Name, list[j].Namespace))
	})

	return list
}

func TransformPodDisruptionBudgetItem(item policyV1.PodDisruptionBudget) PodDisruptionBudget {
	var minAvailable string
	if item.Spec.MinAvailable != nil {
		minAvailable = item.Spec.MinAvailable.StrVal
	}
	var maxUnavailable string
	if item.Spec.MaxUnavailable != nil {
		minAvailable = item.Spec.MaxUnavailable.StrVal
	}

	return PodDisruptionBudget{
		Namespace: item.GetNamespace(),
		Name:      item.GetName(),
		Spec: Spec{
			MinAvailable:   fmt.Sprintf("%s", minAvailable),
			MaxUnavailable: fmt.Sprintf("%s", maxUnavailable),
		},
		Status: Status{
			CurrentHealthy: item.Status.CurrentHealthy,
		},
		Age: item.CreationTimestamp.Time,
	}
}
