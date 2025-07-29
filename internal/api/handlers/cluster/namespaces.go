package cluster

import (
	"encoding/base64"
	"fmt"
	"net/http"
	"time"

	"kubewall-backend/internal/k8s"
	"kubewall-backend/internal/storage"
	"kubewall-backend/pkg/logger"

	"github.com/gin-gonic/gin"
	"github.com/sirupsen/logrus"
	"gopkg.in/yaml.v3"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/client-go/kubernetes"
)

// NamespacesHandler handles namespace-related operations
type NamespacesHandler struct {
	store         *storage.KubeConfigStore
	clientFactory *k8s.ClientFactory
	logger        *logger.Logger
}

// NewNamespacesHandler creates a new NamespacesHandler instance
func NewNamespacesHandler(store *storage.KubeConfigStore, clientFactory *k8s.ClientFactory, log *logger.Logger) *NamespacesHandler {
	return &NamespacesHandler{
		store:         store,
		clientFactory: clientFactory,
		logger:        log,
	}
}

// getClientAndConfig gets the Kubernetes client and config for the current request
func (h *NamespacesHandler) getClientAndConfig(c *gin.Context) (*kubernetes.Clientset, error) {
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
func (h *NamespacesHandler) sendSSEResponse(c *gin.Context, data interface{}) {
	c.Header("Content-Type", "text/event-stream")
	c.Header("Cache-Control", "no-cache")
	c.Header("Connection", "keep-alive")
	c.Header("Access-Control-Allow-Origin", "*")
	c.Header("Access-Control-Allow-Headers", "Cache-Control")

	// Send the data as a JSON event
	c.SSEvent("message", data)
}

// sendSSEResponseWithUpdates sends SSE response with periodic updates
func (h *NamespacesHandler) sendSSEResponseWithUpdates(c *gin.Context, data interface{}, updateFunc func() (interface{}, error)) {
	c.Header("Content-Type", "text/event-stream")
	c.Header("Cache-Control", "no-cache")
	c.Header("Connection", "keep-alive")
	c.Header("Access-Control-Allow-Origin", "*")
	c.Header("Access-Control-Allow-Headers", "Cache-Control")

	// Send initial data
	c.SSEvent("message", data)

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
			c.SSEvent("message", updatedData)
		}
	}
}

// sendSSEError sends an SSE error response
func (h *NamespacesHandler) sendSSEError(c *gin.Context, statusCode int, message string) {
	c.Header("Content-Type", "text/event-stream")
	c.Header("Cache-Control", "no-cache")
	c.Header("Connection", "keep-alive")
	c.Header("Access-Control-Allow-Origin", "*")
	c.Header("Access-Control-Allow-Headers", "Cache-Control")

	c.SSEvent("error", gin.H{"error": message})
}

// GetNamespaces returns all namespaces
func (h *NamespacesHandler) GetNamespaces(c *gin.Context) {
	client, err := h.getClientAndConfig(c)
	if err != nil {
		h.logger.WithError(err).Error("Failed to get client for namespaces")
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	namespaces, err := client.CoreV1().Namespaces().List(c.Request.Context(), metav1.ListOptions{})
	if err != nil {
		h.logger.WithError(err).Error("Failed to list namespaces")
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, namespaces)
}

// GetNamespacesSSE returns namespaces as Server-Sent Events with real-time updates
func (h *NamespacesHandler) GetNamespacesSSE(c *gin.Context) {
	client, err := h.getClientAndConfig(c)
	if err != nil {
		h.logger.WithError(err).Error("Failed to get client for namespaces SSE")
		h.sendSSEError(c, http.StatusBadRequest, err.Error())
		return
	}

	// Function to fetch namespaces data
	fetchNamespaces := func() (interface{}, error) {
		namespaceList, err := client.CoreV1().Namespaces().List(c.Request.Context(), metav1.ListOptions{})
		if err != nil {
			return nil, err
		}
		return namespaceList.Items, nil
	}

	// Get initial data
	initialData, err := fetchNamespaces()
	if err != nil {
		h.logger.WithError(err).Error("Failed to list namespaces for SSE")
		h.sendSSEError(c, http.StatusInternalServerError, err.Error())
		return
	}

	// Check if this is an SSE request (EventSource expects SSE format)
	acceptHeader := c.GetHeader("Accept")
	if acceptHeader == "text/event-stream" {
		// Send SSE response with periodic updates
		h.sendSSEResponseWithUpdates(c, initialData, fetchNamespaces)
		return
	}

	// For non-SSE requests, return JSON
	c.JSON(http.StatusOK, initialData)
}

// GetNamespace returns a specific namespace
func (h *NamespacesHandler) GetNamespace(c *gin.Context) {
	client, err := h.getClientAndConfig(c)
	if err != nil {
		h.logger.WithError(err).Error("Failed to get client for namespace")
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	name := c.Param("name")
	namespace, err := client.CoreV1().Namespaces().Get(c.Request.Context(), name, metav1.GetOptions{})
	if err != nil {
		h.logger.WithError(err).WithField("namespace", name).Error("Failed to get namespace")
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	// Check if this is an SSE request (EventSource expects SSE format)
	acceptHeader := c.GetHeader("Accept")
	if acceptHeader == "text/event-stream" {
		h.sendSSEResponse(c, namespace)
		return
	}

	c.JSON(http.StatusOK, namespace)
}

// GetNamespaceYAML returns the YAML representation of a specific namespace
func (h *NamespacesHandler) GetNamespaceYAML(c *gin.Context) {
	client, err := h.getClientAndConfig(c)
	if err != nil {
		h.logger.WithError(err).Error("Failed to get client for namespace YAML")
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	name := c.Param("name")
	namespace, err := client.CoreV1().Namespaces().Get(c.Request.Context(), name, metav1.GetOptions{})
	if err != nil {
		h.logger.WithError(err).WithField("namespace", name).Error("Failed to get namespace for YAML")
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	// Convert to YAML
	yamlData, err := yaml.Marshal(namespace)
	if err != nil {
		h.logger.WithError(err).Error("Failed to marshal namespace to YAML")
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to convert to YAML"})
		return
	}

	// Check if this is an SSE request (EventSource expects SSE format)
	acceptHeader := c.GetHeader("Accept")
	if acceptHeader == "text/event-stream" {
		// For EventSource, send the YAML data as base64 encoded string
		encodedYAML := base64.StdEncoding.EncodeToString(yamlData)
		h.sendSSEResponse(c, gin.H{"data": encodedYAML})
		return
	}

	// Return as base64 encoded string to match frontend expectations
	encodedYAML := base64.StdEncoding.EncodeToString(yamlData)
	c.JSON(http.StatusOK, gin.H{"data": encodedYAML})
}

// GetNamespaceEvents returns events for a specific namespace
func (h *NamespacesHandler) GetNamespaceEvents(c *gin.Context) {
	name := c.Param("name")
	h.getResourceEvents(c, "Namespace", name)
}

// getResourceEvents is a common function to get events for any resource type
func (h *NamespacesHandler) getResourceEvents(c *gin.Context, resourceKind, resourceName string) {
	client, err := h.getClientAndConfig(c)
	if err != nil {
		h.logger.WithError(err).Error("Failed to get client for resource events")
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Get events for the specific resource
	events, err := client.CoreV1().Events("").List(c.Request.Context(), metav1.ListOptions{
		FieldSelector: "involvedObject.kind=" + resourceKind + ",involvedObject.name=" + resourceName,
	})
	if err != nil {
		h.logger.WithError(err).WithFields(logrus.Fields{
			"resource_kind": resourceKind,
			"resource_name": resourceName,
		}).Error("Failed to get resource events")
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
