package pods

import (
	"fmt"
	"github.com/maruel/natural"
	"k8s.io/apimachinery/pkg/api/resource"
	"k8s.io/metrics/pkg/apis/metrics/v1beta1"
	"sort"
	"time"

	coreV1 "k8s.io/api/core/v1"
)

type PodList struct {
	Namespace     string    `json:"namespace"`
	Name          string    `json:"name"`
	Node          string    `json:"node"`
	Ready         string    `json:"ready"`
	Status        string    `json:"status"`
	CPU           string    `json:"cpu"`
	Memory        string    `json:"memory"`
	Restarts      string    `json:"restarts"`
	LastRestartAt string    `json:"lastRestartAt"`
	PodIP         string    `json:"podIP"`
	Qos           string    `json:"qos"`
	Age           time.Time `json:"age"`
	HasUpdated    bool      `json:"hasUpdated"`
}

func TransformPodList(pods []coreV1.Pod, podMetricsList *v1beta1.PodMetricsList) []PodList {
	list := make([]PodList, 0)
	podsMetricsMap := GetPodsMetrics(podMetricsList)

	for _, p := range pods {
		item := TransformPodListItem(p)
		item.CPU = podsMetricsMap[item.Name]["cpu"]
		item.Memory = podsMetricsMap[item.Name]["memory"]

		list = append(list, item)
	}

	sort.Slice(list, func(i, j int) bool {
		return natural.Less(fmt.Sprintf("%s-%s", list[i].Name, list[i].Namespace), fmt.Sprintf("%s-%s", list[j].Name, list[j].Namespace))
	})

	return list
}

func GetPodsMetrics(podMetrics *v1beta1.PodMetricsList) map[string]map[string]string {
	podsMetrics := make(map[string]map[string]string)

	if podMetrics == nil {
		return podsMetrics
	}

	for _, podMetric := range podMetrics.Items {
		podsMetrics[podMetric.Name] = make(map[string]string)
		// Initialize totals for CPU and memory usage
		totalCPUUsage := resource.NewQuantity(0, resource.DecimalSI)
		totalMemoryUsage := resource.NewQuantity(0, resource.BinarySI)

		// Iterate over each container in the pod and aggregate the metrics
		for _, container := range podMetric.Containers {
			cpuUsage := container.Usage["cpu"]
			memoryUsage := container.Usage["memory"]

			totalCPUUsage.Add(cpuUsage)
			totalMemoryUsage.Add(memoryUsage)
		}
		podsMetrics[podMetric.Name]["cpu"] = fmt.Sprintf("%f", totalCPUUsage.AsApproximateFloat64())
		podsMetrics[podMetric.Name]["memory"] = fmt.Sprintf("%.2f", totalMemoryUsage.AsApproximateFloat64()/(1<<20))
	}
	return podsMetrics
}

func TransformPodListItem(pod coreV1.Pod) PodList {
	status, _ := GetPodStatusReason(&pod)
	return PodList{
		Namespace:     pod.GetNamespace(),
		Name:          pod.GetName(),
		Node:          pod.Spec.NodeName,
		Ready:         getPodReadyStatus(pod),
		Status:        status,
		Restarts:      fmt.Sprintf("%d", restartCount(pod)),
		LastRestartAt: lastRestartTime(pod),
		Qos:           string(pod.Status.QOSClass),
		PodIP:         pod.Status.PodIP,
		Age:           pod.CreationTimestamp.Time,
		HasUpdated:    hasUpdated(pod),
	}
}

func lastRestartTime(pod coreV1.Pod) string {
	for _, containerStatus := range pod.Status.ContainerStatuses {
		if containerStatus.RestartCount > 0 {
			if containerStatus.LastTerminationState.Terminated != nil {
				return containerStatus.LastTerminationState.Terminated.StartedAt.Time.Format("2006-01-02T15:04:05-07:00")
			}
		}
	}
	return ""
}

func hasUpdated(pod coreV1.Pod) bool {
	now := time.Now()

	for _, n := range pod.Status.Conditions {
		if now.Sub(n.LastTransitionTime.Time).Seconds() < 2 {
			return true
		}
	}

	return false
}

// GetPodStatusReason reference: https://github.com/kubernetes/kubernetes/blob/e8fcd0de98d50f4019561a6b7a0287f5c059267a/pkg/printers/internalversion/printers.go#L741
func GetPodStatusReason(pod *coreV1.Pod) (string, string) {
	reason := string(pod.Status.Phase)
	// message is used to store more detailed information about the pod status
	message := ""
	if pod.Status.Reason != "" {
		reason = pod.Status.Reason
	}

	initializing := false
	for i := range pod.Status.InitContainerStatuses {
		container := pod.Status.InitContainerStatuses[i]
		switch {
		case container.State.Terminated != nil && container.State.Terminated.ExitCode == 0:
			continue
		case container.State.Terminated != nil:
			// initialization is failed
			if len(container.State.Terminated.Reason) == 0 {
				if container.State.Terminated.Signal != 0 {
					reason = fmt.Sprintf("Init:Signal:%d", container.State.Terminated.Signal)
				} else {
					reason = fmt.Sprintf("Init:ExitCode:%d", container.State.Terminated.ExitCode)
				}
			} else {
				reason = "Init:" + container.State.Terminated.Reason
			}
			initializing = true
		case container.State.Waiting != nil && len(container.State.Waiting.Reason) > 0 && container.State.Waiting.Reason != "PodInitializing":
			reason = "Init:" + container.State.Waiting.Reason
			initializing = true
		default:
			reason = fmt.Sprintf("Init:%d/%d", i, len(pod.Spec.InitContainers))
			initializing = true
		}

		if container.LastTerminationState.Terminated != nil && container.LastTerminationState.Terminated.Message != "" {
			message += container.LastTerminationState.Terminated.Message
		}
		break
	}
	if !initializing {
		hasRunning := false

		for i := len(pod.Status.ContainerStatuses) - 1; i >= 0; i-- {
			container := pod.Status.ContainerStatuses[i]

			if container.State.Waiting != nil && container.State.Waiting.Reason != "" {
				reason = container.State.Waiting.Reason
				if container.LastTerminationState.Terminated != nil {
					// if the container is terminated, we should use the message from the last termination state
					// if no message from the last termination state, we should use the exit code
					if container.LastTerminationState.Terminated.Message != "" {
						message += container.LastTerminationState.Terminated.Message
					} else {
						message += fmt.Sprintf("ExitCode:%d", container.LastTerminationState.Terminated.ExitCode)
					}
				}
			} else if container.State.Terminated != nil && container.State.Terminated.Reason != "" {
				reason = container.State.Terminated.Reason
				// add message from the last termination exit code
				message += fmt.Sprintf("ExitCode:%d", container.State.Terminated.ExitCode)
			} else if container.State.Terminated != nil && container.State.Terminated.Reason == "" {
				// no extra message from the last termination state, since the signal or exit code is used as the reason
				if container.State.Terminated.Signal != 0 {
					reason = fmt.Sprintf("Signal:%d", container.State.Terminated.Signal)
				} else {
					reason = fmt.Sprintf("ExitCode:%d", container.State.Terminated.ExitCode)
				}
			} else if container.Ready && container.State.Running != nil {
				hasRunning = true
			}
		}

		// change pod status back to "Running" if there is at least one container still reporting as "Running" status
		if reason == "Completed" && hasRunning {
			if hasPodReadyCondition(pod.Status.Conditions) {
				reason = "Running"
			} else {
				reason = "NotReady"
			}
		}

		// if the pod is not running, check if there is any pod condition reporting as "False" status
		if len(pod.Status.Conditions) > 0 {
			for condition := range pod.Status.Conditions {
				if pod.Status.Conditions[condition].Type == coreV1.PodScheduled && pod.Status.Conditions[condition].Status == coreV1.ConditionFalse {
					message += pod.Status.Conditions[condition].Message
				}
			}
		}
	}

	// "NodeLost" is originally k8s.io/kubernetes/pkg/util/node.NodeUnreachablePodReason but didn't wanna import all of kubernetes package just for this type
	if pod.DeletionTimestamp != nil && pod.Status.Reason == "NodeLost" {
		reason = "Unknown"
	} else if pod.DeletionTimestamp != nil {
		reason = "Terminating"
	}

	return reason, message
}

func hasPodReadyCondition(conditions []coreV1.PodCondition) bool {
	for _, condition := range conditions {
		if condition.Type == coreV1.PodReady && condition.Status == coreV1.ConditionTrue {
			return true
		}
	}
	return false
}

func getPodReadyStatus(pod coreV1.Pod) string {
	readyContainers := 0
	for _, containerStatus := range pod.Status.ContainerStatuses {
		if containerStatus.Ready {
			readyContainers++
		}
	}
	return fmt.Sprintf("%d/%d", readyContainers, len(pod.Spec.Containers))
}

func restartCount(pod coreV1.Pod) int {
	count := 0
	if len(pod.Status.ContainerStatuses) == 0 {
		return 0
	}
	for _, containerStatus := range pod.Status.ContainerStatuses {
		count += int(containerStatus.RestartCount)
	}
	return count
}
