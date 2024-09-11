package jobs

import (
	"fmt"
	"github.com/maruel/natural"
	batchV1 "k8s.io/api/batch/v1"
	metaV1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"sort"
	"time"
)

type JobList struct {
	Namespace string    `json:"namespace"`
	Name      string    `json:"name"`
	Age       time.Time `json:"age"`

	Spec   Spec   `json:"spec"`
	Status Status `json:"status"`
}

type Spec struct {
	Completions    *int32 `json:"completions"`
	BackoffLimit   *int32 `json:"backoffLimit"`
	CompletionMode *int32 `json:"completionMode"`
	Suspend        *bool  `json:"suspend"`
}

type Status struct {
	Conditions []Condition  `json:"conditions"`
	Active     int32        `json:"active"`
	Ready      *int32       `json:"ready"`
	Failed     int32        `json:"failed"`
	Succeeded  int32        `json:"succeeded"`
	StartTime  *metaV1.Time `json:"startTime"`
}

type Condition struct {
	Type               string    `json:"type"`
	Status             string    `json:"status"`
	LastProbeTime      time.Time `json:"lastProbeTime"`
	LastTransitionTime time.Time `json:"lastTransitionTime"`
}

type Conditions []Condition

func (c Conditions) Len() int      { return len(c) }
func (c Conditions) Swap(i, j int) { c[i], c[j] = c[j], c[i] }
func (c Conditions) Less(i, j int) bool {
	return c[i].LastTransitionTime.Before(c[j].LastTransitionTime)
}

func TransformJobsList(deployments []batchV1.Job) []JobList {
	list := make([]JobList, 0)

	for _, d := range deployments {
		list = append(list, TransformJobItem(d))
	}

	sort.Slice(list, func(i, j int) bool {
		return natural.Less(fmt.Sprintf("%s-%s", list[i].Name, list[i].Namespace), fmt.Sprintf("%s-%s", list[j].Name, list[j].Namespace))
	})

	return list
}

func TransformJobItem(j batchV1.Job) JobList {
	return JobList{
		Namespace: j.GetNamespace(),
		Name:      j.GetName(),
		Age:       j.CreationTimestamp.Time,
		Spec: Spec{
			Completions:    j.Spec.Completions,
			BackoffLimit:   j.Spec.BackoffLimit,
			CompletionMode: j.Spec.Completions,
			Suspend:        j.Spec.Suspend,
		},

		Status: Status{
			Conditions: getDeploymentCondition(j),
			StartTime:  j.Status.StartTime,
			Active:     j.Status.Active,
			Ready:      j.Status.Ready,
			Failed:     j.Status.Failed,
			Succeeded:  j.Status.Succeeded,
		},
	}
}

func getDeploymentCondition(d batchV1.Job) []Condition {
	conditions := make(Conditions, 0)

	for _, c := range d.Status.Conditions {
		conditions = append(conditions, Condition{
			Type:               string(c.Type),
			Status:             string(c.Status),
			LastProbeTime:      c.LastProbeTime.Time,
			LastTransitionTime: c.LastTransitionTime.Time,
		})
	}
	sort.Sort(conditions)

	return conditions
}
