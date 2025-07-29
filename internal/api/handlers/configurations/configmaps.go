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

// ConfigMapsHandler handles ConfigMap-related API requests
type ConfigMapsHandler struct {
	store         *storage.KubeConfigStore
	clientFactory *k8s.ClientFactory
	logger        *logger.Logger
	sseHandler    *utils.SSEHandler
	yamlHandler   *utils.YAMLHandler
	eventsHandler *utils.EventsHandler
}

// NewConfigMapsHandler creates a new ConfigMapsHandler
func NewConfigMapsHandler(store *storage.KubeConfigStore, clientFactory *k8s.ClientFactory, log *logger.Logger) *ConfigMapsHandler {
	return &ConfigMapsHandler{
		store:         store,
		clientFactory: clientFactory,
		logger:        log,
		sseHandler:    utils.NewSSEHandler(log),
		yamlHandler:   utils.NewYAMLHandler(log),
		eventsHandler: utils.NewEventsHandler(log),
	}
}

// getClientAndConfig gets the Kubernetes client and config for the given config ID and cluster
func (h *ConfigMapsHandler) getClientAndConfig(c *gin.Context) (*kubernetes.Clientset, error) {
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

// GetConfigMaps returns all configmaps in a namespace
func (h *ConfigMapsHandler) GetConfigMaps(c *gin.Context) {
	client, err := h.getClientAndConfig(c)
	if err != nil {
		h.logger.WithError(err).Error("Failed to get client for configmaps")
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	namespace := c.Query("namespace")
	configMapList, err := client.CoreV1().ConfigMaps(namespace).List(c.Request.Context(), metav1.ListOptions{})
	if err != nil {
		h.logger.WithError(err).Error("Failed to list configmaps")
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	// Transform configmaps to the expected format
	var transformedConfigMaps []types.ConfigMapListResponse
	for _, configMap := range configMapList.Items {
		transformedConfigMaps = append(transformedConfigMaps, transformers.TransformConfigMapToResponse(&configMap))
	}

	c.JSON(http.StatusOK, transformedConfigMaps)
}

// GetConfigMapsSSE returns configmaps as Server-Sent Events with real-time updates
func (h *ConfigMapsHandler) GetConfigMapsSSE(c *gin.Context) {
	client, err := h.getClientAndConfig(c)
	if err != nil {
		h.logger.WithError(err).Error("Failed to get client for configmaps SSE")
		h.sseHandler.SendSSEError(c, http.StatusBadRequest, err.Error())
		return
	}

	namespace := c.Query("namespace")

	// Function to fetch and transform configmaps data
	fetchConfigMaps := func() (interface{}, error) {
		configMapList, err := client.CoreV1().ConfigMaps(namespace).List(c.Request.Context(), metav1.ListOptions{})
		if err != nil {
			return nil, err
		}

		// Transform configmaps to the expected format
		var transformedConfigMaps []types.ConfigMapListResponse
		for _, configMap := range configMapList.Items {
			transformedConfigMaps = append(transformedConfigMaps, transformers.TransformConfigMapToResponse(&configMap))
		}

		return transformedConfigMaps, nil
	}

	// Get initial data
	initialData, err := fetchConfigMaps()
	if err != nil {
		h.logger.WithError(err).Error("Failed to list configmaps for SSE")
		h.sseHandler.SendSSEError(c, http.StatusInternalServerError, err.Error())
		return
	}

	// Check if this is an SSE request (EventSource expects SSE format)
	acceptHeader := c.GetHeader("Accept")
	if acceptHeader == "text/event-stream" {
		// Send SSE response with periodic updates
		h.sseHandler.SendSSEResponseWithUpdates(c, initialData, fetchConfigMaps)
		return
	}

	// For non-SSE requests, return JSON
	c.JSON(http.StatusOK, initialData)
}

// GetConfigMap returns a specific configmap
func (h *ConfigMapsHandler) GetConfigMap(c *gin.Context) {
	client, err := h.getClientAndConfig(c)
	if err != nil {
		h.logger.WithError(err).Error("Failed to get client for configmap")
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	namespace := c.Param("namespace")
	name := c.Param("name")
	configMap, err := client.CoreV1().ConfigMaps(namespace).Get(c.Request.Context(), name, metav1.GetOptions{})
	if err != nil {
		h.logger.WithError(err).WithField("configmap", name).WithField("namespace", namespace).Error("Failed to get configmap")
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	// Always send SSE format for detail endpoints since they're used by EventSource
	h.sseHandler.SendSSEResponse(c, configMap)
}

// GetConfigMapByName returns a specific configmap by name using namespace from query parameters
func (h *ConfigMapsHandler) GetConfigMapByName(c *gin.Context) {
	client, err := h.getClientAndConfig(c)
	if err != nil {
		h.logger.WithError(err).Error("Failed to get client for configmap")
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	name := c.Param("name")
	namespace := c.Query("namespace")

	if namespace == "" {
		h.logger.WithField("configmap", name).Error("Namespace is required for configmap lookup")
		c.JSON(http.StatusBadRequest, gin.H{"error": "namespace parameter is required"})
		return
	}

	configMap, err := client.CoreV1().ConfigMaps(namespace).Get(c.Request.Context(), name, metav1.GetOptions{})
	if err != nil {
		h.logger.WithError(err).WithField("configmap", name).WithField("namespace", namespace).Error("Failed to get configmap")
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	// Always send SSE format for detail endpoints since they're used by EventSource
	h.sseHandler.SendSSEResponse(c, configMap)
}

// GetConfigMapYAMLByName returns the YAML representation of a specific configmap by name using namespace from query parameters
func (h *ConfigMapsHandler) GetConfigMapYAMLByName(c *gin.Context) {
	client, err := h.getClientAndConfig(c)
	if err != nil {
		h.logger.WithError(err).Error("Failed to get client for configmap YAML")
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	name := c.Param("name")
	namespace := c.Query("namespace")

	if namespace == "" {
		h.logger.WithField("configmap", name).Error("Namespace is required for configmap YAML lookup")
		c.JSON(http.StatusBadRequest, gin.H{"error": "namespace parameter is required"})
		return
	}

	configMap, err := client.CoreV1().ConfigMaps(namespace).Get(c.Request.Context(), name, metav1.GetOptions{})
	if err != nil {
		h.logger.WithError(err).WithField("configmap", name).WithField("namespace", namespace).Error("Failed to get configmap for YAML")
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	// Convert to YAML
	yamlData, err := yaml.Marshal(configMap)
	if err != nil {
		h.logger.WithError(err).Error("Failed to marshal configmap to YAML")
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

// GetConfigMapYAML returns the YAML representation of a specific configmap
func (h *ConfigMapsHandler) GetConfigMapYAML(c *gin.Context) {
	client, err := h.getClientAndConfig(c)
	if err != nil {
		h.logger.WithError(err).Error("Failed to get client for configmap YAML")
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	namespace := c.Param("namespace")
	name := c.Param("name")
	configMap, err := client.CoreV1().ConfigMaps(namespace).Get(c.Request.Context(), name, metav1.GetOptions{})
	if err != nil {
		h.logger.WithError(err).WithField("configmap", name).WithField("namespace", namespace).Error("Failed to get configmap for YAML")
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	// Convert to YAML
	yamlData, err := yaml.Marshal(configMap)
	if err != nil {
		h.logger.WithError(err).Error("Failed to marshal configmap to YAML")
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

// GetConfigMapEventsByName returns events for a specific configmap by name using namespace from query parameters
func (h *ConfigMapsHandler) GetConfigMapEventsByName(c *gin.Context) {
	name := c.Param("name")
	namespace := c.Query("namespace")

	if namespace == "" {
		h.logger.WithField("configmap", name).Error("Namespace is required for configmap events lookup")
		c.JSON(http.StatusBadRequest, gin.H{"error": "namespace parameter is required"})
		return
	}

	client, err := h.getClientAndConfig(c)
	if err != nil {
		h.logger.WithError(err).Error("Failed to get client for configmap events")
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	h.eventsHandler.GetResourceEventsWithNamespace(c, client, "ConfigMap", name, namespace, h.sseHandler.SendSSEResponse)
}

// GetConfigMapEvents returns events for a specific configmap
func (h *ConfigMapsHandler) GetConfigMapEvents(c *gin.Context) {
	name := c.Param("name")
	namespace := c.Param("namespace")

	client, err := h.getClientAndConfig(c)
	if err != nil {
		h.logger.WithError(err).Error("Failed to get client for configmap events")
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	h.eventsHandler.GetResourceEventsWithNamespace(c, client, "ConfigMap", name, namespace, h.sseHandler.SendSSEResponse)
}
