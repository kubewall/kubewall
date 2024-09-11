package daemonsets

import (
	"fmt"
	"github.com/maruel/natural"
	"sort"
	"time"

	appV1 "k8s.io/api/apps/v1"
)

type DaemonSetList struct {
	Namespace    string            `json:"namespace"`
	Name         string            `json:"name"`
	Generation   int64             `json:"generation"`
	NodeSelector map[string]string `json:"nodeSelector"`
	Age          time.Time         `json:"age"`
	Status       Status            `json:"status"`
}

type Status struct {
	CurrentNumberScheduled int32 `json:"currentNumberScheduled"`
	NumberMisscheduled     int32 `json:"numberMisscheduled"`
	DesiredNumberScheduled int32 `json:"desiredNumberScheduled"`
	NumberReady            int32 `json:"numberReady"`
	ObservedGeneration     int64 `json:"observedGeneration"`
	UpdatedNumberScheduled int32 `json:"updatedNumberScheduled"`
	NumberAvailable        int32 `json:"numberAvailable"`
}

func TransformDaemonSetList(daemonSets []appV1.DaemonSet) []DaemonSetList {
	list := make([]DaemonSetList, 0)

	for _, d := range daemonSets {
		list = append(list, TransformDaemonSetItem(d))
	}
	sort.Slice(list, func(i, j int) bool {
		return natural.Less(fmt.Sprintf("%s-%s", list[i].Name, list[i].Namespace), fmt.Sprintf("%s-%s", list[j].Name, list[j].Namespace))
	})

	return list
}

func TransformDaemonSetItem(d appV1.DaemonSet) DaemonSetList {
	nodeSelector := make(map[string]string)
	if len(d.Spec.Template.Spec.NodeSelector) > 0 {
		nodeSelector = d.Spec.Template.Spec.NodeSelector
	}
	return DaemonSetList{
		Namespace:    d.GetNamespace(),
		Name:         d.GetName(),
		Generation:   d.Generation,
		NodeSelector: nodeSelector,
		Age:          d.CreationTimestamp.Time,
		Status: Status{
			CurrentNumberScheduled: d.Status.CurrentNumberScheduled,
			NumberMisscheduled:     d.Status.NumberMisscheduled,
			DesiredNumberScheduled: d.Status.DesiredNumberScheduled,
			NumberReady:            d.Status.NumberReady,
			ObservedGeneration:     d.Status.ObservedGeneration,
			UpdatedNumberScheduled: d.Status.UpdatedNumberScheduled,
			NumberAvailable:        d.Status.NumberAvailable,
		},
	}
}
