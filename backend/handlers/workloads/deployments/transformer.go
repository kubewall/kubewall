package deployments

import (
	"fmt"
	"github.com/maruel/natural"
	"sort"
	"time"

	appV1 "k8s.io/api/apps/v1"
)

type DeploymentList struct {
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
	ObservedGeneration int64       `json:"observedGeneration"`
	Replicas           int32       `json:"replicas"`
	UpdatedReplicas    int32       `json:"updatedReplicas"`
	ReadyReplicas      int32       `json:"readyReplicas"`
	AvailableReplicas  int32       `json:"availableReplicas"`
	Conditions         []Condition `json:"conditions"`
}

type Condition struct {
	Type               string    `json:"type"`
	Status             string    `json:"status"`
	LastTransitionTime time.Time `json:"lastTransitionTime"`
}

type Conditions []Condition

func (c Conditions) Len() int      { return len(c) }
func (c Conditions) Swap(i, j int) { c[i], c[j] = c[j], c[i] }
func (c Conditions) Less(i, j int) bool {
	return c[i].LastTransitionTime.Before(c[j].LastTransitionTime)
}

func TransformDeploymentList(deployments []appV1.Deployment) []DeploymentList {
	list := make([]DeploymentList, 0)

	for _, d := range deployments {
		list = append(list, TransformDeploymentItem(d))
	}

	sort.Slice(list, func(i, j int) bool {
		return natural.Less(fmt.Sprintf("%s-%s", list[i].Name, list[i].Namespace), fmt.Sprintf("%s-%s", list[j].Name, list[j].Namespace))
	})

	return list
}

func TransformDeploymentItem(d appV1.Deployment) DeploymentList {
	specReplicas := 0
	if d.Spec.Replicas != nil {
		specReplicas = int(*d.Spec.Replicas)
	}
	return DeploymentList{
		Namespace: d.GetNamespace(),
		Name:      d.GetName(),
		Spec: Spec{
			Replicas: specReplicas,
		},
		Status: Status{
			ObservedGeneration: d.Status.ObservedGeneration,
			Replicas:           d.Status.Replicas,
			UpdatedReplicas:    d.Status.UpdatedReplicas,
			ReadyReplicas:      d.Status.ReadyReplicas,
			AvailableReplicas:  d.Status.AvailableReplicas,
			Conditions:         getDeploymentCondition(d),
		},
		Age: d.CreationTimestamp.Time,
	}
}

func getDeploymentCondition(d appV1.Deployment) []Condition {
	conditions := make(Conditions, 0)

	for _, c := range d.Status.Conditions {
		if c.Status == "True" {
			conditions = append(conditions, Condition{
				Type:               string(c.Type),
				Status:             string(c.Status),
				LastTransitionTime: c.LastUpdateTime.Time,
			})
		}
	}
	sort.Sort(conditions)

	return conditions
}
