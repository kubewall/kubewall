package cluster

import (
	"encoding/json"
	"fmt"
	"net/http"
	"time"

	"kubewall-backend/internal/k8s"
	"kubewall-backend/internal/storage"
	"kubewall-backend/pkg/logger"

	"github.com/gin-gonic/gin"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/client-go/kubernetes"
)

// EventsHandler handles events-related operations
type EventsHandler struct {
	store         *storage.KubeConfigStore
	clientFactory *k8s.ClientFactory
	logger        *logger.Logger
}

// NewEventsHandler creates a new EventsHandler instance
func NewEventsHandler(store *storage.KubeConfigStore, clientFactory *k8s.ClientFactory, log *logger.Logger) *EventsHandler {
	return &EventsHandler{
		store:         store,
		clientFactory: clientFactory,
		logger:        log,
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

// sendSSEResponse sends a Server-Sent Events response
func (h *EventsHandler) sendSSEResponse(c *gin.Context, data interface{}) {
	c.Header("Content-Type", "text/event-stream")
	c.Header("Cache-Control", "no-cache")
	c.Header("Connection", "keep-alive")
	c.Header("Access-Control-Allow-Origin", "*")
	c.Header("Access-Control-Allow-Headers", "Cache-Control")

	// Send the data as a JSON event
	jsonData, err := json.Marshal(data)
	if err != nil {
		h.logger.WithError(err).Error("Failed to marshal SSE data")
		return
	}
	// Send data directly without event wrapper
	c.Data(http.StatusOK, "text/event-stream", []byte("data: "+string(jsonData)+"\n\n"))
}

// sendSSEError sends an SSE error response
func (h *EventsHandler) sendSSEError(c *gin.Context, statusCode int, message string) {
	c.Header("Content-Type", "text/event-stream")
	c.Header("Cache-Control", "no-cache")
	c.Header("Connection", "keep-alive")
	c.Header("Access-Control-Allow-Origin", "*")
	c.Header("Access-Control-Allow-Headers", "Cache-Control")

	errorData := gin.H{"error": message}
	jsonData, err := json.Marshal(errorData)
	if err != nil {
		h.logger.WithError(err).Error("Failed to marshal SSE error data")
		return
	}
	c.Data(http.StatusOK, "text/event-stream", []byte("data: "+string(jsonData)+"\n\n"))
}

// GetEvents returns all events in a namespace
func (h *EventsHandler) GetEvents(c *gin.Context) {
	client, err := h.getClientAndConfig(c)
	if err != nil {
		h.logger.WithError(err).Error("Failed to get client for events")
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	namespace := c.Query("namespace")
	events, err := client.CoreV1().Events(namespace).List(c.Request.Context(), metav1.ListOptions{})
	if err != nil {
		h.logger.WithError(err).Error("Failed to list events")
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	// Check if this is an SSE request (EventSource expects SSE format)
	acceptHeader := c.GetHeader("Accept")
	if acceptHeader == "text/event-stream" {
		h.sendSSEResponse(c, events.Items)
		return
	}

	c.JSON(http.StatusOK, events.Items)
}

// GetEventsSSE returns events as Server-Sent Events with real-time updates
func (h *EventsHandler) GetEventsSSE(c *gin.Context) {
	client, err := h.getClientAndConfig(c)
	if err != nil {
		h.logger.WithError(err).Error("Failed to get client for events SSE")
		h.sendSSEError(c, http.StatusBadRequest, err.Error())
		return
	}

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
		h.sendSSEError(c, http.StatusInternalServerError, err.Error())
		return
	}

	// Check if this is an SSE request (EventSource expects SSE format)
	acceptHeader := c.GetHeader("Accept")
	if acceptHeader == "text/event-stream" {
		// Send SSE response with periodic updates
		h.sendSSEResponseWithUpdates(c, initialData, fetchEvents)
		return
	}

	// For non-SSE requests, return JSON
	c.JSON(http.StatusOK, initialData)
}

// sendSSEResponseWithUpdates sends SSE response with periodic updates
func (h *EventsHandler) sendSSEResponseWithUpdates(c *gin.Context, data interface{}, updateFunc func() (interface{}, error)) {
	c.Header("Content-Type", "text/event-stream")
	c.Header("Cache-Control", "no-cache")
	c.Header("Connection", "keep-alive")
	c.Header("Access-Control-Allow-Origin", "*")
	c.Header("Access-Control-Allow-Headers", "Cache-Control")

	// Send initial data
	jsonData, err := json.Marshal(data)
	if err != nil {
		h.logger.WithError(err).Error("Failed to marshal SSE data")
		return
	}
	c.Data(http.StatusOK, "text/event-stream", []byte("data: "+string(jsonData)+"\n\n"))

	// Set up periodic updates
	ticker := time.NewTicker(5 * time.Second)
	defer ticker.Stop()

	for {
		select {
		case <-c.Request.Context().Done():
			return
		case <-ticker.C:
			updatedData, err := updateFunc()
			if err != nil {
				h.logger.WithError(err).Error("Failed to get updated data")
				continue
			}
			jsonData, err := json.Marshal(updatedData)
			if err != nil {
				h.logger.WithError(err).Error("Failed to marshal updated SSE data")
				continue
			}
			c.Data(http.StatusOK, "text/event-stream", []byte("data: "+string(jsonData)+"\n\n"))
		}
	}
}
