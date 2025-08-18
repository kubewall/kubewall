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

// RuntimeClassesHandler handles RuntimeClass-related API requests
type RuntimeClassesHandler struct {
	store         *storage.KubeConfigStore
	clientFactory *k8s.ClientFactory
	logger        *logger.Logger
	sseHandler    *utils.SSEHandler
	yamlHandler   *utils.YAMLHandler
	eventsHandler *utils.EventsHandler
	tracingHelper *tracing.TracingHelper
}

// NewRuntimeClassesHandler creates a new RuntimeClassesHandler
func NewRuntimeClassesHandler(store *storage.KubeConfigStore, clientFactory *k8s.ClientFactory, log *logger.Logger) *RuntimeClassesHandler {
	return &RuntimeClassesHandler{
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
func (h *RuntimeClassesHandler) getClientAndConfig(c *gin.Context) (*kubernetes.Clientset, error) {
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

// GetRuntimeClasses returns all runtime classes
func (h *RuntimeClassesHandler) GetRuntimeClasses(c *gin.Context) {
	// Start child span for client setup
	ctx, clientSpan := h.tracingHelper.StartAuthSpan(c.Request.Context(), "get-client-config")
	defer clientSpan.End()

	client, err := h.getClientAndConfig(c)
	if err != nil {
		h.logger.WithError(err).Error("Failed to get client for runtime classes")
		h.tracingHelper.RecordError(clientSpan, err, "Failed to get Kubernetes client")
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	h.tracingHelper.RecordSuccess(clientSpan, "Client setup completed")

	// Start child span for Kubernetes API call (cluster-scoped resource)
	_, k8sSpan := h.tracingHelper.StartKubernetesAPISpan(ctx, "list", "runtimeclasses", "")
	defer k8sSpan.End()

	runtimeClasses, err := client.NodeV1().RuntimeClasses().List(ctx, metav1.ListOptions{})
	if err != nil {
		h.logger.WithError(err).Error("Failed to list runtime classes")
		h.tracingHelper.RecordError(k8sSpan, err, "Failed to list runtime classes")
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	h.tracingHelper.RecordSuccess(k8sSpan, "Successfully listed runtime classes")
	h.tracingHelper.AddResourceAttributes(k8sSpan, "runtimeclasses", "runtimeclass", len(runtimeClasses.Items))

	c.JSON(http.StatusOK, runtimeClasses)
}

// GetRuntimeClassesSSE streams runtime classes via SSE
func (h *RuntimeClassesHandler) GetRuntimeClassesSSE(c *gin.Context) {
	// Start child span for client setup
	ctx, clientSpan := h.tracingHelper.StartAuthSpan(c.Request.Context(), "get-client-config")
	defer clientSpan.End()

	client, err := h.getClientAndConfig(c)
	if err != nil {
		h.tracingHelper.RecordError(clientSpan, err, "Failed to get Kubernetes client")
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	h.tracingHelper.RecordSuccess(clientSpan, "Client setup completed")

	// Define the fetch function for periodic updates
	fetchRuntimeClasses := func() (interface{}, error) {
		// Start child span for Kubernetes API call with timeout (cluster-scoped resource)
		ctxWithTimeout, cancel := context.WithTimeout(ctx, 30*time.Second)
		defer cancel()
		_, k8sSpan := h.tracingHelper.StartKubernetesAPISpan(ctxWithTimeout, "list", "runtimeclasses", "")
		defer k8sSpan.End()

		runtimeClasses, err := client.NodeV1().RuntimeClasses().List(ctxWithTimeout, metav1.ListOptions{})
		if err != nil {
			h.tracingHelper.RecordError(k8sSpan, err, "Failed to list runtime classes")
			return nil, err
		}
		h.tracingHelper.RecordSuccess(k8sSpan, "Successfully listed runtime classes")
		h.tracingHelper.AddResourceAttributes(k8sSpan, "runtimeclasses", "runtimeclass", len(runtimeClasses.Items))

		// Start child span for data transformation
		_, transformSpan := h.tracingHelper.StartDataProcessingSpan(ctxWithTimeout, "transform-runtimeclasses")
		defer transformSpan.End()

		var response []types.RuntimeClassListResponse
		for _, runtimeClass := range runtimeClasses.Items {
			response = append(response, transformers.TransformRuntimeClassToResponse(&runtimeClass))
		}
		h.tracingHelper.RecordSuccess(transformSpan, "Successfully transformed runtime classes")

		return response, nil
	}

	// Get initial data
	initialData, err := fetchRuntimeClasses()
	if err != nil {
		h.logger.WithError(err).Error("Failed to fetch runtime classes")
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	h.sseHandler.SendSSEResponseWithUpdates(c, initialData, fetchRuntimeClasses)
}

// GetRuntimeClass returns a specific runtime class
func (h *RuntimeClassesHandler) GetRuntimeClass(c *gin.Context) {
	name := c.Param("name")
	if name == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Runtime class name is required"})
		return
	}

	// Start child span for client setup
	ctx, clientSpan := h.tracingHelper.StartAuthSpan(c.Request.Context(), "get-client-config")
	defer clientSpan.End()

	client, err := h.getClientAndConfig(c)
	if err != nil {
		h.logger.WithError(err).Error("Failed to get client for runtime class")
		h.tracingHelper.RecordError(clientSpan, err, "Failed to get Kubernetes client")
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	h.tracingHelper.RecordSuccess(clientSpan, "Client setup completed")

	// Start child span for Kubernetes API call (cluster-scoped resource)
	_, k8sSpan := h.tracingHelper.StartKubernetesAPISpan(ctx, "get", "runtimeclass", "")
	defer k8sSpan.End()

	runtimeClass, err := client.NodeV1().RuntimeClasses().Get(ctx, name, metav1.GetOptions{})
	if err != nil {
		h.logger.WithError(err).WithField("name", name).Error("Failed to get runtime class")
		h.tracingHelper.RecordError(k8sSpan, err, "Failed to get runtime class")
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	h.tracingHelper.RecordSuccess(k8sSpan, "Successfully retrieved runtime class")
	h.tracingHelper.AddResourceAttributes(k8sSpan, "runtimeclass", name, 1)

	c.JSON(http.StatusOK, runtimeClass)
}

// GetRuntimeClassByName returns a specific runtime class by name
func (h *RuntimeClassesHandler) GetRuntimeClassByName(c *gin.Context) {
	name := c.Param("name")
	if name == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Runtime class name is required"})
		return
	}

	// Start child span for client setup
	ctx, clientSpan := h.tracingHelper.StartAuthSpan(c.Request.Context(), "get-client-config")
	defer clientSpan.End()

	client, err := h.getClientAndConfig(c)
	if err != nil {
		h.logger.WithError(err).Error("Failed to get client for runtime class by name")
		h.tracingHelper.RecordError(clientSpan, err, "Failed to get Kubernetes client")
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	h.tracingHelper.RecordSuccess(clientSpan, "Client setup completed")

	// Start child span for Kubernetes API call (cluster-scoped resource)
	_, k8sSpan := h.tracingHelper.StartKubernetesAPISpan(ctx, "get", "runtimeclass", "")
	defer k8sSpan.End()

	runtimeClass, err := client.NodeV1().RuntimeClasses().Get(ctx, name, metav1.GetOptions{})
	if err != nil {
		h.logger.WithError(err).WithField("name", name).Error("Failed to get runtime class by name")
		h.tracingHelper.RecordError(k8sSpan, err, "Failed to get runtime class")
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	h.tracingHelper.RecordSuccess(k8sSpan, "Successfully retrieved runtime class")
	h.tracingHelper.AddResourceAttributes(k8sSpan, "runtimeclass", name, 1)

	response := transformers.TransformRuntimeClassToResponse(runtimeClass)
	c.JSON(http.StatusOK, response)
}

// GetRuntimeClassYAMLByName returns the YAML representation of a specific runtime class by name
func (h *RuntimeClassesHandler) GetRuntimeClassYAMLByName(c *gin.Context) {
	name := c.Param("name")
	if name == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Runtime class name is required"})
		return
	}

	// Start child span for client setup
	ctx, clientSpan := h.tracingHelper.StartAuthSpan(c.Request.Context(), "get-client-config")
	defer clientSpan.End()

	client, err := h.getClientAndConfig(c)
	if err != nil {
		h.logger.WithError(err).Error("Failed to get client for runtime class YAML")
		h.tracingHelper.RecordError(clientSpan, err, "Failed to get Kubernetes client")
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	h.tracingHelper.RecordSuccess(clientSpan, "Client setup completed")

	// Start child span for Kubernetes API call (cluster-scoped resource)
	_, k8sSpan := h.tracingHelper.StartKubernetesAPISpan(ctx, "get", "runtimeclass", "")
	defer k8sSpan.End()

	runtimeClass, err := client.NodeV1().RuntimeClasses().Get(ctx, name, metav1.GetOptions{})
	if err != nil {
		h.logger.WithError(err).Error("Failed to get runtime class for YAML")
		h.tracingHelper.RecordError(k8sSpan, err, "Failed to get runtime class")
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	h.tracingHelper.RecordSuccess(k8sSpan, "Successfully retrieved runtime class")
	h.tracingHelper.AddResourceAttributes(k8sSpan, "runtimeclass", name, 1)

	h.yamlHandler.SendYAMLResponse(c, runtimeClass, name)
}

// GetRuntimeClassYAML returns the YAML representation of a specific runtime class
func (h *RuntimeClassesHandler) GetRuntimeClassYAML(c *gin.Context) {
	name := c.Param("name")
	if name == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Runtime class name is required"})
		return
	}

	// Start child span for client setup
	ctx, clientSpan := h.tracingHelper.StartAuthSpan(c.Request.Context(), "get-client-config")
	defer clientSpan.End()

	client, err := h.getClientAndConfig(c)
	if err != nil {
		h.logger.WithError(err).Error("Failed to get client for runtime class YAML")
		h.tracingHelper.RecordError(clientSpan, err, "Failed to get Kubernetes client")
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	h.tracingHelper.RecordSuccess(clientSpan, "Client setup completed")

	// Start child span for Kubernetes API call (cluster-scoped resource)
	_, k8sSpan := h.tracingHelper.StartKubernetesAPISpan(ctx, "get", "runtimeclass", "")
	defer k8sSpan.End()

	runtimeClass, err := client.NodeV1().RuntimeClasses().Get(ctx, name, metav1.GetOptions{})
	if err != nil {
		h.logger.WithError(err).Error("Failed to get runtime class for YAML")
		h.tracingHelper.RecordError(k8sSpan, err, "Failed to get runtime class")
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	h.tracingHelper.RecordSuccess(k8sSpan, "Successfully retrieved runtime class")
	h.tracingHelper.AddResourceAttributes(k8sSpan, "runtimeclass", name, 1)

	h.yamlHandler.SendYAMLResponse(c, runtimeClass, name)
}

// GetRuntimeClassEventsByName returns events for a specific runtime class by name
func (h *RuntimeClassesHandler) GetRuntimeClassEventsByName(c *gin.Context) {
	name := c.Param("name")
	if name == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Runtime class name is required"})
		return
	}

	// Start child span for client setup
	ctx, clientSpan := h.tracingHelper.StartAuthSpan(c.Request.Context(), "get-client-config")
	defer clientSpan.End()

	client, err := h.getClientAndConfig(c)
	if err != nil {
		h.logger.WithError(err).Error("Failed to get client for runtime class events")
		h.tracingHelper.RecordError(clientSpan, err, "Failed to get Kubernetes client")
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	h.tracingHelper.RecordSuccess(clientSpan, "Client setup completed")

	// Start child span for Kubernetes API call (cluster-scoped resource)
	_, k8sSpan := h.tracingHelper.StartKubernetesAPISpan(ctx, "list", "events", "")
	defer k8sSpan.End()

	h.eventsHandler.GetResourceEvents(c, client, "RuntimeClass", name, h.sseHandler.SendSSEResponse)
}

// GetRuntimeClassEvents returns events for a specific runtime class
func (h *RuntimeClassesHandler) GetRuntimeClassEvents(c *gin.Context) {
	name := c.Param("name")
	if name == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Runtime class name is required"})
		return
	}

	// Start child span for client setup
	ctx, clientSpan := h.tracingHelper.StartAuthSpan(c.Request.Context(), "get-client-config")
	defer clientSpan.End()

	client, err := h.getClientAndConfig(c)
	if err != nil {
		h.logger.WithError(err).Error("Failed to get client for runtime class events")
		h.tracingHelper.RecordError(clientSpan, err, "Failed to get Kubernetes client")
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	h.tracingHelper.RecordSuccess(clientSpan, "Client setup completed")

	// Start child span for Kubernetes API call (cluster-scoped resource)
	_, k8sSpan := h.tracingHelper.StartKubernetesAPISpan(ctx, "list", "events", "")
	defer k8sSpan.End()

	h.eventsHandler.GetResourceEvents(c, client, "RuntimeClass", name, h.sseHandler.SendSSEResponse)
}
