package utils

import (
	"fmt"
	"net/http"

	"kubewall-backend/pkg/logger"

	"github.com/gin-gonic/gin"
	v1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/client-go/kubernetes"
)

// EventsHandler provides utility functions for event operations
type EventsHandler struct {
	logger *logger.Logger
}

// NewEventsHandler creates a new events handler
func NewEventsHandler(log *logger.Logger) *EventsHandler {
	return &EventsHandler{
		logger: log,
	}
}

// GetResourceEvents gets events for a specific resource
func (h *EventsHandler) GetResourceEvents(c *gin.Context, client *kubernetes.Clientset, resourceKind, resourceName string, sseHandler func(*gin.Context, interface{})) {
	// Get events filtered by the resource name and kind
	events, err := client.CoreV1().Events("").List(c.Request.Context(), metav1.ListOptions{
		FieldSelector: fmt.Sprintf("involvedObject.name=%s,involvedObject.kind=%s", resourceName, resourceKind),
	})
	if err != nil {
		h.logger.WithError(err).WithField("resource", resourceName).WithField("kind", resourceKind).Error("Failed to get resource events")
		// For EventSource, send error as SSE
		if c.GetHeader("Accept") == "text/event-stream" {
			h.sendSSEError(c, http.StatusInternalServerError, err.Error(), sseHandler)
		} else {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		}
		return
	}

	// Ensure we always have a valid array, even if empty
	eventsList := events.Items
	if eventsList == nil {
		eventsList = []v1.Event{}
	}

	// Always send SSE format for detail endpoints since they're used by EventSource
	h.logger.Info("Sending SSE response for resource events EventSource")
	sseHandler(c, eventsList)
}

// GetResourceEventsWithNamespace gets events for a specific resource in a namespace
func (h *EventsHandler) GetResourceEventsWithNamespace(c *gin.Context, client *kubernetes.Clientset, resourceKind, resourceName, namespace string, sseHandler func(*gin.Context, interface{})) {
	// Get events filtered by the resource name, kind, and namespace
	events, err := client.CoreV1().Events(namespace).List(c.Request.Context(), metav1.ListOptions{
		FieldSelector: fmt.Sprintf("involvedObject.name=%s,involvedObject.kind=%s", resourceName, resourceKind),
	})
	if err != nil {
		h.logger.WithError(err).WithField("resource", resourceName).WithField("kind", resourceKind).WithField("namespace", namespace).Error("Failed to get resource events")
		// For EventSource, send error as SSE
		if c.GetHeader("Accept") == "text/event-stream" {
			h.sendSSEError(c, http.StatusInternalServerError, err.Error(), sseHandler)
		} else {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		}
		return
	}

	// Ensure we always have a valid array, even if empty
	eventsList := events.Items
	if eventsList == nil {
		eventsList = []v1.Event{}
	}

	// Always send SSE format for detail endpoints since they're used by EventSource
	h.logger.Info("Sending SSE response for resource events EventSource")
	sseHandler(c, eventsList)
}

// sendSSEError sends a Server-Sent Events error response
func (h *EventsHandler) sendSSEError(c *gin.Context, statusCode int, message string, sseHandler func(*gin.Context, interface{})) {
	errorData := gin.H{"error": message}
	sseHandler(c, errorData)
}
