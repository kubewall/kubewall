package networking

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

// EndpointsHandler handles Endpoint-related operations
type EndpointsHandler struct {
	store         *storage.KubeConfigStore
	clientFactory *k8s.ClientFactory
	logger        *logger.Logger
	eventsHandler *utils.EventsHandler
	yamlHandler   *utils.YAMLHandler
	sseHandler    *utils.SSEHandler
	tracingHelper *tracing.TracingHelper
}

// NewEndpointsHandler creates a new Endpoints handler
func NewEndpointsHandler(store *storage.KubeConfigStore, clientFactory *k8s.ClientFactory, log *logger.Logger) *EndpointsHandler {
	return &EndpointsHandler{
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
func (h *EndpointsHandler) getClientAndConfig(c *gin.Context) (*kubernetes.Clientset, error) {
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

// GetEndpointsSSE returns endpoints as Server-Sent Events with real-time updates
func (h *EndpointsHandler) GetEndpointsSSE(c *gin.Context) {

	// Client setup span
	ctx, clientSpan := h.tracingHelper.StartAuthSpan(c.Request.Context(), "get-client-config")
	defer clientSpan.End()

	client, err := h.getClientAndConfig(c)
	if err != nil {
		h.tracingHelper.RecordError(clientSpan, err, "Failed to get client for endpoints SSE")
		h.logger.WithError(err).Error("Failed to get client for endpoints SSE")
		h.sseHandler.SendSSEError(c, http.StatusBadRequest, err.Error())
		return
	}
	h.tracingHelper.RecordSuccess(clientSpan, "Client setup completed")

	namespace := c.Query("namespace")
	h.tracingHelper.AddResourceAttributes(clientSpan, namespace, "endpoints", 0)

	// Function to fetch endpoints data
	fetchEndpoints := func() (interface{}, error) {
		// Kubernetes API span
		_, apiSpan := h.tracingHelper.StartKubernetesAPISpan(ctx, "list", "endpoints", namespace)
		defer apiSpan.End()

		endpointList, err := client.CoreV1().Endpoints(namespace).List(c.Request.Context(), metav1.ListOptions{})
		if err != nil {
			h.tracingHelper.RecordError(apiSpan, err, "Failed to list endpoints")
			return nil, err
		}
		h.tracingHelper.RecordSuccess(apiSpan, fmt.Sprintf("Listed %d endpoints", len(endpointList.Items)))

		// Data processing span
		_, processingSpan := h.tracingHelper.StartDataProcessingSpan(ctx, "transform-endpoints")
		defer processingSpan.End()

		// Transform endpoints to frontend-expected format
		responses := make([]types.EndpointListResponse, len(endpointList.Items))
		for i, endpoint := range endpointList.Items {
			responses[i] = transformers.TransformEndpointToResponse(&endpoint)
		}
		h.tracingHelper.RecordSuccess(processingSpan, fmt.Sprintf("Transformed %d endpoints", len(responses)))
		h.tracingHelper.AddResourceAttributes(processingSpan, "", "endpoints", len(responses))

		return responses, nil
	}

	// Get initial data
	initialData, err := fetchEndpoints()
	if err != nil {
		h.logger.WithError(err).Error("Failed to list endpoints for SSE")
		// Check if this is a permission error
		if utils.IsPermissionError(err) {
			h.sseHandler.SendSSEPermissionError(c, err)
		} else {
			h.sseHandler.SendSSEError(c, http.StatusInternalServerError, err.Error())
		}
		return
	}

	// Send SSE response with periodic updates
	h.sseHandler.SendSSEResponseWithUpdates(c, initialData, fetchEndpoints)
}

// GetEndpoint returns a specific endpoint
func (h *EndpointsHandler) GetEndpoint(c *gin.Context) {
	// Client setup span
	ctx, clientSpan := h.tracingHelper.StartAuthSpan(c.Request.Context(), "get-client-config")
	defer clientSpan.End()

	namespace := c.Param("namespace")
	name := c.Param("name")

	client, err := h.getClientAndConfig(c)
	if err != nil {
		h.tracingHelper.RecordError(clientSpan, err, "Failed to get client for endpoint")
		h.logger.WithError(err).Error("Failed to get client for endpoint")
		// For EventSource, send error as SSE
		if c.GetHeader("Accept") == "text/event-stream" {
			h.sseHandler.SendSSEError(c, http.StatusBadRequest, err.Error())
		} else {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		}
		return
	}
	h.tracingHelper.RecordSuccess(clientSpan, "Client setup completed")
	h.tracingHelper.AddResourceAttributes(clientSpan, name, "endpoint", 1)

	// Kubernetes API span
	_, apiSpan := h.tracingHelper.StartKubernetesAPISpan(ctx, "get", "endpoint", namespace)
	defer apiSpan.End()

	endpoint, err := client.CoreV1().Endpoints(namespace).Get(c.Request.Context(), name, metav1.GetOptions{})
	if err != nil {
		h.tracingHelper.RecordError(apiSpan, err, "Failed to get endpoint")
		h.logger.WithError(err).WithField("endpoint", name).WithField("namespace", namespace).Error("Failed to get endpoint")
		// For EventSource, send error as SSE
		if c.GetHeader("Accept") == "text/event-stream" {
			h.sseHandler.SendSSEError(c, http.StatusNotFound, err.Error())
		} else {
			c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		}
		return
	}
	h.tracingHelper.RecordSuccess(apiSpan, fmt.Sprintf("Retrieved endpoint %s", name))

	// Check if this is an SSE request (EventSource expects SSE format)
	acceptHeader := c.GetHeader("Accept")
	if acceptHeader == "text/event-stream" {
		h.sseHandler.SendSSEResponse(c, endpoint)
	} else {
		c.JSON(http.StatusOK, endpoint)
	}


}

// GetEndpointByName returns a specific endpoint by name
func (h *EndpointsHandler) GetEndpointByName(c *gin.Context) {
	name := c.Param("name")
	namespace := c.Query("namespace")

	if namespace == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "namespace parameter is required"})
		return
	}

	// Client setup span
	ctx, clientSpan := h.tracingHelper.StartAuthSpan(c.Request.Context(), "get-client-config")
	defer clientSpan.End()

	client, err := h.getClientAndConfig(c)
	if err != nil {
		h.tracingHelper.RecordError(clientSpan, err, "Failed to get client for endpoint by name")
		h.logger.WithError(err).Error("Failed to get client for endpoint by name")
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	h.tracingHelper.RecordSuccess(clientSpan, "Client setup completed")
	h.tracingHelper.AddResourceAttributes(clientSpan, name, "endpoint", 1)

	// Kubernetes API span
	_, apiSpan := h.tracingHelper.StartKubernetesAPISpan(ctx, "get", "endpoint", namespace)
	defer apiSpan.End()

	endpoint, err := client.CoreV1().Endpoints(namespace).Get(c.Request.Context(), name, metav1.GetOptions{})
	if err != nil {
		h.tracingHelper.RecordError(apiSpan, err, "Failed to get endpoint by name")
		h.logger.WithError(err).WithField("endpoint", name).WithField("namespace", namespace).Error("Failed to get endpoint by name")
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}
	h.tracingHelper.RecordSuccess(apiSpan, fmt.Sprintf("Retrieved endpoint %s", name))

	c.JSON(http.StatusOK, endpoint)
}

// GetEndpointYAMLByName returns the YAML representation of a specific endpoint by name
func (h *EndpointsHandler) GetEndpointYAMLByName(c *gin.Context) {
	name := c.Param("name")
	namespace := c.Query("namespace")

	if namespace == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "namespace parameter is required"})
		return
	}

	// Client setup span
	ctx, clientSpan := h.tracingHelper.StartAuthSpan(c.Request.Context(), "get-client-config")
	defer clientSpan.End()

	client, err := h.getClientAndConfig(c)
	if err != nil {
		h.tracingHelper.RecordError(clientSpan, err, "Failed to get client for endpoint YAML by name")
		h.logger.WithError(err).Error("Failed to get client for endpoint YAML by name")
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	h.tracingHelper.RecordSuccess(clientSpan, "Client setup completed")
	h.tracingHelper.AddResourceAttributes(clientSpan, name, "endpoint", 1)

	// Kubernetes API span
	_, apiSpan := h.tracingHelper.StartKubernetesAPISpan(ctx, "get", "endpoint", namespace)
	defer apiSpan.End()

	endpoint, err := client.CoreV1().Endpoints(namespace).Get(c.Request.Context(), name, metav1.GetOptions{})
	if err != nil {
		h.tracingHelper.RecordError(apiSpan, err, "Failed to get endpoint for YAML by name")
		h.logger.WithError(err).WithField("endpoint", name).WithField("namespace", namespace).Error("Failed to get endpoint for YAML by name")
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}
	h.tracingHelper.RecordSuccess(apiSpan, fmt.Sprintf("Retrieved endpoint %s for YAML", name))

	// YAML processing span
	_, yamlSpan := h.tracingHelper.StartDataProcessingSpan(ctx, "generate-yaml")
	defer yamlSpan.End()

	h.yamlHandler.SendYAMLResponse(c, endpoint, name)
	h.tracingHelper.RecordSuccess(yamlSpan, "YAML generated successfully")
}

// GetEndpointYAML returns the YAML representation of a specific endpoint
func (h *EndpointsHandler) GetEndpointYAML(c *gin.Context) {
	namespace := c.Param("namespace")
	name := c.Param("name")

	// Client setup span
	ctx, clientSpan := h.tracingHelper.StartAuthSpan(c.Request.Context(), "get-client-config")
	defer clientSpan.End()

	client, err := h.getClientAndConfig(c)
	if err != nil {
		h.tracingHelper.RecordError(clientSpan, err, "Failed to get client for endpoint YAML")
		h.logger.WithError(err).Error("Failed to get client for endpoint YAML")
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	h.tracingHelper.RecordSuccess(clientSpan, "Client setup completed")
	h.tracingHelper.AddResourceAttributes(clientSpan, name, "endpoint", 1)

	// Kubernetes API span
	_, apiSpan := h.tracingHelper.StartKubernetesAPISpan(ctx, "get", "endpoint", namespace)
	defer apiSpan.End()

	endpoint, err := client.CoreV1().Endpoints(namespace).Get(c.Request.Context(), name, metav1.GetOptions{})
	if err != nil {
		h.tracingHelper.RecordError(apiSpan, err, "Failed to get endpoint for YAML")
		h.logger.WithError(err).WithField("endpoint", name).WithField("namespace", namespace).Error("Failed to get endpoint for YAML")
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}
	h.tracingHelper.RecordSuccess(apiSpan, fmt.Sprintf("Retrieved endpoint %s for YAML", name))

	// YAML processing span
	_, yamlSpan := h.tracingHelper.StartDataProcessingSpan(ctx, "generate-yaml")
	defer yamlSpan.End()

	h.yamlHandler.SendYAMLResponse(c, endpoint, name)
	h.tracingHelper.RecordSuccess(yamlSpan, "YAML generated successfully")
}

// GetEndpointEventsByName returns events for a specific endpoint by name
func (h *EndpointsHandler) GetEndpointEventsByName(c *gin.Context) {
	name := c.Param("name")
	namespace := c.Query("namespace")

	if namespace == "" {
		h.logger.WithField("endpoint", name).Error("Namespace is required for endpoint events lookup")
		c.JSON(http.StatusBadRequest, gin.H{"error": "namespace parameter is required"})
		return
	}

	// Client setup span
	ctx, clientSpan := h.tracingHelper.StartAuthSpan(c.Request.Context(), "get-client-config")
	defer clientSpan.End()

	client, err := h.getClientAndConfig(c)
	if err != nil {
		h.tracingHelper.RecordError(clientSpan, err, "Failed to get client for endpoint events")
		h.logger.WithError(err).Error("Failed to get client for endpoint events")
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	h.tracingHelper.RecordSuccess(clientSpan, "Client setup completed")
	h.tracingHelper.AddResourceAttributes(clientSpan, name, "endpoint", 1)

	// Events processing span
	_, eventsSpan := h.tracingHelper.StartDataProcessingSpan(ctx, "get-endpoint-events")
	defer eventsSpan.End()

	h.eventsHandler.GetResourceEventsWithNamespace(c, client, "Endpoints", name, namespace, h.sseHandler.SendSSEResponse)
	h.tracingHelper.RecordSuccess(eventsSpan, fmt.Sprintf("Retrieved events for endpoint %s", name))
}

// GetEndpointEvents returns events for a specific endpoint
func (h *EndpointsHandler) GetEndpointEvents(c *gin.Context) {
	name := c.Param("name")

	// Client setup span
	ctx, clientSpan := h.tracingHelper.StartAuthSpan(c.Request.Context(), "get-client-config")
	defer clientSpan.End()

	client, err := h.getClientAndConfig(c)
	if err != nil {
		h.tracingHelper.RecordError(clientSpan, err, "Failed to get client for endpoint events")
		h.logger.WithError(err).Error("Failed to get client for endpoint events")
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	h.tracingHelper.RecordSuccess(clientSpan, "Client setup completed")
	h.tracingHelper.AddResourceAttributes(clientSpan, name, "endpoint", 1)

	// Events processing span
	_, eventsSpan := h.tracingHelper.StartDataProcessingSpan(ctx, "get-endpoint-events")
	defer eventsSpan.End()

	h.eventsHandler.GetResourceEvents(c, client, "Endpoints", name, h.sseHandler.SendSSEResponse)
	h.tracingHelper.RecordSuccess(eventsSpan, fmt.Sprintf("Retrieved events for endpoint %s", name))
}
