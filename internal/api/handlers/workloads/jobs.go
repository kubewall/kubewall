package workloads

import (
	"fmt"
	"net/http"

	"github.com/Facets-cloud/kube-dash/internal/api/transformers"
	"github.com/Facets-cloud/kube-dash/internal/api/types"
	"github.com/Facets-cloud/kube-dash/internal/api/utils"
	"github.com/Facets-cloud/kube-dash/internal/k8s"
	"github.com/Facets-cloud/kube-dash/internal/storage"
	"github.com/Facets-cloud/kube-dash/internal/tracing"
	"github.com/Facets-cloud/kube-dash/pkg/logger"

	"github.com/gin-gonic/gin"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/client-go/kubernetes"
)

// JobsHandler handles Job-related operations
type JobsHandler struct {
	store         *storage.KubeConfigStore
	clientFactory *k8s.ClientFactory
	logger        *logger.Logger
	eventsHandler *utils.EventsHandler
	yamlHandler   *utils.YAMLHandler
	sseHandler    *utils.SSEHandler
	tracingHelper *tracing.TracingHelper
}

// NewJobsHandler creates a new Jobs handler
func NewJobsHandler(store *storage.KubeConfigStore, clientFactory *k8s.ClientFactory, log *logger.Logger) *JobsHandler {
	return &JobsHandler{
		store:         store,
		clientFactory: clientFactory,
		logger:        log,
		eventsHandler: utils.NewEventsHandler(log),
		yamlHandler:   utils.NewYAMLHandler(log),
		sseHandler:    utils.NewSSEHandler(log),
		tracingHelper: tracing.GetTracingHelper(),
	}
}

// getClientAndConfig gets the Kubernetes client and config for the given config ID and cluster
func (h *JobsHandler) getClientAndConfig(c *gin.Context) (*kubernetes.Clientset, error) {
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

// GetJobsSSE returns jobs as Server-Sent Events with real-time updates
func (h *JobsHandler) GetJobsSSE(c *gin.Context) {
	// Start child span for client setup
	ctx, clientSpan := h.tracingHelper.StartAuthSpan(c.Request.Context(), "setup-client-for-sse")
	defer clientSpan.End()

	client, err := h.getClientAndConfig(c)
	if err != nil {
		h.logger.WithError(err).Error("Failed to get client for jobs SSE")
		h.tracingHelper.RecordError(clientSpan, err, "Failed to get Kubernetes client")
		h.sseHandler.SendSSEError(c, http.StatusBadRequest, err.Error())
		return
	}
	h.tracingHelper.RecordSuccess(clientSpan, "Kubernetes client setup for SSE")

	namespace := c.Query("namespace")

	// Function to fetch and transform jobs data
	fetchJobs := func() (interface{}, error) {
		// Start child span for data fetching
		_, fetchSpan := h.tracingHelper.StartKubernetesAPISpan(ctx, "list", "jobs", namespace)
		defer fetchSpan.End()

		jobList, err := client.BatchV1().Jobs(namespace).List(c.Request.Context(), metav1.ListOptions{})
		if err != nil {
			h.tracingHelper.RecordError(fetchSpan, err, "Failed to list jobs for SSE")
			return nil, err
		}

		// Start child span for data transformation
		_, transformSpan := h.tracingHelper.StartDataProcessingSpan(ctx, "transform-jobs")
		defer transformSpan.End()

		// Transform jobs to frontend-expected format
		var response []types.JobListResponse
		for _, job := range jobList.Items {
			response = append(response, transformers.TransformJobToResponse(&job))
		}

		h.tracingHelper.AddResourceAttributes(fetchSpan, "", "jobs", len(jobList.Items))
		h.tracingHelper.RecordSuccess(fetchSpan, fmt.Sprintf("Listed %d jobs for SSE", len(jobList.Items)))
		h.tracingHelper.AddResourceAttributes(transformSpan, "", "jobs", len(response))
		h.tracingHelper.RecordSuccess(transformSpan, fmt.Sprintf("Transformed %d jobs", len(response)))

		return response, nil
	}

	// Get initial data
	initialData, err := fetchJobs()
	if err != nil {
		h.logger.WithError(err).Error("Failed to list jobs for SSE")
		// Check if this is a permission error
		if utils.IsPermissionError(err) {
			h.sseHandler.SendSSEPermissionError(c, err)
		} else {
			h.sseHandler.SendSSEError(c, http.StatusInternalServerError, err.Error())
		}
		return
	}

	// Check if this is an SSE request (EventSource expects SSE format)
	acceptHeader := c.GetHeader("Accept")
	if acceptHeader == "text/event-stream" {
		// Send SSE response with periodic updates
		h.sseHandler.SendSSEResponseWithUpdates(c, initialData, fetchJobs)
		return
	}

	// For non-SSE requests, return JSON
	c.JSON(http.StatusOK, initialData)
}

// GetJob returns a specific job
func (h *JobsHandler) GetJob(c *gin.Context) {
	// Start child span for client setup
	ctx, clientSpan := h.tracingHelper.StartAuthSpan(c.Request.Context(), "get-client-config")
	defer clientSpan.End()

	client, err := h.getClientAndConfig(c)
	if err != nil {
		h.logger.WithError(err).Error("Failed to get client for job")
		h.tracingHelper.RecordError(clientSpan, err, "Failed to get Kubernetes client")
		// For EventSource, send error as SSE
		if c.GetHeader("Accept") == "text/event-stream" {
			h.sseHandler.SendSSEError(c, http.StatusBadRequest, err.Error())
		} else {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		}
		return
	}
	h.tracingHelper.RecordSuccess(clientSpan, "Kubernetes client setup completed")

	namespace := c.Param("namespace")
	name := c.Param("name")

	// Start child span for Kubernetes API call
	_, k8sSpan := h.tracingHelper.StartKubernetesAPISpan(ctx, "get", "job", namespace)
	defer k8sSpan.End()

	job, err := client.BatchV1().Jobs(namespace).Get(c.Request.Context(), name, metav1.GetOptions{})
	if err != nil {
		h.logger.WithError(err).WithField("job", name).WithField("namespace", namespace).Error("Failed to get job")
		h.tracingHelper.RecordError(k8sSpan, err, "Failed to get job")
		// For EventSource, send error as SSE
		if c.GetHeader("Accept") == "text/event-stream" {
			h.sseHandler.SendSSEError(c, http.StatusNotFound, err.Error())
		} else {
			c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		}
		return
	}
	h.tracingHelper.AddResourceAttributes(k8sSpan, name, "job", 1)
	h.tracingHelper.RecordSuccess(k8sSpan, fmt.Sprintf("Retrieved job: %s", name))

	// Check if this is an SSE request (EventSource expects SSE format)
	acceptHeader := c.GetHeader("Accept")
	if acceptHeader == "text/event-stream" {
		h.sseHandler.SendSSEResponse(c, job)
		return
	}

	c.JSON(http.StatusOK, job)
}

// GetJobByName returns a specific job by name
func (h *JobsHandler) GetJobByName(c *gin.Context) {
	// Start child span for client setup
	ctx, clientSpan := h.tracingHelper.StartAuthSpan(c.Request.Context(), "get-client-config")
	defer clientSpan.End()

	client, err := h.getClientAndConfig(c)
	if err != nil {
		h.logger.WithError(err).Error("Failed to get client for job by name")
		h.tracingHelper.RecordError(clientSpan, err, "Failed to get Kubernetes client")
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	h.tracingHelper.RecordSuccess(clientSpan, "Kubernetes client setup completed")

	name := c.Param("name")
	namespace := c.Query("namespace")

	if namespace == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "namespace parameter is required"})
		return
	}

	// Start child span for Kubernetes API call
	_, k8sSpan := h.tracingHelper.StartKubernetesAPISpan(ctx, "get", "job", namespace)
	defer k8sSpan.End()

	job, err := client.BatchV1().Jobs(namespace).Get(c.Request.Context(), name, metav1.GetOptions{})
	if err != nil {
		h.logger.WithError(err).WithField("job", name).WithField("namespace", namespace).Error("Failed to get job by name")
		h.tracingHelper.RecordError(k8sSpan, err, "Failed to get job by name")
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}
	h.tracingHelper.AddResourceAttributes(k8sSpan, name, "job", 1)
	h.tracingHelper.RecordSuccess(k8sSpan, fmt.Sprintf("Retrieved job by name: %s", name))

	c.JSON(http.StatusOK, job)
}

// GetJobYAMLByName returns the YAML representation of a specific job by name
func (h *JobsHandler) GetJobYAMLByName(c *gin.Context) {
	// Start child span for client setup
	ctx, clientSpan := h.tracingHelper.StartAuthSpan(c.Request.Context(), "get-client-config")
	defer clientSpan.End()

	client, err := h.getClientAndConfig(c)
	if err != nil {
		h.logger.WithError(err).Error("Failed to get client for job YAML by name")
		h.tracingHelper.RecordError(clientSpan, err, "Failed to get Kubernetes client")
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	h.tracingHelper.RecordSuccess(clientSpan, "Kubernetes client setup completed")

	name := c.Param("name")
	namespace := c.Query("namespace")

	if namespace == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "namespace parameter is required"})
		return
	}

	// Start child span for Kubernetes API call
	_, k8sSpan := h.tracingHelper.StartKubernetesAPISpan(ctx, "get", "job", namespace)
	defer k8sSpan.End()

	job, err := client.BatchV1().Jobs(namespace).Get(c.Request.Context(), name, metav1.GetOptions{})
	if err != nil {
		h.logger.WithError(err).WithField("job", name).WithField("namespace", namespace).Error("Failed to get job for YAML by name")
		h.tracingHelper.RecordError(k8sSpan, err, "Failed to get job for YAML")
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}
	h.tracingHelper.AddResourceAttributes(k8sSpan, name, "job", 1)
	h.tracingHelper.RecordSuccess(k8sSpan, fmt.Sprintf("Retrieved job for YAML: %s", name))

	// Start child span for YAML generation
	_, yamlSpan := h.tracingHelper.StartDataProcessingSpan(ctx, "generate-yaml")
	defer yamlSpan.End()

	h.yamlHandler.SendYAMLResponse(c, job, name)
	h.tracingHelper.RecordSuccess(yamlSpan, "Generated YAML response")
}

// GetJobYAML returns the YAML representation of a specific job
func (h *JobsHandler) GetJobYAML(c *gin.Context) {
	// Start child span for client setup
	ctx, clientSpan := h.tracingHelper.StartAuthSpan(c.Request.Context(), "get-client-config")
	defer clientSpan.End()

	client, err := h.getClientAndConfig(c)
	if err != nil {
		h.logger.WithError(err).Error("Failed to get client for job YAML")
		h.tracingHelper.RecordError(clientSpan, err, "Failed to get Kubernetes client")
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	h.tracingHelper.RecordSuccess(clientSpan, "Kubernetes client setup completed")

	namespace := c.Param("namespace")
	name := c.Param("name")

	// Start child span for Kubernetes API call
	_, k8sSpan := h.tracingHelper.StartKubernetesAPISpan(ctx, "get", "job", namespace)
	defer k8sSpan.End()

	job, err := client.BatchV1().Jobs(namespace).Get(c.Request.Context(), name, metav1.GetOptions{})
	if err != nil {
		h.logger.WithError(err).WithField("job", name).WithField("namespace", namespace).Error("Failed to get job for YAML")
		h.tracingHelper.RecordError(k8sSpan, err, "Failed to get job for YAML")
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}
	h.tracingHelper.AddResourceAttributes(k8sSpan, name, "job", 1)
	h.tracingHelper.RecordSuccess(k8sSpan, fmt.Sprintf("Retrieved job for YAML: %s", name))

	// Start child span for YAML generation
	_, yamlSpan := h.tracingHelper.StartDataProcessingSpan(ctx, "generate-yaml")
	defer yamlSpan.End()

	h.yamlHandler.SendYAMLResponse(c, job, name)
	h.tracingHelper.RecordSuccess(yamlSpan, "Generated YAML response")
}

// GetJobEventsByName returns events for a specific job by name
func (h *JobsHandler) GetJobEventsByName(c *gin.Context) {
	client, err := h.getClientAndConfig(c)
	if err != nil {
		h.logger.WithError(err).Error("Failed to get client for job events")
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	name := c.Param("name")
	namespace := c.Query("namespace")

	if namespace == "" {
		h.logger.WithField("job", name).Error("Namespace is required for job events lookup")
		c.JSON(http.StatusBadRequest, gin.H{"error": "namespace parameter is required"})
		return
	}

	h.eventsHandler.GetResourceEventsWithNamespace(c, client, "Job", name, namespace, h.sseHandler.SendSSEResponse)
}

// GetJobEvents returns events for a specific job
func (h *JobsHandler) GetJobEvents(c *gin.Context) {
	client, err := h.getClientAndConfig(c)
	if err != nil {
		h.logger.WithError(err).Error("Failed to get client for job events")
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	name := c.Param("name")
	h.eventsHandler.GetResourceEvents(c, client, "Job", name, h.sseHandler.SendSSEResponse)
}

// GetJobPodsByName returns pods for a specific job by name
func (h *JobsHandler) GetJobPodsByName(c *gin.Context) {
	client, err := h.getClientAndConfig(c)
	if err != nil {
		h.logger.WithError(err).Error("Failed to get client for job pods by name")
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	name := c.Param("name")
	namespace := c.Query("namespace")

	if namespace == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "namespace parameter is required"})
		return
	}

	// Get the job to get its selector
	job, err := client.BatchV1().Jobs(namespace).Get(c.Request.Context(), name, metav1.GetOptions{})
	if err != nil {
		h.logger.WithError(err).WithField("job", name).WithField("namespace", namespace).Error("Failed to get job")
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	// Get pods using the job's selector
	selector := metav1.FormatLabelSelector(job.Spec.Selector)
	pods, err := client.CoreV1().Pods(namespace).List(c.Request.Context(), metav1.ListOptions{
		LabelSelector: selector,
	})
	if err != nil {
		h.logger.WithError(err).WithField("job", name).WithField("namespace", namespace).Error("Failed to get job pods")
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	// Transform pods to frontend-expected format
	configID := c.Query("config")
	clusterName := c.Query("cluster")
	var response []types.PodListResponse
	for _, pod := range pods.Items {
		response = append(response, transformers.TransformPodToResponse(&pod, configID, clusterName))
	}

	c.JSON(http.StatusOK, response)
}
