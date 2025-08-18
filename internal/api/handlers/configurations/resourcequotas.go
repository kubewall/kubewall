package configurations

import (
	"context"
	"encoding/base64"
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

// ResourceQuotasHandler handles ResourceQuota-related API requests
type ResourceQuotasHandler struct {
	store         *storage.KubeConfigStore
	clientFactory *k8s.ClientFactory
	logger        *logger.Logger
	sseHandler    *utils.SSEHandler
	yamlHandler   *utils.YAMLHandler
	eventsHandler *utils.EventsHandler
	tracingHelper *tracing.TracingHelper
}

// NewResourceQuotasHandler creates a new ResourceQuotasHandler
func NewResourceQuotasHandler(store *storage.KubeConfigStore, clientFactory *k8s.ClientFactory, log *logger.Logger) *ResourceQuotasHandler {
	return &ResourceQuotasHandler{
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
func (h *ResourceQuotasHandler) getClientAndConfig(c *gin.Context) (*kubernetes.Clientset, error) {
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

// GetResourceQuotas returns all resource quotas in a namespace
func (h *ResourceQuotasHandler) GetResourceQuotas(c *gin.Context) {
	// Start child span for client setup
	ctx, clientSpan := h.tracingHelper.StartAuthSpan(c.Request.Context(), "get-client-config")
	defer clientSpan.End()

	client, err := h.getClientAndConfig(c)
	if err != nil {
		h.logger.WithError(err).Error("Failed to get client for resource quotas")
		h.tracingHelper.RecordError(clientSpan, err, "Failed to get Kubernetes client")
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	h.tracingHelper.RecordSuccess(clientSpan, "Client setup completed")

	namespace := c.Query("namespace")

	// Start child span for Kubernetes API call
	_, k8sSpan := h.tracingHelper.StartKubernetesAPISpan(ctx, "list", "resourcequotas", namespace)
	defer k8sSpan.End()

	resourceQuotaList, err := client.CoreV1().ResourceQuotas(namespace).List(ctx, metav1.ListOptions{})
	if err != nil {
		h.logger.WithError(err).Error("Failed to list resource quotas")
		h.tracingHelper.RecordError(k8sSpan, err, "Failed to list resource quotas")
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	h.tracingHelper.RecordSuccess(k8sSpan, "Successfully listed resource quotas")
	h.tracingHelper.AddResourceAttributes(k8sSpan, "resourcequotas", "resourcequota", len(resourceQuotaList.Items))

	// Start child span for data processing
	_, processSpan := h.tracingHelper.StartDataProcessingSpan(ctx, "transform-resourcequotas")
	defer processSpan.End()

	// Transform resource quotas to the expected format
	var transformedResourceQuotas []types.ResourceQuotaListResponse
	for _, resourceQuota := range resourceQuotaList.Items {
		transformedResourceQuotas = append(transformedResourceQuotas, transformers.TransformResourceQuotaToResponse(&resourceQuota))
	}
	h.tracingHelper.RecordSuccess(processSpan, "Successfully transformed resource quotas")
	h.tracingHelper.AddResourceAttributes(processSpan, "transformed-resourcequotas", "resourcequota", len(transformedResourceQuotas))

	c.JSON(http.StatusOK, transformedResourceQuotas)
}

// GetResourceQuotasSSE returns resource quotas as Server-Sent Events with real-time updates
func (h *ResourceQuotasHandler) GetResourceQuotasSSE(c *gin.Context) {
	// Start child span for client setup
	ctx, clientSpan := h.tracingHelper.StartAuthSpan(c.Request.Context(), "setup-client-for-sse")
	defer clientSpan.End()

	client, err := h.getClientAndConfig(c)
	if err != nil {
		h.logger.WithError(err).Error("Failed to get client for resource quotas SSE")
		h.tracingHelper.RecordError(clientSpan, err, "Failed to get client for resource quotas SSE")
		h.sseHandler.SendSSEError(c, http.StatusBadRequest, err.Error())
		return
	}
	h.tracingHelper.RecordSuccess(clientSpan, "Client setup completed for resource quotas SSE")

	namespace := c.Query("namespace")

	// Function to fetch and transform resource quotas data
	fetchResourceQuotas := func() (interface{}, error) {
		// Start child span for data fetching
		_, fetchSpan := h.tracingHelper.StartKubernetesAPISpan(ctx, "list", "resourcequotas", namespace)
		defer fetchSpan.End()

		// Use context.Background() with timeout instead of request context to avoid cancellation
		fetchCtx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
		defer cancel()

		resourceQuotaList, err := client.CoreV1().ResourceQuotas(namespace).List(fetchCtx, metav1.ListOptions{})
		if err != nil {
			h.tracingHelper.RecordError(fetchSpan, err, "Failed to fetch resource quotas for SSE")
			return nil, err
		}
		h.tracingHelper.RecordSuccess(fetchSpan, "Successfully fetched resource quotas for SSE")
		h.tracingHelper.AddResourceAttributes(fetchSpan, "resourcequotas", "resourcequota", len(resourceQuotaList.Items))

		// Start child span for data transformation
		_, transformSpan := h.tracingHelper.StartDataProcessingSpan(ctx, "transform-resourcequotas-sse")
		defer transformSpan.End()

		// Transform resource quotas to the expected format
		var transformedResourceQuotas []types.ResourceQuotaListResponse
		for _, resourceQuota := range resourceQuotaList.Items {
			transformedResourceQuotas = append(transformedResourceQuotas, transformers.TransformResourceQuotaToResponse(&resourceQuota))
		}
		h.tracingHelper.RecordSuccess(transformSpan, "Successfully transformed resource quotas for SSE")
		h.tracingHelper.AddResourceAttributes(transformSpan, "transformed-resourcequotas", "resourcequota", len(transformedResourceQuotas))

		return transformedResourceQuotas, nil
	}

	// Get initial data
	initialData, err := fetchResourceQuotas()
	if err != nil {
		h.logger.WithError(err).Error("Failed to list resource quotas for SSE")
		// Check if this is a permission error
		if utils.IsPermissionError(err) {
			h.sseHandler.SendSSEPermissionError(c, err)
		} else {
			h.sseHandler.SendSSEError(c, http.StatusInternalServerError, err.Error())
		}
		return
	}

	// Send SSE response with periodic updates
	h.sseHandler.SendSSEResponseWithUpdates(c, initialData, fetchResourceQuotas)
}

// GetResourceQuota returns a specific resource quota
func (h *ResourceQuotasHandler) GetResourceQuota(c *gin.Context) {
	// Start child span for client setup
	ctx, clientSpan := h.tracingHelper.StartAuthSpan(c.Request.Context(), "get-client-config")
	defer clientSpan.End()

	client, err := h.getClientAndConfig(c)
	if err != nil {
		h.logger.WithError(err).Error("Failed to get client for resource quota")
		h.tracingHelper.RecordError(clientSpan, err, "Failed to get Kubernetes client")
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	h.tracingHelper.RecordSuccess(clientSpan, "Client setup completed")

	namespace := c.Param("namespace")
	name := c.Param("name")

	// Start child span for Kubernetes API call
	_, k8sSpan := h.tracingHelper.StartKubernetesAPISpan(ctx, "get", "resourcequota", namespace)
	defer k8sSpan.End()

	resourceQuota, err := client.CoreV1().ResourceQuotas(namespace).Get(ctx, name, metav1.GetOptions{})
	if err != nil {
		h.logger.WithError(err).WithField("resourcequota", name).WithField("namespace", namespace).Error("Failed to get resource quota")
		h.tracingHelper.RecordError(k8sSpan, err, "Failed to get resource quota")
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}
	h.tracingHelper.RecordSuccess(k8sSpan, "Successfully retrieved resource quota")
	h.tracingHelper.AddResourceAttributes(k8sSpan, name, "resourcequota", 1)

	// Check if this is an SSE request (EventSource expects SSE format)
	acceptHeader := c.GetHeader("Accept")
	if acceptHeader == "text/event-stream" {
		h.sseHandler.SendSSEResponse(c, resourceQuota)
		return
	}

	c.JSON(http.StatusOK, resourceQuota)
}

// GetResourceQuotaByName returns a specific resource quota by name using namespace from query parameters
func (h *ResourceQuotasHandler) GetResourceQuotaByName(c *gin.Context) {
	// Start child span for client setup
	ctx, clientSpan := h.tracingHelper.StartAuthSpan(c.Request.Context(), "get-client-config")
	defer clientSpan.End()

	client, err := h.getClientAndConfig(c)
	if err != nil {
		h.logger.WithError(err).Error("Failed to get client for resource quota")
		h.tracingHelper.RecordError(clientSpan, err, "Failed to get Kubernetes client")
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	name := c.Param("name")
	namespace := c.Query("namespace")

	if namespace == "" {
		h.logger.WithField("resourcequota", name).Error("Namespace is required for resource quota lookup")
		h.tracingHelper.RecordError(clientSpan, fmt.Errorf("namespace parameter is required"), "Namespace parameter is required")
		c.JSON(http.StatusBadRequest, gin.H{"error": "namespace parameter is required"})
		return
	}
	h.tracingHelper.RecordSuccess(clientSpan, "Client setup completed")

	// Start child span for Kubernetes API call
	_, k8sSpan := h.tracingHelper.StartKubernetesAPISpan(ctx, "get", "resourcequota", namespace)
	defer k8sSpan.End()

	resourceQuota, err := client.CoreV1().ResourceQuotas(namespace).Get(ctx, name, metav1.GetOptions{})
	if err != nil {
		h.logger.WithError(err).WithField("resourcequota", name).WithField("namespace", namespace).Error("Failed to get resource quota")
		h.tracingHelper.RecordError(k8sSpan, err, "Failed to get resource quota")
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}
	h.tracingHelper.RecordSuccess(k8sSpan, "Successfully retrieved resource quota")
	h.tracingHelper.AddResourceAttributes(k8sSpan, name, "resourcequota", 1)

	// Check if this is an SSE request (EventSource expects SSE format)
	acceptHeader := c.GetHeader("Accept")
	if acceptHeader == "text/event-stream" {
		h.sseHandler.SendSSEResponse(c, resourceQuota)
		return
	}

	c.JSON(http.StatusOK, resourceQuota)
}

// GetResourceQuotaYAMLByName returns the YAML representation of a specific resource quota by name using namespace from query parameters
func (h *ResourceQuotasHandler) GetResourceQuotaYAMLByName(c *gin.Context) {
	// Start child span for client setup
	ctx, clientSpan := h.tracingHelper.StartAuthSpan(c.Request.Context(), "get-client-config")
	defer clientSpan.End()

	client, err := h.getClientAndConfig(c)
	if err != nil {
		h.logger.WithError(err).Error("Failed to get client for resource quota YAML")
		h.tracingHelper.RecordError(clientSpan, err, "Failed to get Kubernetes client")
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	name := c.Param("name")
	namespace := c.Query("namespace")

	if namespace == "" {
		h.logger.WithField("resourcequota", name).Error("Namespace is required for resource quota YAML lookup")
		h.tracingHelper.RecordError(clientSpan, fmt.Errorf("namespace parameter is required"), "Namespace parameter is required")
		c.JSON(http.StatusBadRequest, gin.H{"error": "namespace parameter is required"})
		return
	}
	h.tracingHelper.RecordSuccess(clientSpan, "Client setup completed")

	// Start child span for Kubernetes API call
	_, k8sSpan := h.tracingHelper.StartKubernetesAPISpan(ctx, "get", "resourcequota", namespace)
	defer k8sSpan.End()

	resourceQuota, err := client.CoreV1().ResourceQuotas(namespace).Get(ctx, name, metav1.GetOptions{})
	if err != nil {
		h.logger.WithError(err).WithField("resourcequota", name).WithField("namespace", namespace).Error("Failed to get resource quota for YAML")
		h.tracingHelper.RecordError(k8sSpan, err, "Failed to get resource quota for YAML")
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}
	h.tracingHelper.RecordSuccess(k8sSpan, "Successfully retrieved resource quota for YAML")
	h.tracingHelper.AddResourceAttributes(k8sSpan, name, "resourcequota", 1)

	// Start child span for YAML generation
	_, yamlSpan := h.tracingHelper.StartDataProcessingSpan(ctx, "generate-yaml")
	defer yamlSpan.End()

	// Convert to YAML using the YAML handler to ensure proper format
	yamlData, err := h.yamlHandler.EnsureCompleteYAML(resourceQuota)
	if err != nil {
		h.logger.WithError(err).Error("Failed to marshal resource quota to YAML")
		h.tracingHelper.RecordError(yamlSpan, err, "Failed to convert to YAML")
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to convert to YAML"})
		return
	}
	h.tracingHelper.RecordSuccess(yamlSpan, "Successfully generated YAML response")

	// Check if this is an SSE request (EventSource expects SSE format)
	acceptHeader := c.GetHeader("Accept")
	if acceptHeader == "text/event-stream" {
		// For EventSource, send the YAML data as base64 encoded string
		encodedYAML := base64.StdEncoding.EncodeToString(yamlData)
		h.sseHandler.SendSSEResponse(c, gin.H{"data": encodedYAML})
		return
	}

	// Return as base64 encoded string to match frontend expectations
	encodedYAML := base64.StdEncoding.EncodeToString(yamlData)
	c.JSON(http.StatusOK, gin.H{"data": encodedYAML})
}

// GetResourceQuotaYAML returns the YAML representation of a specific resource quota
func (h *ResourceQuotasHandler) GetResourceQuotaYAML(c *gin.Context) {
	// Start child span for client setup
	ctx, clientSpan := h.tracingHelper.StartAuthSpan(c.Request.Context(), "get-client-config")
	defer clientSpan.End()

	client, err := h.getClientAndConfig(c)
	if err != nil {
		h.logger.WithError(err).Error("Failed to get client for resource quota YAML")
		h.tracingHelper.RecordError(clientSpan, err, "Failed to get Kubernetes client")
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	h.tracingHelper.RecordSuccess(clientSpan, "Client setup completed")

	namespace := c.Param("namespace")
	name := c.Param("name")

	// Start child span for Kubernetes API call
	_, k8sSpan := h.tracingHelper.StartKubernetesAPISpan(ctx, "get", "resourcequota", namespace)
	defer k8sSpan.End()

	resourceQuota, err := client.CoreV1().ResourceQuotas(namespace).Get(ctx, name, metav1.GetOptions{})
	if err != nil {
		h.logger.WithError(err).WithField("resourcequota", name).WithField("namespace", namespace).Error("Failed to get resource quota for YAML")
		h.tracingHelper.RecordError(k8sSpan, err, "Failed to get resource quota for YAML")
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}
	h.tracingHelper.RecordSuccess(k8sSpan, "Successfully retrieved resource quota for YAML")
	h.tracingHelper.AddResourceAttributes(k8sSpan, name, "resourcequota", 1)

	// Start child span for YAML generation
	_, yamlSpan := h.tracingHelper.StartDataProcessingSpan(ctx, "generate-yaml")
	defer yamlSpan.End()

	h.yamlHandler.SendYAMLResponse(c, resourceQuota, name)
	h.tracingHelper.RecordSuccess(yamlSpan, "Successfully generated YAML response")
}

// GetResourceQuotaEventsByName returns events for a specific resource quota by name using namespace from query parameters
func (h *ResourceQuotasHandler) GetResourceQuotaEventsByName(c *gin.Context) {
	name := c.Param("name")
	namespace := c.Query("namespace")

	if namespace == "" {
		h.logger.WithField("resourcequota", name).Error("Namespace is required for resource quota events lookup")
		c.JSON(http.StatusBadRequest, gin.H{"error": "namespace parameter is required"})
		return
	}

	// Start child span for client setup
	ctx, clientSpan := h.tracingHelper.StartAuthSpan(c.Request.Context(), "get-client-config")
	defer clientSpan.End()

	client, err := h.getClientAndConfig(c)
	if err != nil {
		h.logger.WithError(err).Error("Failed to get client for resource quota events")
		h.tracingHelper.RecordError(clientSpan, err, "Failed to get Kubernetes client")
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	h.tracingHelper.RecordSuccess(clientSpan, "Client setup completed")

	// Start child span for events retrieval
	_, eventsSpan := h.tracingHelper.StartKubernetesAPISpan(ctx, "list", "events", namespace)
	defer eventsSpan.End()

	h.eventsHandler.GetResourceEventsWithNamespace(c, client, "ResourceQuota", name, namespace, h.sseHandler.SendSSEResponse)
	h.tracingHelper.RecordSuccess(eventsSpan, "Successfully retrieved resource quota events")
	h.tracingHelper.AddResourceAttributes(eventsSpan, name, "resourcequota-events", 1)
}

// GetResourceQuotaEvents returns events for a specific resource quota
func (h *ResourceQuotasHandler) GetResourceQuotaEvents(c *gin.Context) {
	name := c.Param("name")
	namespace := c.Param("namespace")

	// Start child span for client setup
	ctx, clientSpan := h.tracingHelper.StartAuthSpan(c.Request.Context(), "get-client-config")
	defer clientSpan.End()

	client, err := h.getClientAndConfig(c)
	if err != nil {
		h.logger.WithError(err).Error("Failed to get client for resource quota events")
		h.tracingHelper.RecordError(clientSpan, err, "Failed to get Kubernetes client")
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	h.tracingHelper.RecordSuccess(clientSpan, "Client setup completed")

	// Start child span for events retrieval
	_, eventsSpan := h.tracingHelper.StartKubernetesAPISpan(ctx, "list", "events", namespace)
	defer eventsSpan.End()

	h.eventsHandler.GetResourceEventsWithNamespace(c, client, "ResourceQuota", name, namespace, h.sseHandler.SendSSEResponse)
	h.tracingHelper.RecordSuccess(eventsSpan, "Successfully retrieved resource quota events")
	h.tracingHelper.AddResourceAttributes(eventsSpan, name, "resourcequota-events", 1)
}
