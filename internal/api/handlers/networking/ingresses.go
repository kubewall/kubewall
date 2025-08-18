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

// IngressesHandler handles Ingress-related operations
type IngressesHandler struct {
	store         *storage.KubeConfigStore
	clientFactory *k8s.ClientFactory
	logger        *logger.Logger
	eventsHandler *utils.EventsHandler
	yamlHandler   *utils.YAMLHandler
	sseHandler    *utils.SSEHandler
	tracingHelper *tracing.TracingHelper
}

// NewIngressesHandler creates a new Ingresses handler
func NewIngressesHandler(store *storage.KubeConfigStore, clientFactory *k8s.ClientFactory, log *logger.Logger) *IngressesHandler {
	return &IngressesHandler{
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
func (h *IngressesHandler) getClientAndConfig(c *gin.Context) (*kubernetes.Clientset, error) {
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

// GetIngressesSSE returns ingresses as Server-Sent Events with real-time updates
func (h *IngressesHandler) GetIngressesSSE(c *gin.Context) {
	// Client setup span
	ctx, clientSpan := h.tracingHelper.StartAuthSpan(c.Request.Context(), "get-client-config")
	defer clientSpan.End()

	client, err := h.getClientAndConfig(c)
	if err != nil {
		h.tracingHelper.RecordError(clientSpan, err, "Failed to get client for ingresses SSE")
		h.logger.WithError(err).Error("Failed to get client for ingresses SSE")
		h.sseHandler.SendSSEError(c, http.StatusBadRequest, err.Error())
		return
	}
	h.tracingHelper.RecordSuccess(clientSpan, "Client setup completed")

	namespace := c.Query("namespace")
	h.tracingHelper.AddResourceAttributes(clientSpan, namespace, "ingresses", 0)

	// Function to fetch ingresses data
	fetchIngresses := func() (interface{}, error) {
		// Kubernetes API span
		_, apiSpan := h.tracingHelper.StartKubernetesAPISpan(ctx, "list", "ingresses", namespace)
		defer apiSpan.End()

		ingressList, err := client.NetworkingV1().Ingresses(namespace).List(c.Request.Context(), metav1.ListOptions{})
		if err != nil {
			h.tracingHelper.RecordError(apiSpan, err, "Failed to list ingresses")
			return nil, err
		}
		h.tracingHelper.RecordSuccess(apiSpan, fmt.Sprintf("Listed %d ingresses", len(ingressList.Items)))

		// Data processing span
		_, processingSpan := h.tracingHelper.StartDataProcessingSpan(ctx, "transform-ingresses")
		defer processingSpan.End()

		// Transform ingresses to frontend-expected format
		responses := make([]types.IngressListResponse, len(ingressList.Items))
		for i, ingress := range ingressList.Items {
			responses[i] = transformers.TransformIngressToResponse(&ingress)
		}
		h.tracingHelper.RecordSuccess(processingSpan, fmt.Sprintf("Transformed %d ingresses", len(responses)))
		h.tracingHelper.AddResourceAttributes(processingSpan, "", "ingresses", len(responses))

		return responses, nil
	}

	// Get initial data
	initialData, err := fetchIngresses()
	if err != nil {
		h.logger.WithError(err).Error("Failed to list ingresses for SSE")
		// Check if this is a permission error
		if utils.IsPermissionError(err) {
			h.sseHandler.SendSSEPermissionError(c, err)
		} else {
			h.sseHandler.SendSSEError(c, http.StatusInternalServerError, err.Error())
		}
		return
	}

	// Send SSE response with periodic updates
	h.sseHandler.SendSSEResponseWithUpdates(c, initialData, fetchIngresses)
}

// GetIngress returns a specific ingress
func (h *IngressesHandler) GetIngress(c *gin.Context) {
	// Client setup span
	ctx, clientSpan := h.tracingHelper.StartAuthSpan(c.Request.Context(), "get-client-config")
	defer clientSpan.End()

	namespace := c.Param("namespace")
	name := c.Param("name")

	client, err := h.getClientAndConfig(c)
	if err != nil {
		h.tracingHelper.RecordError(clientSpan, err, "Failed to get client for ingress")
		h.logger.WithError(err).Error("Failed to get client for ingress")
		// For EventSource, send error as SSE
		if c.GetHeader("Accept") == "text/event-stream" {
			h.sseHandler.SendSSEError(c, http.StatusBadRequest, err.Error())
		} else {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		}
		return
	}
	h.tracingHelper.RecordSuccess(clientSpan, "Client setup completed")
	h.tracingHelper.AddResourceAttributes(clientSpan, name, "ingress", 1)

	// Kubernetes API span
	_, apiSpan := h.tracingHelper.StartKubernetesAPISpan(ctx, "get", "ingress", namespace)
	defer apiSpan.End()

	ingress, err := client.NetworkingV1().Ingresses(namespace).Get(c.Request.Context(), name, metav1.GetOptions{})
	if err != nil {
		h.tracingHelper.RecordError(apiSpan, err, "Failed to get ingress")
		h.logger.WithError(err).WithField("ingress", name).WithField("namespace", namespace).Error("Failed to get ingress")
		// For EventSource, send error as SSE
		if c.GetHeader("Accept") == "text/event-stream" {
			h.sseHandler.SendSSEError(c, http.StatusNotFound, err.Error())
		} else {
			c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		}
		return
	}
	h.tracingHelper.RecordSuccess(apiSpan, fmt.Sprintf("Retrieved ingress %s", name))

	// Check if this is an SSE request (EventSource expects SSE format)
	acceptHeader := c.GetHeader("Accept")
	if acceptHeader == "text/event-stream" {
		h.sseHandler.SendSSEResponse(c, ingress)
	} else {
		c.JSON(http.StatusOK, ingress)
	}


}

// GetIngressByName returns a specific ingress by name
func (h *IngressesHandler) GetIngressByName(c *gin.Context) {
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
		h.tracingHelper.RecordError(clientSpan, err, "Failed to get client for ingress by name")
		h.logger.WithError(err).Error("Failed to get client for ingress by name")
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	h.tracingHelper.RecordSuccess(clientSpan, "Client setup completed")
	h.tracingHelper.AddResourceAttributes(clientSpan, name, "ingress", 1)

	// Kubernetes API span
	_, apiSpan := h.tracingHelper.StartKubernetesAPISpan(ctx, "get", "ingress", namespace)
	defer apiSpan.End()

	ingress, err := client.NetworkingV1().Ingresses(namespace).Get(c.Request.Context(), name, metav1.GetOptions{})
	if err != nil {
		h.tracingHelper.RecordError(apiSpan, err, "Failed to get ingress by name")
		h.logger.WithError(err).WithField("ingress", name).WithField("namespace", namespace).Error("Failed to get ingress by name")
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}
	h.tracingHelper.RecordSuccess(apiSpan, fmt.Sprintf("Retrieved ingress %s", name))

	c.JSON(http.StatusOK, ingress)
}

// GetIngressYAMLByName returns the YAML representation of a specific ingress by name
func (h *IngressesHandler) GetIngressYAMLByName(c *gin.Context) {
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
		h.tracingHelper.RecordError(clientSpan, err, "Failed to get client for ingress YAML by name")
		h.logger.WithError(err).Error("Failed to get client for ingress YAML by name")
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	h.tracingHelper.RecordSuccess(clientSpan, "Client setup completed")
	h.tracingHelper.AddResourceAttributes(clientSpan, name, "ingress", 1)

	// Kubernetes API span
	_, apiSpan := h.tracingHelper.StartKubernetesAPISpan(ctx, "get", "ingress", namespace)
	defer apiSpan.End()

	ingress, err := client.NetworkingV1().Ingresses(namespace).Get(c.Request.Context(), name, metav1.GetOptions{})
	if err != nil {
		h.tracingHelper.RecordError(apiSpan, err, "Failed to get ingress for YAML by name")
		h.logger.WithError(err).WithField("ingress", name).WithField("namespace", namespace).Error("Failed to get ingress for YAML by name")
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}
	h.tracingHelper.RecordSuccess(apiSpan, fmt.Sprintf("Retrieved ingress %s for YAML", name))

	// YAML processing span
	_, yamlSpan := h.tracingHelper.StartDataProcessingSpan(ctx, "generate-yaml")
	defer yamlSpan.End()

	h.yamlHandler.SendYAMLResponse(c, ingress, name)
	h.tracingHelper.RecordSuccess(yamlSpan, "YAML generated successfully")
}

// GetIngressYAML returns the YAML representation of a specific ingress
func (h *IngressesHandler) GetIngressYAML(c *gin.Context) {
	namespace := c.Param("namespace")
	name := c.Param("name")

	// Client setup span
	ctx, clientSpan := h.tracingHelper.StartAuthSpan(c.Request.Context(), "get-client-config")
	defer clientSpan.End()

	client, err := h.getClientAndConfig(c)
	if err != nil {
		h.tracingHelper.RecordError(clientSpan, err, "Failed to get client for ingress YAML")
		h.logger.WithError(err).Error("Failed to get client for ingress YAML")
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	h.tracingHelper.RecordSuccess(clientSpan, "Client setup completed")
	h.tracingHelper.AddResourceAttributes(clientSpan, name, "ingress", 1)

	// Kubernetes API span
	_, apiSpan := h.tracingHelper.StartKubernetesAPISpan(ctx, "get", "ingress", namespace)
	defer apiSpan.End()

	ingress, err := client.NetworkingV1().Ingresses(namespace).Get(c.Request.Context(), name, metav1.GetOptions{})
	if err != nil {
		h.tracingHelper.RecordError(apiSpan, err, "Failed to get ingress for YAML")
		h.logger.WithError(err).WithField("ingress", name).WithField("namespace", namespace).Error("Failed to get ingress for YAML")
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}
	h.tracingHelper.RecordSuccess(apiSpan, fmt.Sprintf("Retrieved ingress %s for YAML", name))

	// YAML processing span
	_, yamlSpan := h.tracingHelper.StartDataProcessingSpan(ctx, "generate-yaml")
	defer yamlSpan.End()

	h.yamlHandler.SendYAMLResponse(c, ingress, name)
	h.tracingHelper.RecordSuccess(yamlSpan, "YAML generated successfully")
}

// GetIngressEventsByName returns events for a specific ingress by name
func (h *IngressesHandler) GetIngressEventsByName(c *gin.Context) {
	name := c.Param("name")
	namespace := c.Query("namespace")

	if namespace == "" {
		h.logger.WithField("ingress", name).Error("Namespace is required for ingress events lookup")
		c.JSON(http.StatusBadRequest, gin.H{"error": "namespace parameter is required"})
		return
	}

	// Client setup span
	ctx, clientSpan := h.tracingHelper.StartAuthSpan(c.Request.Context(), "get-client-config")
	defer clientSpan.End()

	client, err := h.getClientAndConfig(c)
	if err != nil {
		h.tracingHelper.RecordError(clientSpan, err, "Failed to get client for ingress events")
		h.logger.WithError(err).Error("Failed to get client for ingress events")
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	h.tracingHelper.RecordSuccess(clientSpan, "Client setup completed")
	h.tracingHelper.AddResourceAttributes(clientSpan, name, "ingress", 1)

	// Events processing span
	_, eventsSpan := h.tracingHelper.StartDataProcessingSpan(ctx, "get-ingress-events")
	defer eventsSpan.End()

	h.eventsHandler.GetResourceEventsWithNamespace(c, client, "Ingress", name, namespace, h.sseHandler.SendSSEResponse)
	h.tracingHelper.RecordSuccess(eventsSpan, fmt.Sprintf("Retrieved events for ingress %s", name))
}

// GetIngressEvents returns events for a specific ingress
func (h *IngressesHandler) GetIngressEvents(c *gin.Context) {
	name := c.Param("name")

	// Client setup span
	ctx, clientSpan := h.tracingHelper.StartAuthSpan(c.Request.Context(), "get-client-config")
	defer clientSpan.End()

	client, err := h.getClientAndConfig(c)
	if err != nil {
		h.tracingHelper.RecordError(clientSpan, err, "Failed to get client for ingress events")
		h.logger.WithError(err).Error("Failed to get client for ingress events")
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	h.tracingHelper.RecordSuccess(clientSpan, "Client setup completed")
	h.tracingHelper.AddResourceAttributes(clientSpan, name, "ingress", 1)

	// Events processing span
	_, eventsSpan := h.tracingHelper.StartDataProcessingSpan(ctx, "get-ingress-events")
	defer eventsSpan.End()

	h.eventsHandler.GetResourceEvents(c, client, "Ingress", name, h.sseHandler.SendSSEResponse)
	h.tracingHelper.RecordSuccess(eventsSpan, fmt.Sprintf("Retrieved events for ingress %s", name))
}
