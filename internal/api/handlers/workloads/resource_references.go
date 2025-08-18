package workloads

import (
	"fmt"
	"net/http"

	"github.com/Facets-cloud/kube-dash/internal/api/transformers"
	"github.com/Facets-cloud/kube-dash/internal/api/types"
	"github.com/Facets-cloud/kube-dash/internal/api/utils"
	"github.com/Facets-cloud/kube-dash/internal/k8s"
	"github.com/Facets-cloud/kube-dash/internal/storage"
	"github.com/Facets-cloud/kube-dash/pkg/logger"

	"github.com/gin-gonic/gin"
	appsV1 "k8s.io/api/apps/v1"
	batchV1 "k8s.io/api/batch/v1"
	v1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/client-go/kubernetes"
)

// ResourceReferencesHandler handles resource reference operations
type ResourceReferencesHandler struct {
	store         *storage.KubeConfigStore
	clientFactory *k8s.ClientFactory
	logger        *logger.Logger
	sseHandler    *utils.SSEHandler
}

// NewResourceReferencesHandler creates a new ResourceReferencesHandler
func NewResourceReferencesHandler(store *storage.KubeConfigStore, clientFactory *k8s.ClientFactory, log *logger.Logger) *ResourceReferencesHandler {
	return &ResourceReferencesHandler{
		store:         store,
		clientFactory: clientFactory,
		logger:        log,
		sseHandler:    utils.NewSSEHandler(log),
	}
}

// getClientAndConfig gets the Kubernetes client and config for the given config ID and cluster
func (h *ResourceReferencesHandler) getClientAndConfig(c *gin.Context) (*kubernetes.Clientset, error) {
	configID := c.Query("config")
	cluster := c.Query("cluster")

	if configID == "" {
		return nil, fmt.Errorf("config parameter is required")
	}

	config, err := h.store.GetKubeConfig(configID)
	if err != nil {
		return nil, fmt.Errorf("config not found: %w", err)
	}

	client, err := h.clientFactory.GetClientForConfig(config, cluster)
	if err != nil {
		return nil, fmt.Errorf("failed to get Kubernetes client: %w", err)
	}

	return client, nil
}

// GetDeploymentPods returns pods for a specific deployment
func (h *ResourceReferencesHandler) GetDeploymentPods(c *gin.Context) {
	client, err := h.getClientAndConfig(c)
	if err != nil {
		h.logger.WithError(err).Error("Failed to get client for deployment pods")
		h.sseHandler.SendSSEError(c, http.StatusBadRequest, err.Error())
		return
	}

	name := c.Param("name")
	namespace := c.Param("namespace")

	// Get the deployment to get its selector
	deployment, err := client.AppsV1().Deployments(namespace).Get(c.Request.Context(), name, metav1.GetOptions{})
	if err != nil {
		h.logger.WithError(err).WithField("deployment", name).WithField("namespace", namespace).Error("Failed to get deployment")
		h.sseHandler.SendSSEError(c, http.StatusNotFound, err.Error())
		return
	}

	// Prepare initial data and periodic updater
	selector := metav1.FormatLabelSelector(deployment.Spec.Selector)
	fetchPods := func() (interface{}, error) {
		podList, err := client.CoreV1().Pods(namespace).List(c.Request.Context(), metav1.ListOptions{
			LabelSelector: selector,
		})
		if err != nil {
			return nil, err
		}
		configID := c.Query("config")
		clusterName := c.Query("cluster")
		var response []types.PodListResponse
		for _, pod := range podList.Items {
			response = append(response, transformers.TransformPodToResponse(&pod, configID, clusterName))
		}
		return response, nil
	}

	initialData, err := fetchPods()
	if err != nil {
		h.logger.WithError(err).WithField("deployment", name).WithField("namespace", namespace).Error("Failed to get deployment pods")
		h.sseHandler.SendSSEError(c, http.StatusInternalServerError, err.Error())
		return
	}

	// Send SSE response with periodic updates so UI reflects scale changes
	h.sseHandler.SendSSEResponseWithUpdates(c, initialData, fetchPods)
}

// GetDaemonSetPods returns pods for a specific daemonset
func (h *ResourceReferencesHandler) GetDaemonSetPods(c *gin.Context) {
	client, err := h.getClientAndConfig(c)
	if err != nil {
		h.logger.WithError(err).Error("Failed to get client for daemonset pods")
		h.sseHandler.SendSSEError(c, http.StatusBadRequest, err.Error())
		return
	}

	name := c.Param("name")
	namespace := c.Param("namespace")

	// Get the daemonset to get its selector
	daemonSet, err := client.AppsV1().DaemonSets(namespace).Get(c.Request.Context(), name, metav1.GetOptions{})
	if err != nil {
		h.logger.WithError(err).WithField("daemonset", name).WithField("namespace", namespace).Error("Failed to get daemonset")
		h.sseHandler.SendSSEError(c, http.StatusNotFound, err.Error())
		return
	}

	selector := metav1.FormatLabelSelector(daemonSet.Spec.Selector)
	fetchPods := func() (interface{}, error) {
		podList, err := client.CoreV1().Pods(namespace).List(c.Request.Context(), metav1.ListOptions{
			LabelSelector: selector,
		})
		if err != nil {
			return nil, err
		}
		configID := c.Query("config")
		clusterName := c.Query("cluster")
		var response []types.PodListResponse
		for _, pod := range podList.Items {
			response = append(response, transformers.TransformPodToResponse(&pod, configID, clusterName))
		}
		return response, nil
	}

	initialData, err := fetchPods()
	if err != nil {
		h.logger.WithError(err).WithField("daemonset", name).WithField("namespace", namespace).Error("Failed to get daemonset pods")
		h.sseHandler.SendSSEError(c, http.StatusInternalServerError, err.Error())
		return
	}

	h.sseHandler.SendSSEResponseWithUpdates(c, initialData, fetchPods)
}

// GetStatefulSetPods returns pods for a specific statefulset
func (h *ResourceReferencesHandler) GetStatefulSetPods(c *gin.Context) {
	client, err := h.getClientAndConfig(c)
	if err != nil {
		h.logger.WithError(err).Error("Failed to get client for statefulset pods")
		h.sseHandler.SendSSEError(c, http.StatusBadRequest, err.Error())
		return
	}

	name := c.Param("name")
	namespace := c.Param("namespace")

	// Get the statefulset to get its selector
	statefulSet, err := client.AppsV1().StatefulSets(namespace).Get(c.Request.Context(), name, metav1.GetOptions{})
	if err != nil {
		h.logger.WithError(err).WithField("statefulset", name).WithField("namespace", namespace).Error("Failed to get statefulset")
		h.sseHandler.SendSSEError(c, http.StatusNotFound, err.Error())
		return
	}

	selector := metav1.FormatLabelSelector(statefulSet.Spec.Selector)
	fetchPods := func() (interface{}, error) {
		podList, err := client.CoreV1().Pods(namespace).List(c.Request.Context(), metav1.ListOptions{
			LabelSelector: selector,
		})
		if err != nil {
			return nil, err
		}
		configID := c.Query("config")
		clusterName := c.Query("cluster")
		var response []types.PodListResponse
		for _, pod := range podList.Items {
			response = append(response, transformers.TransformPodToResponse(&pod, configID, clusterName))
		}
		return response, nil
	}

	initialData, err := fetchPods()
	if err != nil {
		h.logger.WithError(err).WithField("statefulset", name).WithField("namespace", namespace).Error("Failed to get statefulset pods")
		h.sseHandler.SendSSEError(c, http.StatusInternalServerError, err.Error())
		return
	}

	h.sseHandler.SendSSEResponseWithUpdates(c, initialData, fetchPods)
}

// GetReplicaSetPods returns pods for a specific replicaset
func (h *ResourceReferencesHandler) GetReplicaSetPods(c *gin.Context) {
	client, err := h.getClientAndConfig(c)
	if err != nil {
		h.logger.WithError(err).Error("Failed to get client for replicaset pods")
		h.sseHandler.SendSSEError(c, http.StatusBadRequest, err.Error())
		return
	}

	name := c.Param("name")
	namespace := c.Param("namespace")

	// Get the replicaset to get its selector
	replicaSet, err := client.AppsV1().ReplicaSets(namespace).Get(c.Request.Context(), name, metav1.GetOptions{})
	if err != nil {
		h.logger.WithError(err).WithField("replicaset", name).WithField("namespace", namespace).Error("Failed to get replicaset")
		h.sseHandler.SendSSEError(c, http.StatusNotFound, err.Error())
		return
	}

	selector := metav1.FormatLabelSelector(replicaSet.Spec.Selector)
	fetchPods := func() (interface{}, error) {
		podList, err := client.CoreV1().Pods(namespace).List(c.Request.Context(), metav1.ListOptions{
			LabelSelector: selector,
		})
		if err != nil {
			return nil, err
		}
		configID := c.Query("config")
		clusterName := c.Query("cluster")
		var response []types.PodListResponse
		for _, pod := range podList.Items {
			response = append(response, transformers.TransformPodToResponse(&pod, configID, clusterName))
		}
		return response, nil
	}

	initialData, err := fetchPods()
	if err != nil {
		h.logger.WithError(err).WithField("replicaset", name).WithField("namespace", namespace).Error("Failed to get replicaset pods")
		h.sseHandler.SendSSEError(c, http.StatusInternalServerError, err.Error())
		return
	}

	h.sseHandler.SendSSEResponseWithUpdates(c, initialData, fetchPods)
}

// GetJobPods returns pods for a specific job
func (h *ResourceReferencesHandler) GetJobPods(c *gin.Context) {
	client, err := h.getClientAndConfig(c)
	if err != nil {
		h.logger.WithError(err).Error("Failed to get client for job pods")
		h.sseHandler.SendSSEError(c, http.StatusBadRequest, err.Error())
		return
	}

	name := c.Param("name")
	namespace := c.Param("namespace")

	// Get the job to get its selector
	job, err := client.BatchV1().Jobs(namespace).Get(c.Request.Context(), name, metav1.GetOptions{})
	if err != nil {
		h.logger.WithError(err).WithField("job", name).WithField("namespace", namespace).Error("Failed to get job")
		h.sseHandler.SendSSEError(c, http.StatusNotFound, err.Error())
		return
	}

	selector := metav1.FormatLabelSelector(job.Spec.Selector)
	fetchPods := func() (interface{}, error) {
		podList, err := client.CoreV1().Pods(namespace).List(c.Request.Context(), metav1.ListOptions{
			LabelSelector: selector,
		})
		if err != nil {
			return nil, err
		}
		configID := c.Query("config")
		clusterName := c.Query("cluster")
		var response []types.PodListResponse
		for _, pod := range podList.Items {
			response = append(response, transformers.TransformPodToResponse(&pod, configID, clusterName))
		}
		return response, nil
	}

	initialData, err := fetchPods()
	if err != nil {
		h.logger.WithError(err).WithField("job", name).WithField("namespace", namespace).Error("Failed to get job pods")
		h.sseHandler.SendSSEError(c, http.StatusInternalServerError, err.Error())
		return
	}

	h.sseHandler.SendSSEResponseWithUpdates(c, initialData, fetchPods)
}

// GetCronJobJobs returns jobs for a specific cronjob
func (h *ResourceReferencesHandler) GetCronJobJobs(c *gin.Context) {
	client, err := h.getClientAndConfig(c)
	if err != nil {
		h.logger.WithError(err).Error("Failed to get client for cronjob jobs")
		h.sseHandler.SendSSEError(c, http.StatusBadRequest, err.Error())
		return
	}

	name := c.Param("name")
	namespace := c.Param("namespace")

	// Get jobs using the cronjob's name as a label selector
	jobs, err := client.BatchV1().Jobs(namespace).List(c.Request.Context(), metav1.ListOptions{
		LabelSelector: fmt.Sprintf("job-name=%s", name),
	})
	if err != nil {
		h.logger.WithError(err).WithField("cronjob", name).WithField("namespace", namespace).Error("Failed to get cronjob jobs")
		h.sseHandler.SendSSEError(c, http.StatusInternalServerError, err.Error())
		return
	}

	// Transform jobs to frontend-expected format
	var response []types.JobListResponse
	for _, job := range jobs.Items {
		response = append(response, transformers.TransformJobToResponse(&job))
	}

	// Always send SSE format for detail endpoints since they're used by EventSource
	h.sseHandler.SendSSEResponse(c, response)
}

// GetDeploymentPodsByName returns pods for a specific deployment by name using namespace from query parameters
func (h *ResourceReferencesHandler) GetDeploymentPodsByName(c *gin.Context) {
	name := c.Param("name")
	namespace := c.Query("namespace")

	if namespace == "" {
		h.logger.WithField("deployment", name).Error("Namespace is required for deployment pods lookup")
		h.sseHandler.SendSSEError(c, http.StatusBadRequest, "namespace parameter is required")
		return
	}

	// Set the namespace in the context for the main handler
	c.Params = append(c.Params, gin.Param{Key: "namespace", Value: namespace})
	h.GetDeploymentPods(c)
}

// GetDaemonSetPodsByName returns pods for a specific daemonset by name using namespace from query parameters
func (h *ResourceReferencesHandler) GetDaemonSetPodsByName(c *gin.Context) {
	name := c.Param("name")
	namespace := c.Query("namespace")

	if namespace == "" {
		h.logger.WithField("daemonset", name).Error("Namespace is required for daemonset pods lookup")
		h.sseHandler.SendSSEError(c, http.StatusBadRequest, "namespace parameter is required")
		return
	}

	// Set the namespace in the context for the main handler
	c.Params = append(c.Params, gin.Param{Key: "namespace", Value: namespace})
	h.GetDaemonSetPods(c)
}

// GetStatefulSetPodsByName returns pods for a specific statefulset by name using namespace from query parameters
func (h *ResourceReferencesHandler) GetStatefulSetPodsByName(c *gin.Context) {
	name := c.Param("name")
	namespace := c.Query("namespace")

	if namespace == "" {
		h.logger.WithField("statefulset", name).Error("Namespace is required for statefulset pods lookup")
		h.sseHandler.SendSSEError(c, http.StatusBadRequest, "namespace parameter is required")
		return
	}

	// Set the namespace in the context for the main handler
	c.Params = append(c.Params, gin.Param{Key: "namespace", Value: namespace})
	h.GetStatefulSetPods(c)
}

// GetReplicaSetPodsByName returns pods for a specific replicaset by name using namespace from query parameters
func (h *ResourceReferencesHandler) GetReplicaSetPodsByName(c *gin.Context) {
	name := c.Param("name")
	namespace := c.Query("namespace")

	if namespace == "" {
		h.logger.WithField("replicaset", name).Error("Namespace is required for replicaset pods lookup")
		h.sseHandler.SendSSEError(c, http.StatusBadRequest, "namespace parameter is required")
		return
	}

	// Set the namespace in the context for the main handler
	c.Params = append(c.Params, gin.Param{Key: "namespace", Value: namespace})
	h.GetReplicaSetPods(c)
}

// GetJobPodsByName returns pods for a specific job by name using namespace from query parameters
func (h *ResourceReferencesHandler) GetJobPodsByName(c *gin.Context) {
	name := c.Param("name")
	namespace := c.Query("namespace")

	if namespace == "" {
		h.logger.WithField("job", name).Error("Namespace is required for job pods lookup")
		h.sseHandler.SendSSEError(c, http.StatusBadRequest, "namespace parameter is required")
		return
	}

	// Set the namespace in the context for the main handler
	c.Params = append(c.Params, gin.Param{Key: "namespace", Value: namespace})
	h.GetJobPods(c)
}

// GetSecretDependencies returns workloads that use a specific secret
func (h *ResourceReferencesHandler) GetSecretDependencies(c *gin.Context) {
	client, err := h.getClientAndConfig(c)
	if err != nil {
		h.logger.WithError(err).Error("Failed to get client for secret dependencies")
		h.sseHandler.SendSSEError(c, http.StatusBadRequest, err.Error())
		return
	}

	name := c.Param("name")
	namespace := c.Query("namespace")

	fetchDependencies := func() (interface{}, error) {
		dependencies := make(map[string][]interface{})
		configID := c.Query("config")
		clusterName := c.Query("cluster")

		// Check pods that use this secret
		podList, err := client.CoreV1().Pods(namespace).List(c.Request.Context(), metav1.ListOptions{})
		if err != nil {
			return nil, fmt.Errorf("failed to list pods: %w", err)
		}

		var dependentPods []types.PodListResponse
		for _, pod := range podList.Items {
			if h.podUsesSecret(&pod, name) {
				dependentPods = append(dependentPods, transformers.TransformPodToResponse(&pod, configID, clusterName))
			}
		}
		if len(dependentPods) > 0 {
			dependencies["pods"] = make([]interface{}, len(dependentPods))
			for i, pod := range dependentPods {
				dependencies["pods"][i] = pod
			}
		}

		// Check deployments that use this secret
		deploymentList, err := client.AppsV1().Deployments(namespace).List(c.Request.Context(), metav1.ListOptions{})
		if err != nil {
			return nil, fmt.Errorf("failed to list deployments: %w", err)
		}

		var dependentDeployments []interface{}
		for _, deployment := range deploymentList.Items {
			if h.deploymentUsesSecret(&deployment, name) {
				dependentDeployments = append(dependentDeployments, transformers.TransformDeploymentToResponse(&deployment))
			}
		}
		if len(dependentDeployments) > 0 {
			dependencies["deployments"] = dependentDeployments
		}

		// Check jobs that use this secret
		jobList, err := client.BatchV1().Jobs(namespace).List(c.Request.Context(), metav1.ListOptions{})
		if err != nil {
			return nil, fmt.Errorf("failed to list jobs: %w", err)
		}

		var dependentJobs []interface{}
		for _, job := range jobList.Items {
			if h.jobUsesSecret(&job, name) {
				dependentJobs = append(dependentJobs, transformers.TransformJobToResponse(&job))
			}
		}
		if len(dependentJobs) > 0 {
			dependencies["jobs"] = dependentJobs
		}

		// Check cronjobs that use this secret
		cronJobList, err := client.BatchV1().CronJobs(namespace).List(c.Request.Context(), metav1.ListOptions{})
		if err != nil {
			return nil, fmt.Errorf("failed to list cronjobs: %w", err)
		}

		var dependentCronJobs []interface{}
		for _, cronJob := range cronJobList.Items {
			if h.cronJobUsesSecret(&cronJob, name) {
				dependentCronJobs = append(dependentCronJobs, transformers.TransformCronJobToResponse(&cronJob))
			}
		}
		if len(dependentCronJobs) > 0 {
			dependencies["cronjobs"] = dependentCronJobs
		}

		return dependencies, nil
	}

	initialData, err := fetchDependencies()
	if err != nil {
		h.logger.WithError(err).WithField("secret", name).WithField("namespace", namespace).Error("Failed to get secret dependencies")
		h.sseHandler.SendSSEError(c, http.StatusInternalServerError, err.Error())
		return
	}

	// Send SSE response with periodic updates
	h.sseHandler.SendSSEResponseWithUpdates(c, initialData, fetchDependencies)
}

// Helper methods to check if resources use secrets or configmaps

// podUsesSecret checks if a pod uses the specified secret
func (h *ResourceReferencesHandler) podUsesSecret(pod *v1.Pod, secretName string) bool {
	// Check volumes
	for _, volume := range pod.Spec.Volumes {
		if volume.Secret != nil && volume.Secret.SecretName == secretName {
			return true
		}
	}

	// Check environment variables in containers
	for _, container := range pod.Spec.Containers {
		for _, env := range container.Env {
			if env.ValueFrom != nil && env.ValueFrom.SecretKeyRef != nil && env.ValueFrom.SecretKeyRef.Name == secretName {
				return true
			}
		}
		for _, envFrom := range container.EnvFrom {
			if envFrom.SecretRef != nil && envFrom.SecretRef.Name == secretName {
				return true
			}
		}
	}

	// Check init containers
	for _, container := range pod.Spec.InitContainers {
		for _, env := range container.Env {
			if env.ValueFrom != nil && env.ValueFrom.SecretKeyRef != nil && env.ValueFrom.SecretKeyRef.Name == secretName {
				return true
			}
		}
		for _, envFrom := range container.EnvFrom {
			if envFrom.SecretRef != nil && envFrom.SecretRef.Name == secretName {
				return true
			}
		}
	}

	// Check image pull secrets
	for _, imagePullSecret := range pod.Spec.ImagePullSecrets {
		if imagePullSecret.Name == secretName {
			return true
		}
	}

	return false
}

// podUsesConfigMap checks if a pod uses the specified configmap
func (h *ResourceReferencesHandler) podUsesConfigMap(pod *v1.Pod, configMapName string) bool {
	// Check volumes
	for _, volume := range pod.Spec.Volumes {
		if volume.ConfigMap != nil && volume.ConfigMap.Name == configMapName {
			return true
		}
	}

	// Check environment variables in containers
	for _, container := range pod.Spec.Containers {
		for _, env := range container.Env {
			if env.ValueFrom != nil && env.ValueFrom.ConfigMapKeyRef != nil && env.ValueFrom.ConfigMapKeyRef.Name == configMapName {
				return true
			}
		}
		for _, envFrom := range container.EnvFrom {
			if envFrom.ConfigMapRef != nil && envFrom.ConfigMapRef.Name == configMapName {
				return true
			}
		}
	}

	// Check init containers
	for _, container := range pod.Spec.InitContainers {
		for _, env := range container.Env {
			if env.ValueFrom != nil && env.ValueFrom.ConfigMapKeyRef != nil && env.ValueFrom.ConfigMapKeyRef.Name == configMapName {
				return true
			}
		}
		for _, envFrom := range container.EnvFrom {
			if envFrom.ConfigMapRef != nil && envFrom.ConfigMapRef.Name == configMapName {
				return true
			}
		}
	}

	return false
}

// deploymentUsesSecret checks if a deployment uses the specified secret
func (h *ResourceReferencesHandler) deploymentUsesSecret(deployment *appsV1.Deployment, secretName string) bool {
	return h.podUsesSecret(&v1.Pod{Spec: deployment.Spec.Template.Spec}, secretName)
}

// deploymentUsesConfigMap checks if a deployment uses the specified configmap
func (h *ResourceReferencesHandler) deploymentUsesConfigMap(deployment *appsV1.Deployment, configMapName string) bool {
	return h.podUsesConfigMap(&v1.Pod{Spec: deployment.Spec.Template.Spec}, configMapName)
}

// jobUsesSecret checks if a job uses the specified secret
func (h *ResourceReferencesHandler) jobUsesSecret(job *batchV1.Job, secretName string) bool {
	return h.podUsesSecret(&v1.Pod{Spec: job.Spec.Template.Spec}, secretName)
}

// jobUsesConfigMap checks if a job uses the specified configmap
func (h *ResourceReferencesHandler) jobUsesConfigMap(job *batchV1.Job, configMapName string) bool {
	return h.podUsesConfigMap(&v1.Pod{Spec: job.Spec.Template.Spec}, configMapName)
}

// cronJobUsesSecret checks if a cronjob uses the specified secret
func (h *ResourceReferencesHandler) cronJobUsesSecret(cronJob *batchV1.CronJob, secretName string) bool {
	return h.podUsesSecret(&v1.Pod{Spec: cronJob.Spec.JobTemplate.Spec.Template.Spec}, secretName)
}

// cronJobUsesConfigMap checks if a cronjob uses the specified configmap
func (h *ResourceReferencesHandler) cronJobUsesConfigMap(cronJob *batchV1.CronJob, configMapName string) bool {
	return h.podUsesConfigMap(&v1.Pod{Spec: cronJob.Spec.JobTemplate.Spec.Template.Spec}, configMapName)
}

// GetConfigMapDependencies returns workloads that use a specific configmap
func (h *ResourceReferencesHandler) GetConfigMapDependencies(c *gin.Context) {
	client, err := h.getClientAndConfig(c)
	if err != nil {
		h.logger.WithError(err).Error("Failed to get client for configmap dependencies")
		h.sseHandler.SendSSEError(c, http.StatusBadRequest, err.Error())
		return
	}

	name := c.Param("name")
	namespace := c.Query("namespace")

	fetchDependencies := func() (interface{}, error) {
		dependencies := make(map[string][]interface{})
		configID := c.Query("config")
		clusterName := c.Query("cluster")

		// Check pods that use this configmap
		podList, err := client.CoreV1().Pods(namespace).List(c.Request.Context(), metav1.ListOptions{})
		if err != nil {
			return nil, fmt.Errorf("failed to list pods: %w", err)
		}

		var dependentPods []types.PodListResponse
		for _, pod := range podList.Items {
			if h.podUsesConfigMap(&pod, name) {
				dependentPods = append(dependentPods, transformers.TransformPodToResponse(&pod, configID, clusterName))
			}
		}
		if len(dependentPods) > 0 {
			dependencies["pods"] = make([]interface{}, len(dependentPods))
			for i, pod := range dependentPods {
				dependencies["pods"][i] = pod
			}
		}

		// Check deployments that use this configmap
		deploymentList, err := client.AppsV1().Deployments(namespace).List(c.Request.Context(), metav1.ListOptions{})
		if err != nil {
			return nil, fmt.Errorf("failed to list deployments: %w", err)
		}

		var dependentDeployments []interface{}
		for _, deployment := range deploymentList.Items {
			if h.deploymentUsesConfigMap(&deployment, name) {
				dependentDeployments = append(dependentDeployments, transformers.TransformDeploymentToResponse(&deployment))
			}
		}
		if len(dependentDeployments) > 0 {
			dependencies["deployments"] = dependentDeployments
		}

		// Check jobs that use this configmap
		jobList, err := client.BatchV1().Jobs(namespace).List(c.Request.Context(), metav1.ListOptions{})
		if err != nil {
			return nil, fmt.Errorf("failed to list jobs: %w", err)
		}

		var dependentJobs []interface{}
		for _, job := range jobList.Items {
			if h.jobUsesConfigMap(&job, name) {
				dependentJobs = append(dependentJobs, transformers.TransformJobToResponse(&job))
			}
		}
		if len(dependentJobs) > 0 {
			dependencies["jobs"] = dependentJobs
		}

		// Check cronjobs that use this configmap
		cronJobList, err := client.BatchV1().CronJobs(namespace).List(c.Request.Context(), metav1.ListOptions{})
		if err != nil {
			return nil, fmt.Errorf("failed to list cronjobs: %w", err)
		}

		var dependentCronJobs []interface{}
		for _, cronJob := range cronJobList.Items {
			if h.cronJobUsesConfigMap(&cronJob, name) {
				dependentCronJobs = append(dependentCronJobs, transformers.TransformCronJobToResponse(&cronJob))
			}
		}
		if len(dependentCronJobs) > 0 {
			dependencies["cronjobs"] = dependentCronJobs
		}

		return dependencies, nil
	}

	initialData, err := fetchDependencies()
	if err != nil {
		h.logger.WithError(err).WithField("configmap", name).WithField("namespace", namespace).Error("Failed to get configmap dependencies")
		h.sseHandler.SendSSEError(c, http.StatusInternalServerError, err.Error())
		return
	}

	// Send SSE response with periodic updates
	h.sseHandler.SendSSEResponseWithUpdates(c, initialData, fetchDependencies)
}
