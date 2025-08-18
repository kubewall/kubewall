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
	batchv1 "k8s.io/api/batch/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/client-go/kubernetes"
)

// CronJobsHandler handles CronJob-related operations
type CronJobsHandler struct {
	store         *storage.KubeConfigStore
	clientFactory *k8s.ClientFactory
	logger        *logger.Logger
	eventsHandler *utils.EventsHandler
	yamlHandler   *utils.YAMLHandler
	sseHandler    *utils.SSEHandler
	tracingHelper *tracing.TracingHelper
}

// NewCronJobsHandler creates a new CronJobs handler
func NewCronJobsHandler(store *storage.KubeConfigStore, clientFactory *k8s.ClientFactory, log *logger.Logger) *CronJobsHandler {
	return &CronJobsHandler{
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
func (h *CronJobsHandler) getClientAndConfig(c *gin.Context) (*kubernetes.Clientset, error) {
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

// GetCronJobsSSE returns cronjobs as Server-Sent Events with real-time updates
func (h *CronJobsHandler) GetCronJobsSSE(c *gin.Context) {
	// Start child span for client setup
	ctx, clientSpan := h.tracingHelper.StartAuthSpan(c.Request.Context(), "setup-client-for-sse")
	defer clientSpan.End()

	client, err := h.getClientAndConfig(c)
	if err != nil {
		h.logger.WithError(err).Error("Failed to get client for cronjobs SSE")
		h.tracingHelper.RecordError(clientSpan, err, "Failed to get Kubernetes client")
		h.sseHandler.SendSSEError(c, http.StatusBadRequest, err.Error())
		return
	}
	h.tracingHelper.RecordSuccess(clientSpan, "Kubernetes client setup for SSE")

	namespace := c.Query("namespace")

	// Function to fetch cronjobs data
	fetchCronJobs := func() (interface{}, error) {
		// Start child span for data fetching
		_, fetchSpan := h.tracingHelper.StartKubernetesAPISpan(ctx, "list", "cronjobs", namespace)
		defer fetchSpan.End()

		cronJobList, err := client.BatchV1().CronJobs(namespace).List(c.Request.Context(), metav1.ListOptions{})
		if err != nil {
			h.tracingHelper.RecordError(fetchSpan, err, "Failed to list cronjobs for SSE")
			return nil, err
		}

		// Start child span for data transformation
		_, transformSpan := h.tracingHelper.StartDataProcessingSpan(ctx, "transform-cronjobs")
		defer transformSpan.End()

		// Transform cronjobs to frontend-expected format
		var response []types.CronJobListResponse
		for _, cronJob := range cronJobList.Items {
			response = append(response, transformers.TransformCronJobToResponse(&cronJob))
		}

		h.tracingHelper.AddResourceAttributes(fetchSpan, "", "cronjobs", len(cronJobList.Items))
		h.tracingHelper.RecordSuccess(fetchSpan, fmt.Sprintf("Listed %d cronjobs for SSE", len(cronJobList.Items)))
		h.tracingHelper.AddResourceAttributes(transformSpan, "", "cronjobs", len(response))
		h.tracingHelper.RecordSuccess(transformSpan, fmt.Sprintf("Transformed %d cronjobs", len(response)))

		return response, nil
	}

	// Get initial data
	initialData, err := fetchCronJobs()
	if err != nil {
		h.logger.WithError(err).Error("Failed to list cronjobs for SSE")
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
		h.sseHandler.SendSSEResponseWithUpdates(c, initialData, fetchCronJobs)
		return
	}

	// For non-SSE requests, return JSON
	c.JSON(http.StatusOK, initialData)
}

// GetCronJob returns a specific cronjob
func (h *CronJobsHandler) GetCronJob(c *gin.Context) {
	// Start child span for client setup
	ctx, clientSpan := h.tracingHelper.StartAuthSpan(c.Request.Context(), "get-client-config")
	defer clientSpan.End()

	client, err := h.getClientAndConfig(c)
	if err != nil {
		h.logger.WithError(err).Error("Failed to get client for cronjob")
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
	_, k8sSpan := h.tracingHelper.StartKubernetesAPISpan(ctx, "get", "cronjob", namespace)
	defer k8sSpan.End()

	cronJob, err := client.BatchV1().CronJobs(namespace).Get(c.Request.Context(), name, metav1.GetOptions{})
	if err != nil {
		h.logger.WithError(err).WithField("cronjob", name).WithField("namespace", namespace).Error("Failed to get cronjob")
		h.tracingHelper.RecordError(k8sSpan, err, "Failed to get cronjob")
		// For EventSource, send error as SSE
		if c.GetHeader("Accept") == "text/event-stream" {
			h.sseHandler.SendSSEError(c, http.StatusNotFound, err.Error())
		} else {
			c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		}
		return
	}
	h.tracingHelper.AddResourceAttributes(k8sSpan, name, "cronjob", 1)
	h.tracingHelper.RecordSuccess(k8sSpan, fmt.Sprintf("Retrieved cronjob: %s", name))

	// Check if this is an SSE request (EventSource expects SSE format)
	acceptHeader := c.GetHeader("Accept")
	if acceptHeader == "text/event-stream" {
		h.sseHandler.SendSSEResponse(c, cronJob)
		return
	}

	c.JSON(http.StatusOK, cronJob)
}

// GetCronJobByName returns a specific cronjob by name
func (h *CronJobsHandler) GetCronJobByName(c *gin.Context) {
	client, err := h.getClientAndConfig(c)
	if err != nil {
		h.logger.WithError(err).Error("Failed to get client for cronjob by name")
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	name := c.Param("name")
	namespace := c.Query("namespace")

	if namespace == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "namespace parameter is required"})
		return
	}

	cronJob, err := client.BatchV1().CronJobs(namespace).Get(c.Request.Context(), name, metav1.GetOptions{})
	if err != nil {
		h.logger.WithError(err).WithField("cronjob", name).WithField("namespace", namespace).Error("Failed to get cronjob by name")
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, cronJob)
}

// GetCronJobYAMLByName returns the YAML representation of a specific cronjob by name
func (h *CronJobsHandler) GetCronJobYAMLByName(c *gin.Context) {
	client, err := h.getClientAndConfig(c)
	if err != nil {
		h.logger.WithError(err).Error("Failed to get client for cronjob YAML by name")
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	name := c.Param("name")
	namespace := c.Query("namespace")

	if namespace == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "namespace parameter is required"})
		return
	}

	cronJob, err := client.BatchV1().CronJobs(namespace).Get(c.Request.Context(), name, metav1.GetOptions{})
	if err != nil {
		h.logger.WithError(err).WithField("cronjob", name).WithField("namespace", namespace).Error("Failed to get cronjob for YAML by name")
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	h.yamlHandler.SendYAMLResponse(c, cronJob, name)
}

// GetCronJobYAML returns the YAML representation of a specific cronjob
func (h *CronJobsHandler) GetCronJobYAML(c *gin.Context) {
	client, err := h.getClientAndConfig(c)
	if err != nil {
		h.logger.WithError(err).Error("Failed to get client for cronjob YAML")
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	namespace := c.Param("namespace")
	name := c.Param("name")

	cronJob, err := client.BatchV1().CronJobs(namespace).Get(c.Request.Context(), name, metav1.GetOptions{})
	if err != nil {
		h.logger.WithError(err).WithField("cronjob", name).WithField("namespace", namespace).Error("Failed to get cronjob for YAML")
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	h.yamlHandler.SendYAMLResponse(c, cronJob, name)
}

// GetCronJobEventsByName returns events for a specific cronjob by name
func (h *CronJobsHandler) GetCronJobEventsByName(c *gin.Context) {
	client, err := h.getClientAndConfig(c)
	if err != nil {
		h.logger.WithError(err).Error("Failed to get client for cronjob events")
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	name := c.Param("name")
	namespace := c.Query("namespace")

	if namespace == "" {
		h.logger.WithField("cronjob", name).Error("Namespace is required for cronjob events lookup")
		c.JSON(http.StatusBadRequest, gin.H{"error": "namespace parameter is required"})
		return
	}

	h.eventsHandler.GetResourceEventsWithNamespace(c, client, "CronJob", name, namespace, h.sseHandler.SendSSEResponse)
}

// GetCronJobEvents returns events for a specific cronjob
func (h *CronJobsHandler) GetCronJobEvents(c *gin.Context) {
	client, err := h.getClientAndConfig(c)
	if err != nil {
		h.logger.WithError(err).Error("Failed to get client for cronjob events")
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	name := c.Param("name")
	h.eventsHandler.GetResourceEvents(c, client, "CronJob", name, h.sseHandler.SendSSEResponse)
}

// GetCronJobJobsByName returns jobs for a specific cronjob by name
func (h *CronJobsHandler) GetCronJobJobsByName(c *gin.Context) {
	client, err := h.getClientAndConfig(c)
	if err != nil {
		h.logger.WithError(err).Error("Failed to get client for cronjob jobs by name")
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	name := c.Param("name")
	namespace := c.Query("namespace")

	if namespace == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "namespace parameter is required"})
		return
	}

	// Get jobs using the cronjob's name as a label selector
	jobs, err := client.BatchV1().Jobs(namespace).List(c.Request.Context(), metav1.ListOptions{
		LabelSelector: fmt.Sprintf("job-name=%s", name),
	})
	if err != nil {
		h.logger.WithError(err).WithField("cronjob", name).WithField("namespace", namespace).Error("Failed to get cronjob jobs")
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, jobs)
}

// TriggerCronJob manually triggers a CronJob by creating a job from it
func (h *CronJobsHandler) TriggerCronJob(c *gin.Context) {
	client, err := h.getClientAndConfig(c)
	if err != nil {
		h.logger.WithError(err).Error("Failed to get client for cronjob trigger")
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	namespace := c.Param("namespace")
	name := c.Param("name")

	// Get the CronJob
	cronJob, err := client.BatchV1().CronJobs(namespace).Get(c.Request.Context(), name, metav1.GetOptions{})
	if err != nil {
		h.logger.WithError(err).WithField("cronjob", name).WithField("namespace", namespace).Error("Failed to get cronjob for trigger")
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	// Create a job from the CronJob template
	job := &batchv1.Job{
		ObjectMeta: metav1.ObjectMeta{
			GenerateName: fmt.Sprintf("%s-manual-", name),
			Namespace:    namespace,
			Labels: map[string]string{
				"job-name": name,
			},
		},
		Spec: *cronJob.Spec.JobTemplate.Spec.DeepCopy(),
	}

	// Create the job
	createdJob, err := client.BatchV1().Jobs(namespace).Create(c.Request.Context(), job, metav1.CreateOptions{})
	if err != nil {
		h.logger.WithError(err).WithField("cronjob", name).WithField("namespace", namespace).Error("Failed to create job from cronjob")
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	h.logger.WithField("cronjob", name).WithField("job", createdJob.Name).WithField("namespace", namespace).Info("Successfully triggered cronjob")
	c.JSON(http.StatusOK, gin.H{
		"message": "CronJob triggered successfully",
		"job": gin.H{
			"name":      createdJob.Name,
			"namespace": createdJob.Namespace,
		},
	})
}
