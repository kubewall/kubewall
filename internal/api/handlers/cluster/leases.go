package cluster

import (
	"fmt"
	"net/http"

	"github.com/Facets-cloud/kube-dash/internal/api/utils"
	"github.com/Facets-cloud/kube-dash/internal/k8s"
	"github.com/Facets-cloud/kube-dash/internal/storage"
	"github.com/Facets-cloud/kube-dash/internal/tracing"
	"github.com/Facets-cloud/kube-dash/pkg/logger"

	"github.com/gin-gonic/gin"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/client-go/kubernetes"
)

// LeasesHandler handles lease-related operations
type LeasesHandler struct {
	store         *storage.KubeConfigStore
	clientFactory *k8s.ClientFactory
	logger        *logger.Logger
	sseHandler    *utils.SSEHandler
	yamlHandler   *utils.YAMLHandler
	eventsHandler *utils.EventsHandler
	tracingHelper *tracing.TracingHelper
}

// NewLeasesHandler creates a new LeasesHandler instance
func NewLeasesHandler(store *storage.KubeConfigStore, clientFactory *k8s.ClientFactory, log *logger.Logger) *LeasesHandler {
	return &LeasesHandler{
		store:         store,
		clientFactory: clientFactory,
		logger:        log,
		sseHandler:    utils.NewSSEHandler(log),
		yamlHandler:   utils.NewYAMLHandler(log),
		eventsHandler: utils.NewEventsHandler(log),
		tracingHelper: tracing.GetTracingHelper(),
	}
}

// getClientAndConfig gets the Kubernetes client and config for the current request
func (h *LeasesHandler) getClientAndConfig(c *gin.Context) (*kubernetes.Clientset, error) {
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

// GetLeases returns all leases in a namespace
// @Summary Get all leases in a namespace
// @Description Retrieves all leases in the specified namespace
// @Tags Leases
// @Accept json
// @Produce json
// @Param config query string true "Kubernetes config ID"
// @Param cluster query string false "Cluster name"
// @Param namespace query string true "Namespace name"
// @Success 200 {array} object "List of leases"
// @Failure 400 {object} map[string]string "Bad request"
// @Failure 500 {object} map[string]string "Internal server error"
// @Security BearerAuth
// @Security KubeConfig
// @Router /api/v1/leases [get]
func (h *LeasesHandler) GetLeases(c *gin.Context) {
	// Start child span for client setup
	ctx, clientSpan := h.tracingHelper.StartAuthSpan(c.Request.Context(), "get-client-config")
	defer clientSpan.End()

	client, err := h.getClientAndConfig(c)
	if err != nil {
		h.logger.WithError(err).Error("Failed to get client for leases")
		h.tracingHelper.RecordError(clientSpan, err, "Failed to get Kubernetes client")
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	h.tracingHelper.RecordSuccess(clientSpan, "Successfully obtained Kubernetes client")

	namespace := c.Query("namespace")

	// Start child span for Kubernetes API call
	_, apiSpan := h.tracingHelper.StartKubernetesAPISpan(ctx, "list", "leases", namespace)
	defer apiSpan.End()

	leases, err := client.CoordinationV1().Leases(namespace).List(ctx, metav1.ListOptions{})
	if err != nil {
		h.logger.WithError(err).Error("Failed to list leases")
		h.tracingHelper.RecordError(apiSpan, err, "Failed to list leases")
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	h.tracingHelper.RecordSuccess(apiSpan, "Successfully listed leases")
	h.tracingHelper.AddResourceAttributes(apiSpan, namespace, "leases", len(leases.Items))

	c.JSON(http.StatusOK, leases)
}

// GetLeasesSSE returns leases as Server-Sent Events with real-time updates
// @Summary Get leases with real-time updates
// @Description Retrieves leases in the specified namespace with Server-Sent Events for real-time updates
// @Tags Leases
// @Accept json
// @Produce text/event-stream
// @Produce json
// @Param config query string true "Kubernetes config ID"
// @Param cluster query string false "Cluster name"
// @Param namespace query string true "Namespace name"
// @Success 200 {array} object "Stream of leases or JSON array"
// @Failure 400 {object} map[string]string "Bad request"
// @Failure 500 {object} map[string]string "Internal server error"
// @Security BearerAuth
// @Security KubeConfig
// @Router /api/v1/leases/sse [get]
func (h *LeasesHandler) GetLeasesSSE(c *gin.Context) {
	// Start child span for client setup
	_, clientSpan := h.tracingHelper.StartAuthSpan(c.Request.Context(), "get-client-config")
	defer clientSpan.End()

	client, err := h.getClientAndConfig(c)
	if err != nil {
		h.logger.WithError(err).Error("Failed to get client for leases SSE")
		h.tracingHelper.RecordError(clientSpan, err, "Failed to get Kubernetes client")
		h.sseHandler.SendSSEError(c, http.StatusBadRequest, err.Error())
		return
	}
	h.tracingHelper.RecordSuccess(clientSpan, "Successfully obtained Kubernetes client")

	namespace := c.Query("namespace")

	// Function to fetch leases data
	fetchLeases := func() (interface{}, error) {
		leaseList, err := client.CoordinationV1().Leases(namespace).List(c.Request.Context(), metav1.ListOptions{})
		if err != nil {
			return nil, err
		}
		return leaseList.Items, nil
	}

	// Get initial data
	initialData, err := fetchLeases()
	if err != nil {
		h.logger.WithError(err).Error("Failed to list leases for SSE")
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
		h.sseHandler.SendSSEResponseWithUpdates(c, initialData, fetchLeases)
		return
	}

	// For non-SSE requests, return JSON
	c.JSON(http.StatusOK, initialData)
}

// GetLease returns a specific lease
// @Summary Get a specific lease
// @Description Retrieves a specific lease by name and namespace
// @Tags Leases
// @Accept json
// @Produce json
// @Produce text/event-stream
// @Param config query string true "Kubernetes config ID"
// @Param cluster query string false "Cluster name"
// @Param namespace path string true "Namespace name"
// @Param name path string true "Lease name"
// @Success 200 {object} object "Lease details"
// @Failure 400 {object} map[string]string "Bad request"
// @Failure 404 {object} map[string]string "Lease not found"
// @Security BearerAuth
// @Security KubeConfig
// @Router /api/v1/leases/{namespace}/{name} [get]
func (h *LeasesHandler) GetLease(c *gin.Context) {
	// Start child span for client setup
	ctx, clientSpan := h.tracingHelper.StartAuthSpan(c.Request.Context(), "get-client-config")
	defer clientSpan.End()

	client, err := h.getClientAndConfig(c)
	if err != nil {
		h.logger.WithError(err).Error("Failed to get client for lease")
		h.tracingHelper.RecordError(clientSpan, err, "Failed to get Kubernetes client")
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	h.tracingHelper.RecordSuccess(clientSpan, "Successfully obtained Kubernetes client")

	namespace := c.Param("namespace")
	name := c.Param("name")

	// Start child span for Kubernetes API call
	_, apiSpan := h.tracingHelper.StartKubernetesAPISpan(ctx, "get", "lease", name)
	defer apiSpan.End()

	lease, err := client.CoordinationV1().Leases(namespace).Get(ctx, name, metav1.GetOptions{})
	if err != nil {
		h.logger.WithError(err).WithField("lease", name).WithField("namespace", namespace).Error("Failed to get lease")
		h.tracingHelper.RecordError(apiSpan, err, "Failed to get lease")
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}
	h.tracingHelper.RecordSuccess(apiSpan, "Successfully retrieved lease")
	h.tracingHelper.AddResourceAttributes(apiSpan, name, "lease", 1)

	// Check if this is an SSE request (EventSource expects SSE format)
	acceptHeader := c.GetHeader("Accept")
	if acceptHeader == "text/event-stream" {
		h.sseHandler.SendSSEResponse(c, lease)
		return
	}

	c.JSON(http.StatusOK, lease)
}

// GetLeaseYAML returns the YAML representation of a specific lease
// @Summary Get lease YAML
// @Description Retrieves the YAML representation of a specific lease
// @Tags Leases
// @Accept json
// @Produce text/plain
// @Param config query string true "Kubernetes config ID"
// @Param cluster query string false "Cluster name"
// @Param namespace query string true "Namespace name"
// @Param name path string true "Lease name"
// @Success 200 {string} string "Lease YAML"
// @Failure 400 {object} map[string]string "Bad request"
// @Failure 404 {object} map[string]string "Lease not found"
// @Security BearerAuth
// @Security KubeConfig
// @Router /api/v1/leases/{name}/yaml [get]
func (h *LeasesHandler) GetLeaseYAML(c *gin.Context) {
	// Start child span for client setup
	ctx, clientSpan := h.tracingHelper.StartAuthSpan(c.Request.Context(), "get-client-config")
	defer clientSpan.End()

	client, err := h.getClientAndConfig(c)
	if err != nil {
		h.logger.WithError(err).Error("Failed to get client for lease YAML")
		h.tracingHelper.RecordError(clientSpan, err, "Failed to get Kubernetes client")
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	h.tracingHelper.RecordSuccess(clientSpan, "Successfully obtained Kubernetes client")

	namespace := c.Query("namespace")
	name := c.Param("name")

	// Start child span for Kubernetes API call
	_, apiSpan := h.tracingHelper.StartKubernetesAPISpan(ctx, "get", "lease", name)
	defer apiSpan.End()

	lease, err := client.CoordinationV1().Leases(namespace).Get(ctx, name, metav1.GetOptions{})
	if err != nil {
		h.logger.WithError(err).WithField("lease", name).WithField("namespace", namespace).Error("Failed to get lease for YAML")
		h.tracingHelper.RecordError(apiSpan, err, "Failed to get lease for YAML")
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}
	h.tracingHelper.RecordSuccess(apiSpan, "Successfully retrieved lease for YAML")
	h.tracingHelper.AddResourceAttributes(apiSpan, name, "lease", 1)

	// Start child span for YAML generation
	_, yamlSpan := h.tracingHelper.StartDataProcessingSpan(ctx, "generate-yaml")
	defer yamlSpan.End()

	h.yamlHandler.SendYAMLResponse(c, lease, name)
	h.tracingHelper.RecordSuccess(yamlSpan, "Successfully generated YAML response")
}

// GetLeaseEvents returns events for a specific lease
// @Summary Get lease events
// @Description Retrieves events related to a specific lease
// @Tags Leases
// @Accept json
// @Produce json
// @Produce text/event-stream
// @Param config query string true "Kubernetes config ID"
// @Param cluster query string false "Cluster name"
// @Param name path string true "Lease name"
// @Success 200 {array} object "List of events"
// @Failure 400 {object} map[string]string "Bad request"
// @Failure 500 {object} map[string]string "Internal server error"
// @Security BearerAuth
// @Security KubeConfig
// @Router /api/v1/leases/{name}/events [get]
func (h *LeasesHandler) GetLeaseEvents(c *gin.Context) {
	// Start child span for client setup
	ctx, clientSpan := h.tracingHelper.StartAuthSpan(c.Request.Context(), "get-client-config")
	defer clientSpan.End()

	client, err := h.getClientAndConfig(c)
	if err != nil {
		h.logger.WithError(err).Error("Failed to get client for lease events")
		h.tracingHelper.RecordError(clientSpan, err, "Failed to get Kubernetes client")
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	h.tracingHelper.RecordSuccess(clientSpan, "Successfully obtained Kubernetes client")

	name := c.Param("name")

	// Start child span for events retrieval
	_, eventsSpan := h.tracingHelper.StartKubernetesAPISpan(ctx, "list", "events", name)
	defer eventsSpan.End()

	h.eventsHandler.GetResourceEvents(c, client, "Lease", name, h.sseHandler.SendSSEResponse)
	h.tracingHelper.RecordSuccess(eventsSpan, "Successfully retrieved lease events")
	h.tracingHelper.AddResourceAttributes(eventsSpan, name, "events", 0)
}
