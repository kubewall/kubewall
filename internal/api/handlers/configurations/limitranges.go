package configurations

import (
	"encoding/base64"
	"fmt"
	"net/http"

	"kubewall-backend/internal/api/transformers"
	"kubewall-backend/internal/api/types"
	"kubewall-backend/internal/api/utils"
	"kubewall-backend/internal/k8s"
	"kubewall-backend/internal/storage"
	"kubewall-backend/pkg/logger"

	"github.com/gin-gonic/gin"
	"gopkg.in/yaml.v3"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/client-go/kubernetes"
)

// LimitRangesHandler handles LimitRange-related API requests
type LimitRangesHandler struct {
	store         *storage.KubeConfigStore
	clientFactory *k8s.ClientFactory
	logger        *logger.Logger
	sseHandler    *utils.SSEHandler
	yamlHandler   *utils.YAMLHandler
	eventsHandler *utils.EventsHandler
}

// NewLimitRangesHandler creates a new LimitRangesHandler
func NewLimitRangesHandler(store *storage.KubeConfigStore, clientFactory *k8s.ClientFactory, log *logger.Logger) *LimitRangesHandler {
	return &LimitRangesHandler{
		store:         store,
		clientFactory: clientFactory,
		logger:        log,
		sseHandler:    utils.NewSSEHandler(log),
		yamlHandler:   utils.NewYAMLHandler(log),
		eventsHandler: utils.NewEventsHandler(log),
	}
}

// getClientAndConfig gets the Kubernetes client and config for the given config ID and cluster
func (h *LimitRangesHandler) getClientAndConfig(c *gin.Context) (*kubernetes.Clientset, error) {
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

// GetLimitRanges returns all limit ranges in a namespace
func (h *LimitRangesHandler) GetLimitRanges(c *gin.Context) {
	client, err := h.getClientAndConfig(c)
	if err != nil {
		h.logger.WithError(err).Error("Failed to get client for limit ranges")
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	namespace := c.Query("namespace")
	limitRangeList, err := client.CoreV1().LimitRanges(namespace).List(c.Request.Context(), metav1.ListOptions{})
	if err != nil {
		h.logger.WithError(err).Error("Failed to list limit ranges")
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	// Transform limit ranges to the expected format
	var transformedLimitRanges []types.LimitRangeListResponse
	for _, limitRange := range limitRangeList.Items {
		transformedLimitRanges = append(transformedLimitRanges, transformers.TransformLimitRangeToResponse(&limitRange))
	}

	c.JSON(http.StatusOK, transformedLimitRanges)
}

// GetLimitRangesSSE returns limit ranges as Server-Sent Events with real-time updates
func (h *LimitRangesHandler) GetLimitRangesSSE(c *gin.Context) {
	client, err := h.getClientAndConfig(c)
	if err != nil {
		h.logger.WithError(err).Error("Failed to get client for limit ranges SSE")
		h.sseHandler.SendSSEError(c, http.StatusBadRequest, err.Error())
		return
	}

	namespace := c.Query("namespace")

	// Function to fetch and transform limit ranges data
	fetchLimitRanges := func() (interface{}, error) {
		limitRangeList, err := client.CoreV1().LimitRanges(namespace).List(c.Request.Context(), metav1.ListOptions{})
		if err != nil {
			return nil, err
		}

		// Transform limit ranges to the expected format
		var transformedLimitRanges []types.LimitRangeListResponse
		for _, limitRange := range limitRangeList.Items {
			transformedLimitRanges = append(transformedLimitRanges, transformers.TransformLimitRangeToResponse(&limitRange))
		}

		return transformedLimitRanges, nil
	}

	// Get initial data
	initialData, err := fetchLimitRanges()
	if err != nil {
		h.logger.WithError(err).Error("Failed to list limit ranges for SSE")
		h.sseHandler.SendSSEError(c, http.StatusInternalServerError, err.Error())
		return
	}

	// Send SSE response with periodic updates
	h.sseHandler.SendSSEResponseWithUpdates(c, initialData, fetchLimitRanges)
}

// GetLimitRange returns a specific limit range
func (h *LimitRangesHandler) GetLimitRange(c *gin.Context) {
	client, err := h.getClientAndConfig(c)
	if err != nil {
		h.logger.WithError(err).Error("Failed to get client for limit range")
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	namespace := c.Param("namespace")
	name := c.Param("name")
	limitRange, err := client.CoreV1().LimitRanges(namespace).Get(c.Request.Context(), name, metav1.GetOptions{})
	if err != nil {
		h.logger.WithError(err).WithField("limitrange", name).WithField("namespace", namespace).Error("Failed to get limit range")
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	// Check if this is an SSE request (EventSource expects SSE format)
	acceptHeader := c.GetHeader("Accept")
	if acceptHeader == "text/event-stream" {
		h.sseHandler.SendSSEResponse(c, limitRange)
		return
	}

	c.JSON(http.StatusOK, limitRange)
}

// GetLimitRangeByName returns a specific limit range by name using namespace from query parameters
func (h *LimitRangesHandler) GetLimitRangeByName(c *gin.Context) {
	client, err := h.getClientAndConfig(c)
	if err != nil {
		h.logger.WithError(err).Error("Failed to get client for limit range")
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	name := c.Param("name")
	namespace := c.Query("namespace")

	if namespace == "" {
		h.logger.WithField("limitrange", name).Error("Namespace is required for limit range lookup")
		c.JSON(http.StatusBadRequest, gin.H{"error": "namespace parameter is required"})
		return
	}

	limitRange, err := client.CoreV1().LimitRanges(namespace).Get(c.Request.Context(), name, metav1.GetOptions{})
	if err != nil {
		h.logger.WithError(err).WithField("limitrange", name).WithField("namespace", namespace).Error("Failed to get limit range")
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	// Check if this is an SSE request (EventSource expects SSE format)
	acceptHeader := c.GetHeader("Accept")
	if acceptHeader == "text/event-stream" {
		h.sseHandler.SendSSEResponse(c, limitRange)
		return
	}

	c.JSON(http.StatusOK, limitRange)
}

// GetLimitRangeYAMLByName returns the YAML representation of a specific limit range by name using namespace from query parameters
func (h *LimitRangesHandler) GetLimitRangeYAMLByName(c *gin.Context) {
	client, err := h.getClientAndConfig(c)
	if err != nil {
		h.logger.WithError(err).Error("Failed to get client for limit range YAML")
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	name := c.Param("name")
	namespace := c.Query("namespace")

	if namespace == "" {
		h.logger.WithField("limitrange", name).Error("Namespace is required for limit range YAML lookup")
		c.JSON(http.StatusBadRequest, gin.H{"error": "namespace parameter is required"})
		return
	}

	limitRange, err := client.CoreV1().LimitRanges(namespace).Get(c.Request.Context(), name, metav1.GetOptions{})
	if err != nil {
		h.logger.WithError(err).WithField("limitrange", name).WithField("namespace", namespace).Error("Failed to get limit range for YAML")
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	// Convert to YAML
	yamlData, err := yaml.Marshal(limitRange)
	if err != nil {
		h.logger.WithError(err).Error("Failed to marshal limit range to YAML")
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to convert to YAML"})
		return
	}

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

// GetLimitRangeYAML returns the YAML representation of a specific limit range
func (h *LimitRangesHandler) GetLimitRangeYAML(c *gin.Context) {
	client, err := h.getClientAndConfig(c)
	if err != nil {
		h.logger.WithError(err).Error("Failed to get client for limit range YAML")
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	namespace := c.Param("namespace")
	name := c.Param("name")
	limitRange, err := client.CoreV1().LimitRanges(namespace).Get(c.Request.Context(), name, metav1.GetOptions{})
	if err != nil {
		h.logger.WithError(err).WithField("limitrange", name).WithField("namespace", namespace).Error("Failed to get limit range for YAML")
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	// Convert to YAML
	yamlData, err := yaml.Marshal(limitRange)
	if err != nil {
		h.logger.WithError(err).Error("Failed to marshal limit range to YAML")
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to convert to YAML"})
		return
	}

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

// GetLimitRangeEventsByName returns events for a specific limit range by name using namespace from query parameters
func (h *LimitRangesHandler) GetLimitRangeEventsByName(c *gin.Context) {
	name := c.Param("name")
	namespace := c.Query("namespace")

	if namespace == "" {
		h.logger.WithField("limitrange", name).Error("Namespace is required for limit range events lookup")
		c.JSON(http.StatusBadRequest, gin.H{"error": "namespace parameter is required"})
		return
	}

	client, err := h.getClientAndConfig(c)
	if err != nil {
		h.logger.WithError(err).Error("Failed to get client for limit range events")
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	h.eventsHandler.GetResourceEventsWithNamespace(c, client, "LimitRange", name, namespace, h.sseHandler.SendSSEResponse)
}

// GetLimitRangeEvents returns events for a specific limit range
func (h *LimitRangesHandler) GetLimitRangeEvents(c *gin.Context) {
	name := c.Param("name")
	namespace := c.Param("namespace")

	client, err := h.getClientAndConfig(c)
	if err != nil {
		h.logger.WithError(err).Error("Failed to get client for limit range events")
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	h.eventsHandler.GetResourceEventsWithNamespace(c, client, "LimitRange", name, namespace, h.sseHandler.SendSSEResponse)
}
