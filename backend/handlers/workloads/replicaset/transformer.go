package replicaset

import (
	"fmt"
	"github.com/maruel/natural"
	v1 "k8s.io/api/apps/v1"
	"sort"
	"time"
)

type ReplicaSetList struct {
	Namespace string    `json:"namespace"`
	Name      string    `json:"name"`
	Spec      Spec      `json:"spec"`
	Status    Status    `json:"status"`
	Age       time.Time `json:"age"`
}

type Spec struct {
	Replicas int `json:"replicas"`
}

type Status struct {
	Replicas             int32 `json:"replicas"`
	FullyLabeledReplicas int32 `json:"fullyLabeledReplicas"`
	ReadyReplicas        int32 `json:"readyReplicas"`
	AvailableReplicas    int32 `json:"availableReplicas"`
	ObservedGeneration   int64 `json:"observedGeneration"`
}

func TransformReplicaSetList(deployments []v1.ReplicaSet) []ReplicaSetList {
	list := make([]ReplicaSetList, 0)

	for _, d := range deployments {
		list = append(list, TransformReplicaSetItem(d))
	}

	sort.Slice(list, func(i, j int) bool {
		return natural.Less(fmt.Sprintf("%s-%s", list[i].Name, list[i].Namespace), fmt.Sprintf("%s-%s", list[j].Name, list[j].Namespace))
	})

	return list
}

func TransformReplicaSetItem(d v1.ReplicaSet) ReplicaSetList {
	specReplicas := 0
	if d.Spec.Replicas != nil {
		specReplicas = int(*d.Spec.Replicas)
	}

	return ReplicaSetList{
		Namespace: d.GetNamespace(),
		Name:      d.GetName(),
		Spec: Spec{
			Replicas: specReplicas,
		},
		Status: Status{
			Replicas:             d.Status.Replicas,
			FullyLabeledReplicas: d.Status.FullyLabeledReplicas,
			ReadyReplicas:        d.Status.ReadyReplicas,
			AvailableReplicas:    d.Status.AvailableReplicas,
			ObservedGeneration:   d.Status.ObservedGeneration,
		},
		Age: d.CreationTimestamp.Time,
	}
}
