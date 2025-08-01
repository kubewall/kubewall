package types

// PodListResponse represents the response format expected by the frontend for pods
type PodListResponse struct {
	BaseResponse
	Namespace         string `json:"namespace"`
	Node              string `json:"node"`
	Ready             string `json:"ready"`
	Status            string `json:"status"`
	CPU               string `json:"cpu"`
	Memory            string `json:"memory"`
	Restarts          string `json:"restarts"`
	LastRestartAt     string `json:"lastRestartAt"`
	LastRestartReason string `json:"lastRestartReason"`
	PodIP             string `json:"podIP"`
	QOS               string `json:"qos"`
	ConfigName        string `json:"configName"`
	ClusterName       string `json:"clusterName"`
}

// DeploymentListResponse represents the response format expected by the frontend for deployments
type DeploymentListResponse struct {
	NamespacedResponse
	Replicas string `json:"replicas"`
	Spec     struct {
		Replicas int32 `json:"replicas"`
	} `json:"spec"`
	Status struct {
		ObservedGeneration int64       `json:"observedGeneration"`
		Replicas           int32       `json:"replicas"`
		UpdatedReplicas    int32       `json:"updatedReplicas"`
		ReadyReplicas      int32       `json:"readyReplicas"`
		AvailableReplicas  int32       `json:"availableReplicas"`
		Conditions         []Condition `json:"conditions"`
	} `json:"status"`
}

// DaemonSetListResponse represents the response format expected by the frontend for daemon sets
type DaemonSetListResponse struct {
	NamespacedResponse
	Status struct {
		CurrentNumberScheduled int32 `json:"currentNumberScheduled"`
		NumberMisscheduled     int32 `json:"numberMisscheduled"`
		DesiredNumberScheduled int32 `json:"desiredNumberScheduled"`
		NumberReady            int32 `json:"numberReady"`
		ObservedGeneration     int64 `json:"observedGeneration"`
		UpdatedNumberScheduled int32 `json:"updatedNumberScheduled"`
		NumberAvailable        int32 `json:"numberAvailable"`
	} `json:"status"`
}

// StatefulSetListResponse represents the response format expected by the frontend for stateful sets
type StatefulSetListResponse struct {
	NamespacedResponse
	Status struct {
		Replicas             int32 `json:"replicas"`
		FullyLabeledReplicas int32 `json:"fullyLabeledReplicas"`
		ReadyReplicas        int32 `json:"readyReplicas"`
		AvailableReplicas    int32 `json:"availableReplicas"`
		ObservedGeneration   int64 `json:"observedGeneration"`
	} `json:"status"`
}

// ReplicaSetListResponse represents the response format expected by the frontend for replica sets
type ReplicaSetListResponse struct {
	NamespacedResponse
	Status struct {
		Replicas             int32 `json:"replicas"`
		FullyLabeledReplicas int32 `json:"fullyLabeledReplicas"`
		ReadyReplicas        int32 `json:"readyReplicas"`
		AvailableReplicas    int32 `json:"availableReplicas"`
		ObservedGeneration   int64 `json:"observedGeneration"`
	} `json:"status"`
}

// JobListResponse represents the response format expected by the frontend for jobs
type JobListResponse struct {
	NamespacedResponse
	Spec struct {
		Completions    int32  `json:"completions"`
		BackoffLimit   int32  `json:"backoffLimit"`
		CompletionMode string `json:"completionMode"`
		Suspend        bool   `json:"suspend"`
	} `json:"spec"`
	Status struct {
		Conditions []Condition `json:"conditions"`
		Active     int32       `json:"active"`
		Ready      int32       `json:"ready"`
		Failed     int32       `json:"failed"`
		Succeeded  int32       `json:"succeeded"`
		StartTime  string      `json:"startTime"`
	} `json:"status"`
}

// CronJobListResponse represents the response format expected by the frontend for cron jobs
type CronJobListResponse struct {
	NamespacedResponse
	Spec struct {
		Schedule                   string `json:"schedule"`
		ConcurrencyPolicy          string `json:"concurrencyPolicy"`
		Suspend                    bool   `json:"suspend"`
		SuccessfulJobsHistoryLimit int32  `json:"successfulJobsHistoryLimit"`
		FailedJobsHistoryLimit     int32  `json:"failedJobsHistoryLimit"`
	} `json:"spec"`
	Status struct {
		Active             int32  `json:"active"`
		LastScheduleTime   string `json:"lastScheduleTime"`
		LastSuccessfulTime string `json:"lastSuccessfulTime"`
	} `json:"status"`
}
