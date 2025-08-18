package transformers

import (
	"strconv"
	"time"

	"github.com/Facets-cloud/kube-dash/internal/api/types"

	appsV1 "k8s.io/api/apps/v1"
	batchV1 "k8s.io/api/batch/v1"
	v1 "k8s.io/api/core/v1"
)

// Helper functions to safely handle nil pointers
func getInt32Value(ptr *int32, defaultValue int32) int32 {
	if ptr == nil {
		return defaultValue
	}
	return *ptr
}

func getBoolValue(ptr *bool, defaultValue bool) bool {
	if ptr == nil {
		return defaultValue
	}
	return *ptr
}

func getCompletionMode(ptr *batchV1.CompletionMode) string {
	if ptr == nil {
		return string(batchV1.NonIndexedCompletion) // Default completion mode
	}
	return string(*ptr)
}

// TransformPodToResponse transforms a Kubernetes pod to the frontend-expected format
func TransformPodToResponse(pod *v1.Pod, configName, clusterName string) types.PodListResponse {
	age := types.TimeFormat(pod.CreationTimestamp.Time)

	// Calculate ready containers
	readyContainers := 0
	totalContainers := len(pod.Spec.Containers)
	for _, containerStatus := range pod.Status.ContainerStatuses {
		if containerStatus.Ready {
			readyContainers++
		}
	}
	ready := strconv.Itoa(readyContainers) + "/" + strconv.Itoa(totalContainers)

	// Get pod status
	status := string(pod.Status.Phase)
	if pod.Status.Reason != "" {
		status = pod.Status.Reason
	}
	
	// Check if pod is terminating (has DeletionTimestamp set)
	if pod.DeletionTimestamp != nil {
		status = "Terminating"
	}

	// Default CPU and memory; may be overwritten by live metrics in handler
	cpu := "0"
	memory := "0"
	if pod.Status.ContainerStatuses != nil {
		// In a real implementation, you'd get this from metrics server
		// For now, we'll use requests/limits as approximation
		for _, container := range pod.Spec.Containers {
			if container.Resources.Requests != nil {
				if cpuRequest, ok := container.Resources.Requests[v1.ResourceCPU]; ok {
					cpu = cpuRequest.String()
				}
				if memoryRequest, ok := container.Resources.Requests[v1.ResourceMemory]; ok {
					memory = memoryRequest.String()
				}
			}
		}
	}

	// Calculate restarts
	restarts := "0"
	lastRestartAt := ""
	lastRestartReason := ""
	if pod.Status.ContainerStatuses != nil {
		totalRestarts := int32(0)
		for _, containerStatus := range pod.Status.ContainerStatuses {
			totalRestarts += containerStatus.RestartCount
			if containerStatus.RestartCount > 0 && containerStatus.LastTerminationState.Terminated != nil {
				lastRestartAt = containerStatus.LastTerminationState.Terminated.FinishedAt.Format(time.RFC3339)
				lastRestartReason = containerStatus.LastTerminationState.Terminated.Reason
			}
		}
		restarts = strconv.Itoa(int(totalRestarts))
	}

	// Get pod IP
	podIP := pod.Status.PodIP

	// Get QoS class
	qos := string(v1.PodQOSBestEffort)
	if pod.Status.QOSClass != "" {
		qos = string(pod.Status.QOSClass)
	}

	return types.PodListResponse{
		BaseResponse: types.BaseResponse{
			Age:        age,
			HasUpdated: false,
			Name:       pod.Name,
			UID:        string(pod.UID),
		},
		Namespace:         pod.Namespace,
		Node:              pod.Spec.NodeName,
		Ready:             ready,
		Status:            status,
		CPU:               cpu,
		Memory:            memory,
		Restarts:          restarts,
		LastRestartAt:     lastRestartAt,
		LastRestartReason: lastRestartReason,
		PodIP:             podIP,
		QOS:               qos,
		ConfigName:        configName,
		ClusterName:       clusterName,
	}
}

// TransformDeploymentToResponse transforms a Kubernetes deployment to the frontend-expected format
func TransformDeploymentToResponse(deployment *appsV1.Deployment) types.DeploymentListResponse {
	age := types.TimeFormat(deployment.CreationTimestamp.Time)

	// Format replicas string
	replicas := "0"
	if deployment.Spec.Replicas != nil {
		replicas = strconv.Itoa(int(*deployment.Spec.Replicas))
	}

	// Transform conditions
	var conditions []types.Condition
	for _, condition := range deployment.Status.Conditions {
		conditions = append(conditions, types.Condition{
			Type:   string(condition.Type),
			Status: string(condition.Status),
		})
	}

	return types.DeploymentListResponse{
		NamespacedResponse: types.NamespacedResponse{
			BaseResponse: types.BaseResponse{
				Age:        age,
				HasUpdated: false,
				Name:       deployment.Name,
				UID:        string(deployment.UID),
			},
			Namespace: deployment.Namespace,
		},
		Replicas: replicas,
		Spec: struct {
			Replicas int32 `json:"replicas"`
		}{
			Replicas: *deployment.Spec.Replicas,
		},
		Status: struct {
			ObservedGeneration int64             `json:"observedGeneration"`
			Replicas           int32             `json:"replicas"`
			UpdatedReplicas    int32             `json:"updatedReplicas"`
			ReadyReplicas      int32             `json:"readyReplicas"`
			AvailableReplicas  int32             `json:"availableReplicas"`
			Conditions         []types.Condition `json:"conditions"`
		}{
			ObservedGeneration: deployment.Status.ObservedGeneration,
			Replicas:           deployment.Status.Replicas,
			UpdatedReplicas:    deployment.Status.UpdatedReplicas,
			ReadyReplicas:      deployment.Status.ReadyReplicas,
			AvailableReplicas:  deployment.Status.AvailableReplicas,
			Conditions:         conditions,
		},
	}
}

// TransformDaemonSetToResponse transforms a Kubernetes daemon set to the frontend-expected format
func TransformDaemonSetToResponse(daemonSet *appsV1.DaemonSet) types.DaemonSetListResponse {
	age := types.TimeFormat(daemonSet.CreationTimestamp.Time)

	return types.DaemonSetListResponse{
		NamespacedResponse: types.NamespacedResponse{
			BaseResponse: types.BaseResponse{
				Age:        age,
				HasUpdated: false,
				Name:       daemonSet.Name,
				UID:        string(daemonSet.UID),
			},
			Namespace: daemonSet.Namespace,
		},
		Status: struct {
			CurrentNumberScheduled int32 `json:"currentNumberScheduled"`
			NumberMisscheduled     int32 `json:"numberMisscheduled"`
			DesiredNumberScheduled int32 `json:"desiredNumberScheduled"`
			NumberReady            int32 `json:"numberReady"`
			ObservedGeneration     int64 `json:"observedGeneration"`
			UpdatedNumberScheduled int32 `json:"updatedNumberScheduled"`
			NumberAvailable        int32 `json:"numberAvailable"`
		}{
			CurrentNumberScheduled: daemonSet.Status.CurrentNumberScheduled,
			NumberMisscheduled:     daemonSet.Status.NumberMisscheduled,
			DesiredNumberScheduled: daemonSet.Status.DesiredNumberScheduled,
			NumberReady:            daemonSet.Status.NumberReady,
			ObservedGeneration:     daemonSet.Status.ObservedGeneration,
			UpdatedNumberScheduled: daemonSet.Status.UpdatedNumberScheduled,
			NumberAvailable:        daemonSet.Status.NumberAvailable,
		},
	}
}

// TransformStatefulSetToResponse transforms a Kubernetes stateful set to the frontend-expected format
func TransformStatefulSetToResponse(statefulSet *appsV1.StatefulSet) types.StatefulSetListResponse {
	age := types.TimeFormat(statefulSet.CreationTimestamp.Time)

	return types.StatefulSetListResponse{
		NamespacedResponse: types.NamespacedResponse{
			BaseResponse: types.BaseResponse{
				Age:        age,
				HasUpdated: false,
				Name:       statefulSet.Name,
				UID:        string(statefulSet.UID),
			},
			Namespace: statefulSet.Namespace,
		},
		Status: struct {
			Replicas             int32 `json:"replicas"`
			FullyLabeledReplicas int32 `json:"fullyLabeledReplicas"`
			ReadyReplicas        int32 `json:"readyReplicas"`
			AvailableReplicas    int32 `json:"availableReplicas"`
			ObservedGeneration   int64 `json:"observedGeneration"`
		}{
			Replicas:             statefulSet.Status.Replicas,
			FullyLabeledReplicas: statefulSet.Status.ReadyReplicas, // StatefulSet doesn't have FullyLabeledReplicas
			ReadyReplicas:        statefulSet.Status.ReadyReplicas,
			AvailableReplicas:    statefulSet.Status.AvailableReplicas,
			ObservedGeneration:   statefulSet.Status.ObservedGeneration,
		},
	}
}

// TransformReplicaSetToResponse transforms a Kubernetes replica set to the frontend-expected format
func TransformReplicaSetToResponse(replicaSet *appsV1.ReplicaSet) types.ReplicaSetListResponse {
	age := types.TimeFormat(replicaSet.CreationTimestamp.Time)

	return types.ReplicaSetListResponse{
		NamespacedResponse: types.NamespacedResponse{
			BaseResponse: types.BaseResponse{
				Age:        age,
				HasUpdated: false,
				Name:       replicaSet.Name,
				UID:        string(replicaSet.UID),
			},
			Namespace: replicaSet.Namespace,
		},
		Status: struct {
			Replicas             int32 `json:"replicas"`
			FullyLabeledReplicas int32 `json:"fullyLabeledReplicas"`
			ReadyReplicas        int32 `json:"readyReplicas"`
			AvailableReplicas    int32 `json:"availableReplicas"`
			ObservedGeneration   int64 `json:"observedGeneration"`
		}{
			Replicas:             replicaSet.Status.Replicas,
			FullyLabeledReplicas: replicaSet.Status.FullyLabeledReplicas,
			ReadyReplicas:        replicaSet.Status.ReadyReplicas,
			AvailableReplicas:    replicaSet.Status.AvailableReplicas,
			ObservedGeneration:   replicaSet.Status.ObservedGeneration,
		},
	}
}

// TransformJobToResponse transforms a Kubernetes job to the frontend-expected format
func TransformJobToResponse(job *batchV1.Job) types.JobListResponse {
	age := types.TimeFormat(job.CreationTimestamp.Time)

	// Transform conditions
	var conditions []types.Condition
	for _, condition := range job.Status.Conditions {
		conditions = append(conditions, types.Condition{
			Type:   string(condition.Type),
			Status: string(condition.Status),
		})
	}

	// Format start time
	startTime := ""
	if job.Status.StartTime != nil {
		startTime = job.Status.StartTime.Format(time.RFC3339)
	}

	return types.JobListResponse{
		NamespacedResponse: types.NamespacedResponse{
			BaseResponse: types.BaseResponse{
				Age:        age,
				HasUpdated: false,
				Name:       job.Name,
				UID:        string(job.UID),
			},
			Namespace: job.Namespace,
		},
		Spec: struct {
			Completions    int32  `json:"completions"`
			BackoffLimit   int32  `json:"backoffLimit"`
			CompletionMode string `json:"completionMode"`
			Suspend        bool   `json:"suspend"`
		}{
			Completions:    getInt32Value(job.Spec.Completions, 1),  // Default to 1 if nil
			BackoffLimit:   getInt32Value(job.Spec.BackoffLimit, 6), // Default to 6 if nil
			CompletionMode: getCompletionMode(job.Spec.CompletionMode),
			Suspend:        getBoolValue(job.Spec.Suspend, false), // Default to false if nil
		},
		Status: struct {
			Conditions []types.Condition `json:"conditions"`
			Active     int32             `json:"active"`
			Ready      int32             `json:"ready"`
			Failed     int32             `json:"failed"`
			Succeeded  int32             `json:"succeeded"`
			StartTime  string            `json:"startTime"`
		}{
			Conditions: conditions,
			Active:     job.Status.Active,
			Ready:      getInt32Value(job.Status.Ready, 0), // Default to 0 if nil
			Failed:     job.Status.Failed,
			Succeeded:  job.Status.Succeeded,
			StartTime:  startTime,
		},
	}
}

// TransformCronJobToResponse transforms a Kubernetes cron job to the frontend-expected format
func TransformCronJobToResponse(cronJob *batchV1.CronJob) types.CronJobListResponse {
	age := types.TimeFormat(cronJob.CreationTimestamp.Time)

	// Format times
	lastScheduleTime := ""
	if cronJob.Status.LastScheduleTime != nil {
		lastScheduleTime = cronJob.Status.LastScheduleTime.Format(time.RFC3339)
	}

	lastSuccessfulTime := ""
	if cronJob.Status.LastSuccessfulTime != nil {
		lastSuccessfulTime = cronJob.Status.LastSuccessfulTime.Format(time.RFC3339)
	}

	return types.CronJobListResponse{
		NamespacedResponse: types.NamespacedResponse{
			BaseResponse: types.BaseResponse{
				Age:        age,
				HasUpdated: false,
				Name:       cronJob.Name,
				UID:        string(cronJob.UID),
			},
			Namespace: cronJob.Namespace,
		},
		Spec: struct {
			Schedule                   string `json:"schedule"`
			ConcurrencyPolicy          string `json:"concurrencyPolicy"`
			Suspend                    bool   `json:"suspend"`
			SuccessfulJobsHistoryLimit int32  `json:"successfulJobsHistoryLimit"`
			FailedJobsHistoryLimit     int32  `json:"failedJobsHistoryLimit"`
		}{
			Schedule:                   cronJob.Spec.Schedule,
			ConcurrencyPolicy:          string(cronJob.Spec.ConcurrencyPolicy),
			Suspend:                    getBoolValue(cronJob.Spec.Suspend, false),                 // Default to false if nil
			SuccessfulJobsHistoryLimit: getInt32Value(cronJob.Spec.SuccessfulJobsHistoryLimit, 3), // Default to 3 if nil
			FailedJobsHistoryLimit:     getInt32Value(cronJob.Spec.FailedJobsHistoryLimit, 1),     // Default to 1 if nil
		},
		Status: struct {
			Active             int32  `json:"active"`
			LastScheduleTime   string `json:"lastScheduleTime"`
			LastSuccessfulTime string `json:"lastSuccessfulTime"`
		}{
			Active:             int32(len(cronJob.Status.Active)),
			LastScheduleTime:   lastScheduleTime,
			LastSuccessfulTime: lastSuccessfulTime,
		},
	}
}
