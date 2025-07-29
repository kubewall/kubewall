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

// LeasesHandler handles lease-related operations
type LeasesHandler struct {
	store         *storage.KubeConfigStore
	clientFactory *k8s.ClientFactory
	logger        *logger.Logger
}

// NewLeasesHandler creates a new LeasesHandler instance
func NewLeasesHandler(store *storage.KubeConfigStore, clientFactory *k8s.ClientFactory, log *logger.Logger) *LeasesHandler {
	return &LeasesHandler{
		store:         store,
		clientFactory: clientFactory,
		logger:        log,
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

// sendSSEResponse sends a Server-Sent Events response
func (h *LeasesHandler) sendSSEResponse(c *gin.Context, data interface{}) {
	c.Header("Content-Type", "text/event-stream")
	c.Header("Cache-Control", "no-cache")
	c.Header("Connection", "keep-alive")
	c.Header("Access-Control-Allow-Origin", "*")
	c.Header("Access-Control-Allow-Headers", "Cache-Control")

	// Send the data as a JSON event
	c.SSEvent("message", data)
}

// sendSSEResponseWithUpdates sends SSE response with periodic updates
func (h *LeasesHandler) sendSSEResponseWithUpdates(c *gin.Context, data interface{}, updateFunc func() (interface{}, error)) {
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
func (h *LeasesHandler) sendSSEError(c *gin.Context, statusCode int, message string) {
	c.Header("Content-Type", "text/event-stream")
	c.Header("Cache-Control", "no-cache")
	c.Header("Connection", "keep-alive")
	c.Header("Access-Control-Allow-Origin", "*")
	c.Header("Access-Control-Allow-Headers", "Cache-Control")

	c.SSEvent("error", gin.H{"error": message})
}

// GetLeases returns all leases in a namespace
func (h *LeasesHandler) GetLeases(c *gin.Context) {
	client, err := h.getClientAndConfig(c)
	if err != nil {
		h.logger.WithError(err).Error("Failed to get client for leases")
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	namespace := c.Query("namespace")
	leases, err := client.CoordinationV1().Leases(namespace).List(c.Request.Context(), metav1.ListOptions{})
	if err != nil {
		h.logger.WithError(err).Error("Failed to list leases")
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, leases)
}

// GetLeasesSSE returns leases as Server-Sent Events with real-time updates
func (h *LeasesHandler) GetLeasesSSE(c *gin.Context) {
	client, err := h.getClientAndConfig(c)
	if err != nil {
		h.logger.WithError(err).Error("Failed to get client for leases SSE")
		h.sendSSEError(c, http.StatusBadRequest, err.Error())
		return
	}

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
		h.sendSSEError(c, http.StatusInternalServerError, err.Error())
		return
	}

	// Check if this is an SSE request (EventSource expects SSE format)
	acceptHeader := c.GetHeader("Accept")
	if acceptHeader == "text/event-stream" {
		// Send SSE response with periodic updates
		h.sendSSEResponseWithUpdates(c, initialData, fetchLeases)
		return
	}

	// For non-SSE requests, return JSON
	c.JSON(http.StatusOK, initialData)
}

// GetLease returns a specific lease
func (h *LeasesHandler) GetLease(c *gin.Context) {
	client, err := h.getClientAndConfig(c)
	if err != nil {
		h.logger.WithError(err).Error("Failed to get client for lease")
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	namespace := c.Query("namespace")
	name := c.Param("name")
	lease, err := client.CoordinationV1().Leases(namespace).Get(c.Request.Context(), name, metav1.GetOptions{})
	if err != nil {
		h.logger.WithError(err).WithField("lease", name).WithField("namespace", namespace).Error("Failed to get lease")
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	// Check if this is an SSE request (EventSource expects SSE format)
	acceptHeader := c.GetHeader("Accept")
	if acceptHeader == "text/event-stream" {
		h.sendSSEResponse(c, lease)
		return
	}

	c.JSON(http.StatusOK, lease)
}

// GetLeaseYAML returns the YAML representation of a specific lease
func (h *LeasesHandler) GetLeaseYAML(c *gin.Context) {
	client, err := h.getClientAndConfig(c)
	if err != nil {
		h.logger.WithError(err).Error("Failed to get client for lease YAML")
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	namespace := c.Query("namespace")
	name := c.Param("name")
	lease, err := client.CoordinationV1().Leases(namespace).Get(c.Request.Context(), name, metav1.GetOptions{})
	if err != nil {
		h.logger.WithError(err).WithField("lease", name).WithField("namespace", namespace).Error("Failed to get lease for YAML")
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	// Convert to YAML
	yamlData, err := yaml.Marshal(lease)
	if err != nil {
		h.logger.WithError(err).Error("Failed to marshal lease to YAML")
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

// GetLeaseEvents returns events for a specific lease
func (h *LeasesHandler) GetLeaseEvents(c *gin.Context) {
	name := c.Param("name")
	h.getResourceEvents(c, "Lease", name)
}

// getResourceEvents is a common function to get events for any resource type
func (h *LeasesHandler) getResourceEvents(c *gin.Context, resourceKind, resourceName string) {
	client, err := h.getClientAndConfig(c)
	if err != nil {
		h.logger.WithError(err).Error("Failed to get client for resource events")
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	namespace := c.Query("namespace")

	// Get events for the specific resource
	events, err := client.CoreV1().Events(namespace).List(c.Request.Context(), metav1.ListOptions{
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
