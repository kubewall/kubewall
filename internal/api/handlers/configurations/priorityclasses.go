package configurations

import (
	"context"
	"fmt"
	"net/http"
	"time"

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

// PriorityClassesHandler handles PriorityClass-related API requests
type PriorityClassesHandler struct {
	store         *storage.KubeConfigStore
	clientFactory *k8s.ClientFactory
	logger        *logger.Logger
	sseHandler    *utils.SSEHandler
	yamlHandler   *utils.YAMLHandler
	eventsHandler *utils.EventsHandler
	tracingHelper *tracing.TracingHelper
}

// NewPriorityClassesHandler creates a new PriorityClassesHandler
func NewPriorityClassesHandler(store *storage.KubeConfigStore, clientFactory *k8s.ClientFactory, log *logger.Logger) *PriorityClassesHandler {
	return &PriorityClassesHandler{
		store:         store,
		clientFactory: clientFactory,
		logger:        log,
		sseHandler:    utils.NewSSEHandler(log),
		yamlHandler:   utils.NewYAMLHandler(log),
		eventsHandler: utils.NewEventsHandler(log),
		tracingHelper: tracing.GetTracingHelper(),
	}
}

// getClientAndConfig gets the Kubernetes client and config for the given config ID and cluster
func (h *PriorityClassesHandler) getClientAndConfig(c *gin.Context) (*kubernetes.Clientset, error) {
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

// GetPriorityClasses returns all priority classes
func (h *PriorityClassesHandler) GetPriorityClasses(c *gin.Context) {
	// Start child span for client setup
	ctx, clientSpan := h.tracingHelper.StartAuthSpan(c.Request.Context(), "get-client-config")
	defer clientSpan.End()

	client, err := h.getClientAndConfig(c)
	if err != nil {
		h.logger.WithError(err).Error("Failed to get client for priority classes")
		h.tracingHelper.RecordError(clientSpan, err, "Failed to get Kubernetes client")
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	h.tracingHelper.RecordSuccess(clientSpan, "Client setup completed")

	// Start child span for Kubernetes API call (cluster-scoped resource)
	_, k8sSpan := h.tracingHelper.StartKubernetesAPISpan(ctx, "list", "priorityclasses", "")
	defer k8sSpan.End()

	priorityClasses, err := client.SchedulingV1().PriorityClasses().List(ctx, metav1.ListOptions{})
	if err != nil {
		h.logger.WithError(err).Error("Failed to list priority classes")
		h.tracingHelper.RecordError(k8sSpan, err, "Failed to list priority classes")
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	h.tracingHelper.RecordSuccess(k8sSpan, "Successfully listed priority classes")
	h.tracingHelper.AddResourceAttributes(k8sSpan, "priorityclasses", "priorityclass", len(priorityClasses.Items))

	c.JSON(http.StatusOK, priorityClasses)
}

// GetPriorityClassesSSE returns priority classes as Server-Sent Events with real-time updates
func (h *PriorityClassesHandler) GetPriorityClassesSSE(c *gin.Context) {
	// Start child span for client setup
	ctx, clientSpan := h.tracingHelper.StartAuthSpan(c.Request.Context(), "setup-client-for-sse")
	defer clientSpan.End()

	client, err := h.getClientAndConfig(c)
	if err != nil {
		h.logger.WithError(err).Error("Failed to get client for priority classes SSE")
		h.tracingHelper.RecordError(clientSpan, err, "Failed to get client for priority classes SSE")
		h.sseHandler.SendSSEError(c, http.StatusBadRequest, err.Error())
		return
	}
	h.tracingHelper.RecordSuccess(clientSpan, "Client setup completed for priority classes SSE")

	// Function to fetch priority classes data
	fetchPriorityClasses := func() (interface{}, error) {
		// Start child span for data fetching
		_, fetchSpan := h.tracingHelper.StartKubernetesAPISpan(ctx, "list", "priorityclasses", "")
		defer fetchSpan.End()

		// Use context.Background() with timeout instead of request context to avoid cancellation
		fetchCtx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
		defer cancel()

		priorityClassList, err := client.SchedulingV1().PriorityClasses().List(fetchCtx, metav1.ListOptions{})
		if err != nil {
			h.tracingHelper.RecordError(fetchSpan, err, "Failed to fetch priority classes for SSE")
			return nil, err
		}
		h.tracingHelper.RecordSuccess(fetchSpan, "Successfully fetched priority classes for SSE")
		h.tracingHelper.AddResourceAttributes(fetchSpan, "priorityclasses", "priorityclass", len(priorityClassList.Items))

		// Start child span for data transformation
		_, transformSpan := h.tracingHelper.StartDataProcessingSpan(ctx, "transform-priorityclasses-sse")
		defer transformSpan.End()

		// Transform to response format
		var responses []types.PriorityClassListResponse
		for _, priorityClass := range priorityClassList.Items {
			response := transformers.TransformPriorityClassToResponse(&priorityClass)
			responses = append(responses, response)
		}
		h.tracingHelper.RecordSuccess(transformSpan, "Successfully transformed priority classes for SSE")
		h.tracingHelper.AddResourceAttributes(transformSpan, "transformed-priorityclasses", "priorityclass", len(responses))

		return responses, nil
	}

	initialData, err := fetchPriorityClasses()
	if err != nil {
		h.logger.WithError(err).Error("Failed to list priority classes for SSE")
		// Check if this is a permission error
		if utils.IsPermissionError(err) {
			h.sseHandler.SendSSEPermissionError(c, err)
		} else {
			h.sseHandler.SendSSEError(c, http.StatusInternalServerError, err.Error())
		}
		return
	}

	h.sseHandler.SendSSEResponseWithUpdates(c, initialData, fetchPriorityClasses)
}

// GetPriorityClass returns a specific priority class
func (h *PriorityClassesHandler) GetPriorityClass(c *gin.Context) {
	// Start child span for client setup
	ctx, clientSpan := h.tracingHelper.StartAuthSpan(c.Request.Context(), "get-client-config")
	defer clientSpan.End()

	client, err := h.getClientAndConfig(c)
	if err != nil {
		h.logger.WithError(err).Error("Failed to get client for priority class")
		h.tracingHelper.RecordError(clientSpan, err, "Failed to get Kubernetes client")
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	name := c.Param("name")
	if name == "" {
		h.tracingHelper.RecordError(clientSpan, fmt.Errorf("priority class name is required"), "Priority class name is required")
		c.JSON(http.StatusBadRequest, gin.H{"error": "priority class name is required"})
		return
	}
	h.tracingHelper.RecordSuccess(clientSpan, "Client setup completed")

	// Start child span for Kubernetes API call (cluster-scoped resource)
	_, k8sSpan := h.tracingHelper.StartKubernetesAPISpan(ctx, "get", "priorityclass", "")
	defer k8sSpan.End()

	priorityClass, err := client.SchedulingV1().PriorityClasses().Get(ctx, name, metav1.GetOptions{})
	if err != nil {
		h.logger.WithError(err).WithField("name", name).Error("Failed to get priority class")
		h.tracingHelper.RecordError(k8sSpan, err, "Failed to get priority class")
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	h.tracingHelper.RecordSuccess(k8sSpan, "Successfully retrieved priority class")
	h.tracingHelper.AddResourceAttributes(k8sSpan, name, "priorityclass", 1)

	c.JSON(http.StatusOK, priorityClass)
}

// GetPriorityClassByName returns a specific priority class by name
func (h *PriorityClassesHandler) GetPriorityClassByName(c *gin.Context) {
	// Start child span for client setup
	ctx, clientSpan := h.tracingHelper.StartAuthSpan(c.Request.Context(), "get-client-config")
	defer clientSpan.End()

	client, err := h.getClientAndConfig(c)
	if err != nil {
		h.logger.WithError(err).Error("Failed to get client for priority class by name")
		h.tracingHelper.RecordError(clientSpan, err, "Failed to get Kubernetes client")
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	name := c.Param("name")
	if name == "" {
		h.tracingHelper.RecordError(clientSpan, fmt.Errorf("priority class name is required"), "Priority class name is required")
		c.JSON(http.StatusBadRequest, gin.H{"error": "priority class name is required"})
		return
	}
	h.tracingHelper.RecordSuccess(clientSpan, "Client setup completed")

	// Start child span for Kubernetes API call (cluster-scoped resource)
	_, k8sSpan := h.tracingHelper.StartKubernetesAPISpan(ctx, "get", "priorityclass", "")
	defer k8sSpan.End()

	priorityClass, err := client.SchedulingV1().PriorityClasses().Get(ctx, name, metav1.GetOptions{})
	if err != nil {
		h.logger.WithError(err).WithField("name", name).Error("Failed to get priority class by name")
		h.tracingHelper.RecordError(k8sSpan, err, "Failed to get priority class by name")
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	h.tracingHelper.RecordSuccess(k8sSpan, "Successfully retrieved priority class by name")
	h.tracingHelper.AddResourceAttributes(k8sSpan, name, "priorityclass", 1)

	c.JSON(http.StatusOK, priorityClass)
}

// GetPriorityClassYAMLByName returns the YAML representation of a specific priority class by name
func (h *PriorityClassesHandler) GetPriorityClassYAMLByName(c *gin.Context) {
	// Start child span for client setup
	ctx, clientSpan := h.tracingHelper.StartAuthSpan(c.Request.Context(), "get-client-config")
	defer clientSpan.End()

	client, err := h.getClientAndConfig(c)
	if err != nil {
		h.logger.WithError(err).Error("Failed to get client for priority class YAML by name")
		h.tracingHelper.RecordError(clientSpan, err, "Failed to get Kubernetes client")
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	name := c.Param("name")
	if name == "" {
		h.tracingHelper.RecordError(clientSpan, fmt.Errorf("priority class name is required"), "Priority class name is required")
		c.JSON(http.StatusBadRequest, gin.H{"error": "priority class name is required"})
		return
	}
	h.tracingHelper.RecordSuccess(clientSpan, "Client setup completed")

	// Start child span for Kubernetes API call (cluster-scoped resource)
	_, k8sSpan := h.tracingHelper.StartKubernetesAPISpan(ctx, "get", "priorityclass", "")
	defer k8sSpan.End()

	priorityClass, err := client.SchedulingV1().PriorityClasses().Get(ctx, name, metav1.GetOptions{})
	if err != nil {
		h.logger.WithError(err).WithField("name", name).Error("Failed to get priority class for YAML by name")
		h.tracingHelper.RecordError(k8sSpan, err, "Failed to get priority class for YAML by name")
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	h.tracingHelper.RecordSuccess(k8sSpan, "Successfully retrieved priority class for YAML by name")
	h.tracingHelper.AddResourceAttributes(k8sSpan, name, "priorityclass", 1)

	// Start child span for YAML generation
	_, yamlSpan := h.tracingHelper.StartDataProcessingSpan(ctx, "generate-yaml")
	defer yamlSpan.End()

	h.yamlHandler.SendYAMLResponse(c, priorityClass, name)
	h.tracingHelper.RecordSuccess(yamlSpan, "Successfully generated YAML response")
}

// GetPriorityClassYAML returns the YAML representation of a specific priority class
func (h *PriorityClassesHandler) GetPriorityClassYAML(c *gin.Context) {
	// Start child span for client setup
	ctx, clientSpan := h.tracingHelper.StartAuthSpan(c.Request.Context(), "get-client-config")
	defer clientSpan.End()

	client, err := h.getClientAndConfig(c)
	if err != nil {
		h.logger.WithError(err).Error("Failed to get client for priority class YAML")
		h.tracingHelper.RecordError(clientSpan, err, "Failed to get Kubernetes client")
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	name := c.Param("name")
	if name == "" {
		h.tracingHelper.RecordError(clientSpan, fmt.Errorf("priority class name is required"), "Priority class name is required")
		c.JSON(http.StatusBadRequest, gin.H{"error": "priority class name is required"})
		return
	}
	h.tracingHelper.RecordSuccess(clientSpan, "Client setup completed")

	// Start child span for Kubernetes API call (cluster-scoped resource)
	_, k8sSpan := h.tracingHelper.StartKubernetesAPISpan(ctx, "get", "priorityclass", "")
	defer k8sSpan.End()

	priorityClass, err := client.SchedulingV1().PriorityClasses().Get(ctx, name, metav1.GetOptions{})
	if err != nil {
		h.logger.WithError(err).WithField("name", name).Error("Failed to get priority class for YAML")
		h.tracingHelper.RecordError(k8sSpan, err, "Failed to get priority class for YAML")
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	h.tracingHelper.RecordSuccess(k8sSpan, "Successfully retrieved priority class for YAML")
	h.tracingHelper.AddResourceAttributes(k8sSpan, name, "priorityclass", 1)

	// Start child span for YAML generation
	_, yamlSpan := h.tracingHelper.StartDataProcessingSpan(ctx, "generate-yaml")
	defer yamlSpan.End()

	h.yamlHandler.SendYAMLResponse(c, priorityClass, name)
	h.tracingHelper.RecordSuccess(yamlSpan, "Successfully generated YAML response")
}

// GetPriorityClassEventsByName returns events for a specific priority class by name
func (h *PriorityClassesHandler) GetPriorityClassEventsByName(c *gin.Context) {
	// Start child span for client setup
	ctx, clientSpan := h.tracingHelper.StartAuthSpan(c.Request.Context(), "get-client-config")
	defer clientSpan.End()

	client, err := h.getClientAndConfig(c)
	if err != nil {
		h.logger.WithError(err).Error("Failed to get client for priority class events by name")
		h.tracingHelper.RecordError(clientSpan, err, "Failed to get Kubernetes client")
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	name := c.Param("name")
	if name == "" {
		h.tracingHelper.RecordError(clientSpan, fmt.Errorf("priority class name is required"), "Priority class name is required")
		c.JSON(http.StatusBadRequest, gin.H{"error": "priority class name is required"})
		return
	}
	h.tracingHelper.RecordSuccess(clientSpan, "Client setup completed")

	// Start child span for events retrieval (cluster-scoped resource)
	_, eventsSpan := h.tracingHelper.StartKubernetesAPISpan(ctx, "list", "events", "")
	defer eventsSpan.End()

	h.eventsHandler.GetResourceEvents(c, client, "PriorityClass", name, h.sseHandler.SendSSEResponse)
	h.tracingHelper.RecordSuccess(eventsSpan, "Successfully retrieved priority class events by name")
	h.tracingHelper.AddResourceAttributes(eventsSpan, name, "priorityclass-events", 1)
}

// GetPriorityClassEvents returns events for a specific priority class
func (h *PriorityClassesHandler) GetPriorityClassEvents(c *gin.Context) {
	// Start child span for client setup
	ctx, clientSpan := h.tracingHelper.StartAuthSpan(c.Request.Context(), "get-client-config")
	defer clientSpan.End()

	client, err := h.getClientAndConfig(c)
	if err != nil {
		h.logger.WithError(err).Error("Failed to get client for priority class events")
		h.tracingHelper.RecordError(clientSpan, err, "Failed to get Kubernetes client")
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	name := c.Param("name")
	if name == "" {
		h.tracingHelper.RecordError(clientSpan, fmt.Errorf("priority class name is required"), "Priority class name is required")
		c.JSON(http.StatusBadRequest, gin.H{"error": "priority class name is required"})
		return
	}
	h.tracingHelper.RecordSuccess(clientSpan, "Client setup completed")

	// Start child span for events retrieval (cluster-scoped resource)
	_, eventsSpan := h.tracingHelper.StartKubernetesAPISpan(ctx, "list", "events", "")
	defer eventsSpan.End()

	h.eventsHandler.GetResourceEvents(c, client, "PriorityClass", name, h.sseHandler.SendSSEResponse)
	h.tracingHelper.RecordSuccess(eventsSpan, "Successfully retrieved priority class events")
	h.tracingHelper.AddResourceAttributes(eventsSpan, name, "priorityclass-events", 1)
}
