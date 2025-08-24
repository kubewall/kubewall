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

// EventsHandler handles events-related operations
type EventsHandler struct {
	store         *storage.KubeConfigStore
	clientFactory *k8s.ClientFactory
	logger        *logger.Logger
	sseHandler    *utils.SSEHandler
	tracingHelper *tracing.TracingHelper
}

// NewEventsHandler creates a new EventsHandler instance
func NewEventsHandler(store *storage.KubeConfigStore, clientFactory *k8s.ClientFactory, log *logger.Logger) *EventsHandler {
	return &EventsHandler{
		store:         store,
		clientFactory: clientFactory,
		logger:        log,
		sseHandler:    utils.NewSSEHandler(log),
		tracingHelper: tracing.GetTracingHelper(),
	}
}

// getClientAndConfig gets the Kubernetes client and config for the current request
func (h *EventsHandler) getClientAndConfig(c *gin.Context) (*kubernetes.Clientset, error) {
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

// GetEvents returns all events in a namespace
// @Summary Get Events
// @Description Retrieves all events in a specific namespace or cluster-wide if no namespace is specified
// @Tags Cluster
// @Accept json
// @Produce json,text/event-stream
// @Param config query string true "Kubernetes configuration ID"
// @Param cluster query string false "Cluster name for multi-cluster setups"
// @Param namespace query string false "Kubernetes namespace to filter events (empty for cluster-wide)"
// @Success 200 {array} object "List of events"
// @Failure 400 {object} map[string]string "Bad request - missing or invalid parameters"
// @Failure 403 {object} map[string]string "Forbidden - insufficient permissions"
// @Failure 500 {object} map[string]string "Internal server error"
// @Security BearerAuth
// @Security KubeConfig
// @Router /api/v1/events [get]
func (h *EventsHandler) GetEvents(c *gin.Context) {
	// Start child span for client setup
	ctx, clientSpan := h.tracingHelper.StartAuthSpan(c.Request.Context(), "get-client-config")
	defer clientSpan.End()

	client, err := h.getClientAndConfig(c)
	if err != nil {
		h.logger.WithError(err).Error("Failed to get client for events")
		h.tracingHelper.RecordError(clientSpan, err, "Failed to get Kubernetes client")
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	h.tracingHelper.RecordSuccess(clientSpan, "Successfully obtained Kubernetes client")

	namespace := c.Query("namespace")

	// Start child span for Kubernetes API call
	_, apiSpan := h.tracingHelper.StartKubernetesAPISpan(ctx, "list", "events", namespace)
	defer apiSpan.End()

	events, err := client.CoreV1().Events(namespace).List(ctx, metav1.ListOptions{})
	if err != nil {
		h.logger.WithError(err).Error("Failed to list events")
		h.tracingHelper.RecordError(apiSpan, err, "Failed to list events")

		// Check if this is a permission error
		if utils.IsPermissionError(err) {
			c.JSON(http.StatusForbidden, utils.CreatePermissionErrorResponse(err))
		} else {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		}
		return
	}
	h.tracingHelper.RecordSuccess(apiSpan, "Successfully listed events")
	h.tracingHelper.AddResourceAttributes(apiSpan, namespace, "events", len(events.Items))

	// Check if this is an SSE request (EventSource expects SSE format)
	acceptHeader := c.GetHeader("Accept")
	if acceptHeader == "text/event-stream" {
		h.sseHandler.SendSSEResponse(c, events.Items)
		return
	}

	c.JSON(http.StatusOK, events.Items)
}

// GetEventsSSE returns events as Server-Sent Events with real-time updates
// @Summary Get Events (SSE)
// @Description Streams Events data in real-time using Server-Sent Events. Provides live updates of cluster events.
// @Tags Cluster
// @Accept text/event-stream
// @Produce text/event-stream,application/json
// @Param config query string true "Kubernetes configuration ID"
// @Param cluster query string false "Cluster name for multi-cluster setups"
// @Param namespace query string false "Kubernetes namespace to filter events (empty for cluster-wide)"
// @Success 200 {array} object "Streaming Events data"
// @Failure 400 {object} map[string]string "Bad request - missing or invalid parameters"
// @Failure 403 {object} map[string]string "Forbidden - insufficient permissions"
// @Failure 500 {object} map[string]string "Internal server error"
// @Security BearerAuth
// @Security KubeConfig
// @Router /api/v1/events [get]
func (h *EventsHandler) GetEventsSSE(c *gin.Context) {
	// Start child span for client setup
	_, clientSpan := h.tracingHelper.StartAuthSpan(c.Request.Context(), "get-client-config")
	defer clientSpan.End()

	client, err := h.getClientAndConfig(c)
	if err != nil {
		h.logger.WithError(err).Error("Failed to get client for events SSE")
		h.tracingHelper.RecordError(clientSpan, err, "Failed to get Kubernetes client")
		h.sseHandler.SendSSEError(c, http.StatusBadRequest, err.Error())
		return
	}
	h.tracingHelper.RecordSuccess(clientSpan, "Successfully obtained Kubernetes client")

	namespace := c.Query("namespace")

	// Function to fetch events data
	fetchEvents := func() (interface{}, error) {
		eventList, err := client.CoreV1().Events(namespace).List(c.Request.Context(), metav1.ListOptions{})
		if err != nil {
			return nil, err
		}
		return eventList.Items, nil
	}

	// Get initial data
	initialData, err := fetchEvents()
	if err != nil {
		h.logger.WithError(err).Error("Failed to list events for SSE")

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
		h.sseHandler.SendSSEResponseWithUpdates(c, initialData, fetchEvents)
		return
	}

	// For non-SSE requests, return JSON
	c.JSON(http.StatusOK, initialData)
}
