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

// ConfigMapsHandler handles ConfigMap-related API requests
type ConfigMapsHandler struct {
	store         *storage.KubeConfigStore
	clientFactory *k8s.ClientFactory
	logger        *logger.Logger
	sseHandler    *utils.SSEHandler
	yamlHandler   *utils.YAMLHandler
	eventsHandler *utils.EventsHandler
	tracingHelper *tracing.TracingHelper
}

// NewConfigMapsHandler creates a new ConfigMapsHandler
func NewConfigMapsHandler(store *storage.KubeConfigStore, clientFactory *k8s.ClientFactory, log *logger.Logger) *ConfigMapsHandler {
	return &ConfigMapsHandler{
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
func (h *ConfigMapsHandler) getClientAndConfig(c *gin.Context) (*kubernetes.Clientset, error) {
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

// GetConfigMaps returns all configmaps in a namespace
func (h *ConfigMapsHandler) GetConfigMaps(c *gin.Context) {
	// Start child span for client setup
	ctx, clientSpan := h.tracingHelper.StartAuthSpan(c.Request.Context(), "setup-client")
	defer clientSpan.End()

	client, err := h.getClientAndConfig(c)
	if err != nil {
		h.logger.WithError(err).Error("Failed to get client for configmaps")
		h.tracingHelper.RecordError(clientSpan, err, "Failed to get client for configmaps")
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	h.tracingHelper.RecordSuccess(clientSpan, "Client setup completed for configmaps")

	namespace := c.Query("namespace")

	// Start child span for Kubernetes API call
	_, k8sSpan := h.tracingHelper.StartKubernetesAPISpan(ctx, "list", "configmap", namespace)
	defer k8sSpan.End()

	configMapList, err := client.CoreV1().ConfigMaps(namespace).List(ctx, metav1.ListOptions{})
	if err != nil {
		h.logger.WithError(err).Error("Failed to list configmaps")
		h.tracingHelper.RecordError(k8sSpan, err, "Failed to list configmaps")
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	h.tracingHelper.AddResourceAttributes(k8sSpan, "configmaps", "configmap", len(configMapList.Items))
	h.tracingHelper.RecordSuccess(k8sSpan, "Successfully listed configmaps")

	// Start child span for data processing
	_, processSpan := h.tracingHelper.StartDataProcessingSpan(ctx, "transform-data")
	defer processSpan.End()

	// Transform configmaps to the expected format
	var transformedConfigMaps []types.ConfigMapListResponse
	for _, configMap := range configMapList.Items {
		transformedConfigMaps = append(transformedConfigMaps, transformers.TransformConfigMapToResponse(&configMap))
	}
	h.tracingHelper.RecordSuccess(processSpan, "Successfully transformed configmaps data")

	c.JSON(http.StatusOK, transformedConfigMaps)
}

// GetConfigMapsSSE returns configmaps as Server-Sent Events with real-time updates
func (h *ConfigMapsHandler) GetConfigMapsSSE(c *gin.Context) {
	// Start child span for client setup
	ctx, clientSpan := h.tracingHelper.StartAuthSpan(c.Request.Context(), "setup-client-for-sse")
	defer clientSpan.End()

	client, err := h.getClientAndConfig(c)
	if err != nil {
		h.logger.WithError(err).Error("Failed to get client for configmaps SSE")
		h.tracingHelper.RecordError(clientSpan, err, "Failed to get client for configmaps SSE")
		h.sseHandler.SendSSEError(c, http.StatusBadRequest, err.Error())
		return
	}
	h.tracingHelper.RecordSuccess(clientSpan, "Client setup completed for configmaps SSE")

	namespace := c.Query("namespace")

	// Function to fetch and transform configmaps data
	fetchConfigMaps := func() (interface{}, error) {
		// Use context.Background() with timeout instead of request context to avoid cancellation
		fetchCtx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
		defer cancel()

		// Start child span for Kubernetes API call
		_, k8sSpan := h.tracingHelper.StartKubernetesAPISpan(ctx, "list", "configmap", namespace)
		defer k8sSpan.End()

		configMapList, err := client.CoreV1().ConfigMaps(namespace).List(fetchCtx, metav1.ListOptions{})
		if err != nil {
			h.tracingHelper.RecordError(k8sSpan, err, "Failed to list configmaps")
			return nil, err
		}
		h.tracingHelper.AddResourceAttributes(k8sSpan, "configmaps", "configmap", len(configMapList.Items))
		h.tracingHelper.RecordSuccess(k8sSpan, "Successfully listed configmaps")

		// Start child span for data processing
		_, processSpan := h.tracingHelper.StartDataProcessingSpan(ctx, "transform-data")
		defer processSpan.End()

		// Transform configmaps to the expected format
		var transformedConfigMaps []types.ConfigMapListResponse
		for _, configMap := range configMapList.Items {
			transformedConfigMaps = append(transformedConfigMaps, transformers.TransformConfigMapToResponse(&configMap))
		}
		h.tracingHelper.RecordSuccess(processSpan, "Successfully transformed configmaps data")

		return transformedConfigMaps, nil
	}

	// Get initial data
	initialData, err := fetchConfigMaps()
	if err != nil {
		h.logger.WithError(err).Error("Failed to list configmaps for SSE")

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
		h.sseHandler.SendSSEResponseWithUpdates(c, initialData, fetchConfigMaps)
		return
	}

	// For non-SSE requests, return JSON
	c.JSON(http.StatusOK, initialData)
}

// GetConfigMap returns a specific configmap
func (h *ConfigMapsHandler) GetConfigMap(c *gin.Context) {
	// Start child span for client setup
	ctx, clientSpan := h.tracingHelper.StartAuthSpan(c.Request.Context(), "setup-client")
	defer clientSpan.End()

	client, err := h.getClientAndConfig(c)
	if err != nil {
		h.logger.WithError(err).Error("Failed to get client for configmap")
		h.tracingHelper.RecordError(clientSpan, err, "Failed to get client for configmap")
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	h.tracingHelper.RecordSuccess(clientSpan, "Client setup completed for configmap")

	namespace := c.Param("namespace")
	name := c.Param("name")

	// Start child span for Kubernetes API call
	_, k8sSpan := h.tracingHelper.StartKubernetesAPISpan(ctx, "get", "configmap", namespace)
	defer k8sSpan.End()

	configMap, err := client.CoreV1().ConfigMaps(namespace).Get(ctx, name, metav1.GetOptions{})
	if err != nil {
		h.logger.WithError(err).WithField("configmap", name).WithField("namespace", namespace).Error("Failed to get configmap")
		h.tracingHelper.RecordError(k8sSpan, err, "Failed to get configmap")
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}
	h.tracingHelper.AddResourceAttributes(k8sSpan, name, "configmap", 1)
	h.tracingHelper.RecordSuccess(k8sSpan, "Successfully retrieved configmap")

	// Always send SSE format for detail endpoints since they're used by EventSource
	h.sseHandler.SendSSEResponse(c, configMap)
}

// GetConfigMapByName returns a specific configmap by name using namespace from query parameters
func (h *ConfigMapsHandler) GetConfigMapByName(c *gin.Context) {
	// Start child span for client setup
	ctx, clientSpan := h.tracingHelper.StartAuthSpan(c.Request.Context(), "setup-client")
	defer clientSpan.End()

	client, err := h.getClientAndConfig(c)
	if err != nil {
		h.logger.WithError(err).Error("Failed to get client for configmap")
		h.tracingHelper.RecordError(clientSpan, err, "Failed to get client for configmap")
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	h.tracingHelper.RecordSuccess(clientSpan, "Client setup completed for configmap")

	name := c.Param("name")
	namespace := c.Query("namespace")

	if namespace == "" {
		h.logger.WithField("configmap", name).Error("Namespace is required for configmap lookup")
		c.JSON(http.StatusBadRequest, gin.H{"error": "namespace parameter is required"})
		return
	}

	// Start child span for Kubernetes API call
	_, k8sSpan := h.tracingHelper.StartKubernetesAPISpan(ctx, "get", "configmap", namespace)
	defer k8sSpan.End()

	configMap, err := client.CoreV1().ConfigMaps(namespace).Get(ctx, name, metav1.GetOptions{})
	if err != nil {
		h.logger.WithError(err).WithField("configmap", name).WithField("namespace", namespace).Error("Failed to get configmap")
		h.tracingHelper.RecordError(k8sSpan, err, "Failed to get configmap")
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}
	h.tracingHelper.AddResourceAttributes(k8sSpan, name, "configmap", 1)
	h.tracingHelper.RecordSuccess(k8sSpan, "Successfully retrieved configmap by name")

	// Always send SSE format for detail endpoints since they're used by EventSource
	h.sseHandler.SendSSEResponse(c, configMap)
}

// GetConfigMapYAMLByName returns the YAML representation of a specific configmap by name using namespace from query parameters
func (h *ConfigMapsHandler) GetConfigMapYAMLByName(c *gin.Context) {
	// Start child span for client setup
	ctx, clientSpan := h.tracingHelper.StartAuthSpan(c.Request.Context(), "setup-client")
	defer clientSpan.End()

	client, err := h.getClientAndConfig(c)
	if err != nil {
		h.logger.WithError(err).Error("Failed to get client for configmap YAML")
		h.tracingHelper.RecordError(clientSpan, err, "Failed to get client for configmap YAML")
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	h.tracingHelper.RecordSuccess(clientSpan, "Client setup completed for configmap YAML")

	name := c.Param("name")
	namespace := c.Query("namespace")

	if namespace == "" {
		h.logger.WithField("configmap", name).Error("Namespace is required for configmap YAML lookup")
		c.JSON(http.StatusBadRequest, gin.H{"error": "namespace parameter is required"})
		return
	}

	// Start child span for Kubernetes API call
	_, k8sSpan := h.tracingHelper.StartKubernetesAPISpan(ctx, "get", "configmap", namespace)
	defer k8sSpan.End()

	configMap, err := client.CoreV1().ConfigMaps(namespace).Get(ctx, name, metav1.GetOptions{})
	if err != nil {
		h.logger.WithError(err).WithField("configmap", name).WithField("namespace", namespace).Error("Failed to get configmap for YAML")
		h.tracingHelper.RecordError(k8sSpan, err, "Failed to get configmap for YAML")
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}
	h.tracingHelper.AddResourceAttributes(k8sSpan, name, "configmap", 1)
	h.tracingHelper.RecordSuccess(k8sSpan, "Successfully retrieved configmap for YAML")

	// Start child span for YAML generation
	_, yamlSpan := h.tracingHelper.StartDataProcessingSpan(ctx, "generate-yaml")
	defer yamlSpan.End()

	h.yamlHandler.SendYAMLResponse(c, configMap, name)
	h.tracingHelper.RecordSuccess(yamlSpan, "Successfully generated YAML for configmap")
}

// GetConfigMapYAML returns the YAML representation of a specific configmap
func (h *ConfigMapsHandler) GetConfigMapYAML(c *gin.Context) {
	// Start child span for client setup
	ctx, clientSpan := h.tracingHelper.StartAuthSpan(c.Request.Context(), "setup-client")
	defer clientSpan.End()

	client, err := h.getClientAndConfig(c)
	if err != nil {
		h.logger.WithError(err).Error("Failed to get client for configmap YAML")
		h.tracingHelper.RecordError(clientSpan, err, "Failed to get client for configmap YAML")
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	h.tracingHelper.RecordSuccess(clientSpan, "Client setup completed for configmap YAML")

	namespace := c.Param("namespace")
	name := c.Param("name")

	// Start child span for Kubernetes API call
	_, k8sSpan := h.tracingHelper.StartKubernetesAPISpan(ctx, "get", "configmap", namespace)
	defer k8sSpan.End()

	configMap, err := client.CoreV1().ConfigMaps(namespace).Get(ctx, name, metav1.GetOptions{})
	if err != nil {
		h.logger.WithError(err).WithField("configmap", name).WithField("namespace", namespace).Error("Failed to get configmap for YAML")
		h.tracingHelper.RecordError(k8sSpan, err, "Failed to get configmap for YAML")
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}
	h.tracingHelper.AddResourceAttributes(k8sSpan, name, "configmap", 1)
	h.tracingHelper.RecordSuccess(k8sSpan, "Successfully retrieved configmap for YAML")

	// Start child span for YAML generation
	_, yamlSpan := h.tracingHelper.StartDataProcessingSpan(ctx, "generate-yaml")
	defer yamlSpan.End()

	h.yamlHandler.SendYAMLResponse(c, configMap, name)
	h.tracingHelper.RecordSuccess(yamlSpan, "Successfully generated YAML for configmap")
}

// GetConfigMapEventsByName returns events for a specific configmap by name using namespace from query parameters
func (h *ConfigMapsHandler) GetConfigMapEventsByName(c *gin.Context) {
	name := c.Param("name")
	namespace := c.Query("namespace")

	if namespace == "" {
		h.logger.WithField("configmap", name).Error("Namespace is required for configmap events lookup")
		c.JSON(http.StatusBadRequest, gin.H{"error": "namespace parameter is required"})
		return
	}

	// Start child span for client setup
	ctx, clientSpan := h.tracingHelper.StartAuthSpan(c.Request.Context(), "setup-client")
	defer clientSpan.End()

	client, err := h.getClientAndConfig(c)
	if err != nil {
		h.logger.WithError(err).Error("Failed to get client for configmap events")
		h.tracingHelper.RecordError(clientSpan, err, "Failed to get client for configmap events")
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	h.tracingHelper.RecordSuccess(clientSpan, "Client setup completed for configmap events")

	// Start child span for events retrieval
	_, eventsSpan := h.tracingHelper.StartKubernetesAPISpan(ctx, "list", "events", namespace)
	defer eventsSpan.End()

	h.eventsHandler.GetResourceEventsWithNamespace(c, client, "ConfigMap", name, namespace, h.sseHandler.SendSSEResponse)
	h.tracingHelper.RecordSuccess(eventsSpan, "Successfully retrieved events for configmap")
}

// GetConfigMapEvents returns events for a specific configmap
func (h *ConfigMapsHandler) GetConfigMapEvents(c *gin.Context) {
	name := c.Param("name")
	namespace := c.Param("namespace")

	// Start child span for client setup
	ctx, clientSpan := h.tracingHelper.StartAuthSpan(c.Request.Context(), "setup-client")
	defer clientSpan.End()

	client, err := h.getClientAndConfig(c)
	if err != nil {
		h.logger.WithError(err).Error("Failed to get client for configmap events")
		h.tracingHelper.RecordError(clientSpan, err, "Failed to get client for configmap events")
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	h.tracingHelper.RecordSuccess(clientSpan, "Client setup completed for configmap events")

	// Start child span for events retrieval
	_, eventsSpan := h.tracingHelper.StartKubernetesAPISpan(ctx, "list", "events", namespace)
	defer eventsSpan.End()

	h.eventsHandler.GetResourceEventsWithNamespace(c, client, "ConfigMap", name, namespace, h.sseHandler.SendSSEResponse)
	h.tracingHelper.RecordSuccess(eventsSpan, "Successfully retrieved events for configmap")
}
