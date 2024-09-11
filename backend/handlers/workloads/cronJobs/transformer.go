package cronjobs

import (
	"fmt"
	"github.com/maruel/natural"
	appV1 "k8s.io/api/batch/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"sort"
	"time"
)

type CronJobsList struct {
	Namespace string    `json:"namespace"`
	Name      string    `json:"name"`
	Age       time.Time `json:"age"`
	Spec      Spec      `json:"spec"`
	Status    Status    `json:"status"`
}

type Spec struct {
	Schedule                   string `json:"schedule"`
	ConcurrencyPolicy          string `json:"concurrencyPolicy"`
	Suspend                    *bool  `json:"suspend"`
	SuccessfulJobsHistoryLimit *int32 `json:"successfulJobsHistoryLimit"`
	FailedJobsHistoryLimit     *int32 `json:"failedJobsHistoryLimit"`
}

type Status struct {
	Active             int          `json:"active"`
	LastScheduleTime   *metav1.Time `json:"lastScheduleTime"`
	LastSuccessfulTime *metav1.Time `json:"lastSuccessfulTime"`
}

func TransformCronJobsList(cronJobs []appV1.CronJob) []CronJobsList {
	list := make([]CronJobsList, 0)

	for _, d := range cronJobs {
		list = append(list, TransConfigMapsItem(d))
	}

	sort.Slice(list, func(i, j int) bool {
		return natural.Less(fmt.Sprintf("%s-%s", list[i].Name, list[i].Namespace), fmt.Sprintf("%s-%s", list[j].Name, list[j].Namespace))
	})

	return list
}

func TransConfigMapsItem(configMap appV1.CronJob) CronJobsList {
	return CronJobsList{
		Namespace: configMap.GetNamespace(),
		Name:      configMap.GetName(),
		Age:       configMap.CreationTimestamp.Time,
		Spec: Spec{
			Schedule:                   configMap.Spec.Schedule,
			ConcurrencyPolicy:          string(configMap.Spec.ConcurrencyPolicy),
			Suspend:                    configMap.Spec.Suspend,
			SuccessfulJobsHistoryLimit: configMap.Spec.SuccessfulJobsHistoryLimit,
			FailedJobsHistoryLimit:     configMap.Spec.FailedJobsHistoryLimit,
		},
		Status: Status{
			Active:             len(configMap.Status.Active),
			LastScheduleTime:   configMap.Status.LastSuccessfulTime,
			LastSuccessfulTime: configMap.Status.LastSuccessfulTime,
		},
	}
}
