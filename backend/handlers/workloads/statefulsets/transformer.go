package statefulset

import (
	"fmt"
	"github.com/maruel/natural"
	appsV1 "k8s.io/api/apps/v1"
	"sort"
	"time"
)

type StatefulSetList struct {
	Namespace string    `json:"namespace"`
	Name      string    `json:"name"`
	Status    Status    `json:"status"`
	Age       time.Time `json:"age"`
}

type Status struct {
	Replicas             int32 `json:"replicas"`
	FullyLabeledReplicas int32 `json:"fullyLabeledReplicas"`
	ReadyReplicas        int32 `json:"readyReplicas"`
	AvailableReplicas    int32 `json:"availableReplicas"`
	ObservedGeneration   int64 `json:"observedGeneration"`
}

func TransformStatefulSetList(deployments []appsV1.StatefulSet) []StatefulSetList {
	list := make([]StatefulSetList, 0)

	for _, d := range deployments {
		list = append(list, TransformReplicaSetItem(d))
	}
	sort.Slice(list, func(i, j int) bool {
		return natural.Less(fmt.Sprintf("%s-%s", list[i].Name, list[i].Namespace), fmt.Sprintf("%s-%s", list[j].Name, list[j].Namespace))
	})

	return list
}

func TransformReplicaSetItem(d appsV1.StatefulSet) StatefulSetList {
	return StatefulSetList{
		Namespace: d.GetNamespace(),
		Name:      d.GetName(),
		Status: Status{
			Replicas:           d.Status.Replicas,
			ReadyReplicas:      d.Status.ReadyReplicas,
			AvailableReplicas:  d.Status.AvailableReplicas,
			ObservedGeneration: d.Status.ObservedGeneration,
		},
		Age: d.CreationTimestamp.Time,
	}
}
