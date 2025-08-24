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

// ServicesHandler handles Service-related operations
type ServicesHandler struct {
	store         *storage.KubeConfigStore
	clientFactory *k8s.ClientFactory
	logger        *logger.Logger
	eventsHandler *utils.EventsHandler
	yamlHandler   *utils.YAMLHandler
	sseHandler    *utils.SSEHandler
	tracingHelper *tracing.TracingHelper
}

// NewServicesHandler creates a new Services handler
func NewServicesHandler(store *storage.KubeConfigStore, clientFactory *k8s.ClientFactory, log *logger.Logger) *ServicesHandler {
	return &ServicesHandler{
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
func (h *ServicesHandler) getClientAndConfig(c *gin.Context) (*kubernetes.Clientset, error) {
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

// GetServicesSSE returns services as Server-Sent Events with real-time updates
// @Summary Get Services (SSE)
// @Description Get all services with real-time updates via Server-Sent Events
// @Tags Networking
// @Accept json
// @Produce text/event-stream
// @Param config query string true "Kubernetes configuration ID"
// @Param cluster query string false "Cluster name"
// @Param namespace query string false "Namespace filter"
// @Success 200 {array} types.ServiceListResponse "Stream of service data"
// @Failure 400 {object} map[string]string "Bad request"
// @Failure 500 {object} map[string]string "Internal server error"
// @Security KubeConfig
// @Router /api/v1/services [get]
func (h *ServicesHandler) GetServicesSSE(c *gin.Context) {
	// Client setup span
	ctx, clientSpan := h.tracingHelper.StartAuthSpan(c.Request.Context(), "get-client-config")
	defer clientSpan.End()

	client, err := h.getClientAndConfig(c)
	if err != nil {
		h.tracingHelper.RecordError(clientSpan, err, "Failed to get client for services SSE")
		h.logger.WithError(err).Error("Failed to get client for services SSE")
		h.sseHandler.SendSSEError(c, http.StatusBadRequest, err.Error())
		return
	}
	h.tracingHelper.RecordSuccess(clientSpan, "Client setup completed")

	namespace := c.Query("namespace")
	h.tracingHelper.AddResourceAttributes(clientSpan, namespace, "services", 0)

	// Function to fetch services data
	fetchServices := func() (interface{}, error) {
		// Kubernetes API span
		_, apiSpan := h.tracingHelper.StartKubernetesAPISpan(ctx, "list", "services", namespace)
		defer apiSpan.End()

		serviceList, err := client.CoreV1().Services(namespace).List(c.Request.Context(), metav1.ListOptions{})
		if err != nil {
			h.tracingHelper.RecordError(apiSpan, err, "Failed to list services")
			return nil, err
		}
		h.tracingHelper.RecordSuccess(apiSpan, fmt.Sprintf("Listed %d services", len(serviceList.Items)))

		// Data processing span
		_, processingSpan := h.tracingHelper.StartDataProcessingSpan(ctx, "transform-services")
		defer processingSpan.End()

		// Transform services to frontend-expected format
		responses := make([]types.ServiceListResponse, len(serviceList.Items))
		for i, service := range serviceList.Items {
			responses[i] = transformers.TransformServiceToResponse(&service)
		}
		h.tracingHelper.RecordSuccess(processingSpan, fmt.Sprintf("Transformed %d services", len(responses)))
		h.tracingHelper.AddResourceAttributes(processingSpan, "", "services", len(responses))

		return responses, nil
	}

	// Get initial data
	initialData, err := fetchServices()
	if err != nil {
		h.logger.WithError(err).Error("Failed to list services for SSE")

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
		h.sseHandler.SendSSEResponseWithUpdates(c, initialData, fetchServices)
	} else {
		// For non-SSE requests, return JSON
		c.JSON(http.StatusOK, initialData)
	}
}

// GetService returns a specific service
func (h *ServicesHandler) GetService(c *gin.Context) {
	ctx, span := h.tracingHelper.StartAuthSpan(c.Request.Context(), "get-service")
	defer span.End()

	namespace := c.Param("namespace")
	name := c.Param("name")

	// Add resource attributes
	h.tracingHelper.AddResourceAttributes(span, name, "service", 1)

	// Client setup span
	ctx, clientSpan := h.tracingHelper.StartAuthSpan(ctx, "get-client-config")
	defer clientSpan.End()
	client, err := h.getClientAndConfig(c)
	if err != nil {
		h.tracingHelper.RecordError(clientSpan, err, "Failed to get client for service")
		h.logger.WithError(err).Error("Failed to get client for service")
		// For EventSource, send error as SSE
		if c.GetHeader("Accept") == "text/event-stream" {
			h.sseHandler.SendSSEError(c, http.StatusBadRequest, err.Error())
		} else {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		}
		return
	}
	h.tracingHelper.RecordSuccess(clientSpan, "Client setup completed")
	clientSpan.End()

	// Kubernetes API span
	ctx, apiSpan := h.tracingHelper.StartKubernetesAPISpan(ctx, "get", "service", namespace)
	defer apiSpan.End()
	service, err := client.CoreV1().Services(namespace).Get(ctx, name, metav1.GetOptions{})
	if err != nil {
		h.tracingHelper.RecordError(apiSpan, err, "Failed to get service")
		h.logger.WithError(err).WithField("service", name).WithField("namespace", namespace).Error("Failed to get service")
		// For EventSource, send error as SSE
		if c.GetHeader("Accept") == "text/event-stream" {
			h.sseHandler.SendSSEError(c, http.StatusNotFound, err.Error())
		} else {
			c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		}
		return
	}
	h.tracingHelper.RecordSuccess(apiSpan, fmt.Sprintf("Retrieved service %s", name))
	apiSpan.End()

	// Always send SSE format for detail endpoints since they're used by EventSource
	h.sseHandler.SendSSEResponse(c, service)
	h.tracingHelper.RecordSuccess(span, "Service request completed")
}

// GetServiceByName returns a specific service by name
func (h *ServicesHandler) GetServiceByName(c *gin.Context) {
	ctx, span := h.tracingHelper.StartAuthSpan(c.Request.Context(), "get-service-by-name")
	defer span.End()

	name := c.Param("name")
	namespace := c.Query("namespace")

	// Add resource attributes
	h.tracingHelper.AddResourceAttributes(span, name, "service", 1)

	if namespace == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "namespace parameter is required"})
		return
	}

	// Client setup span
	ctx, clientSpan := h.tracingHelper.StartAuthSpan(ctx, "get-client-config")
	defer clientSpan.End()
	client, err := h.getClientAndConfig(c)
	if err != nil {
		h.tracingHelper.RecordError(clientSpan, err, "Failed to get client for service by name")
		h.logger.WithError(err).Error("Failed to get client for service by name")
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	h.tracingHelper.RecordSuccess(clientSpan, "Client setup completed")
	clientSpan.End()

	// Kubernetes API span
	ctx, apiSpan := h.tracingHelper.StartKubernetesAPISpan(ctx, "get", "service", namespace)
	defer apiSpan.End()
	service, err := client.CoreV1().Services(namespace).Get(ctx, name, metav1.GetOptions{})
	if err != nil {
		h.tracingHelper.RecordError(apiSpan, err, "Failed to get service by name")
		h.logger.WithError(err).WithField("service", name).WithField("namespace", namespace).Error("Failed to get service by name")
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}
	h.tracingHelper.RecordSuccess(apiSpan, fmt.Sprintf("Retrieved service %s", name))
	apiSpan.End()

	// Always send SSE format for detail endpoints since they're used by EventSource
	h.sseHandler.SendSSEResponse(c, service)
	h.tracingHelper.RecordSuccess(span, "Service by name request completed")
}

// GetServiceYAMLByName returns the YAML representation of a specific service by name
func (h *ServicesHandler) GetServiceYAMLByName(c *gin.Context) {
	ctx, span := h.tracingHelper.StartAuthSpan(c.Request.Context(), "get-service-yaml-by-name")
	defer span.End()

	name := c.Param("name")
	namespace := c.Query("namespace")

	// Add resource attributes
	h.tracingHelper.AddResourceAttributes(span, name, "service", 1)

	if namespace == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "namespace parameter is required"})
		return
	}

	// Client setup span
	ctx, clientSpan := h.tracingHelper.StartAuthSpan(ctx, "get-client-config")
	defer clientSpan.End()
	client, err := h.getClientAndConfig(c)
	if err != nil {
		h.tracingHelper.RecordError(clientSpan, err, "Failed to get client for service YAML by name")
		h.logger.WithError(err).Error("Failed to get client for service YAML by name")
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	h.tracingHelper.RecordSuccess(clientSpan, "Client setup completed")
	clientSpan.End()

	// Kubernetes API span
	ctx, apiSpan := h.tracingHelper.StartKubernetesAPISpan(ctx, "get", "service", namespace)
	defer apiSpan.End()
	service, err := client.CoreV1().Services(namespace).Get(ctx, name, metav1.GetOptions{})
	if err != nil {
		h.tracingHelper.RecordError(apiSpan, err, "Failed to get service for YAML by name")
		h.logger.WithError(err).WithField("service", name).WithField("namespace", namespace).Error("Failed to get service for YAML by name")
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}
	h.tracingHelper.RecordSuccess(apiSpan, fmt.Sprintf("Retrieved service %s for YAML", name))

	// YAML processing span
	ctx, yamlSpan := h.tracingHelper.StartDataProcessingSpan(ctx, "generate-yaml")
	defer yamlSpan.End()
	h.yamlHandler.SendYAMLResponse(c, service, name)
	h.tracingHelper.RecordSuccess(yamlSpan, "YAML generated successfully")

	h.tracingHelper.RecordSuccess(span, "Service YAML by name request completed")
}

// GetServiceYAML returns the YAML representation of a specific service
func (h *ServicesHandler) GetServiceYAML(c *gin.Context) {
	ctx, span := h.tracingHelper.StartAuthSpan(c.Request.Context(), "get-service-yaml")
	defer span.End()

	namespace := c.Param("namespace")
	name := c.Param("name")

	// Add resource attributes
	h.tracingHelper.AddResourceAttributes(span, name, "service", 1)

	// Client setup span
	ctx, clientSpan := h.tracingHelper.StartAuthSpan(ctx, "get-client-config")
	defer clientSpan.End()
	client, err := h.getClientAndConfig(c)
	if err != nil {
		h.tracingHelper.RecordError(clientSpan, err, "Failed to get client for service YAML")
		h.logger.WithError(err).Error("Failed to get client for service YAML")
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	h.tracingHelper.RecordSuccess(clientSpan, "Client setup completed")
	clientSpan.End()

	// Kubernetes API span
	ctx, apiSpan := h.tracingHelper.StartKubernetesAPISpan(ctx, "get", "service", namespace)
	defer apiSpan.End()
	service, err := client.CoreV1().Services(namespace).Get(ctx, name, metav1.GetOptions{})
	if err != nil {
		h.tracingHelper.RecordError(apiSpan, err, "Failed to get service for YAML")
		h.logger.WithError(err).WithField("service", name).WithField("namespace", namespace).Error("Failed to get service for YAML")
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}
	h.tracingHelper.RecordSuccess(apiSpan, fmt.Sprintf("Retrieved service %s for YAML", name))

	// YAML processing span
	ctx, yamlSpan := h.tracingHelper.StartDataProcessingSpan(ctx, "generate-yaml")
	defer yamlSpan.End()
	h.yamlHandler.SendYAMLResponse(c, service, name)
	h.tracingHelper.RecordSuccess(yamlSpan, "YAML generated successfully")

	h.tracingHelper.RecordSuccess(span, "Service YAML request completed")
}

// GetServiceEventsByName returns events for a specific service by name
func (h *ServicesHandler) GetServiceEventsByName(c *gin.Context) {
	ctx, span := h.tracingHelper.StartAuthSpan(c.Request.Context(), "get-service-events-by-name")
	defer span.End()

	name := c.Param("name")
	namespace := c.Query("namespace")

	// Add resource attributes
	h.tracingHelper.AddResourceAttributes(span, name, "service", 1)

	if namespace == "" {
		h.logger.WithField("service", name).Error("Namespace is required for service events lookup")
		c.JSON(http.StatusBadRequest, gin.H{"error": "namespace parameter is required"})
		return
	}

	// Client setup span
	ctx, clientSpan := h.tracingHelper.StartAuthSpan(ctx, "get-client-config")
	defer clientSpan.End()
	client, err := h.getClientAndConfig(c)
	if err != nil {
		h.tracingHelper.RecordError(clientSpan, err, "Failed to get client for service events")
		h.logger.WithError(err).Error("Failed to get client for service events")
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	h.tracingHelper.RecordSuccess(clientSpan, "Client setup completed")
	clientSpan.End()

	// Events processing span
	ctx, eventsSpan := h.tracingHelper.StartDataProcessingSpan(ctx, "get-service-events")
	defer eventsSpan.End()
	h.eventsHandler.GetResourceEventsWithNamespace(c, client, "Service", name, namespace, h.sseHandler.SendSSEResponse)
	h.tracingHelper.RecordSuccess(eventsSpan, fmt.Sprintf("Retrieved events for service %s", name))

	h.tracingHelper.RecordSuccess(span, "Service events by name request completed")
}

// GetServiceEvents returns events for a specific service
func (h *ServicesHandler) GetServiceEvents(c *gin.Context) {
	ctx, span := h.tracingHelper.StartAuthSpan(c.Request.Context(), "get-service-events")
	defer span.End()

	name := c.Param("name")

	// Add resource attributes
	h.tracingHelper.AddResourceAttributes(span, name, "service", 1)

	// Client setup span
	ctx, clientSpan := h.tracingHelper.StartAuthSpan(ctx, "get-client-config")
	defer clientSpan.End()
	client, err := h.getClientAndConfig(c)
	if err != nil {
		h.tracingHelper.RecordError(clientSpan, err, "Failed to get client for service events")
		h.logger.WithError(err).Error("Failed to get client for service events")
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	h.tracingHelper.RecordSuccess(clientSpan, "Client setup completed")
	clientSpan.End()

	// Events processing span
	ctx, eventsSpan := h.tracingHelper.StartDataProcessingSpan(ctx, "get-service-events")
	defer eventsSpan.End()
	h.eventsHandler.GetResourceEvents(c, client, "Service", name, h.sseHandler.SendSSEResponse)
	h.tracingHelper.RecordSuccess(eventsSpan, fmt.Sprintf("Retrieved events for service %s", name))

	h.tracingHelper.RecordSuccess(span, "Service events request completed")
}
