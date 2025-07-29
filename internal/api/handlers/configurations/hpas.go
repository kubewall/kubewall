package configurations

import (
	"encoding/base64"
	"fmt"
	"net/http"

	"kubewall-backend/internal/api/utils"
	"kubewall-backend/internal/k8s"
	"kubewall-backend/internal/storage"
	"kubewall-backend/pkg/logger"

	"github.com/gin-gonic/gin"
	"gopkg.in/yaml.v3"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/client-go/kubernetes"
)

// HPAsHandler handles HorizontalPodAutoscaler-related API requests
type HPAsHandler struct {
	store         *storage.KubeConfigStore
	clientFactory *k8s.ClientFactory
	logger        *logger.Logger
	sseHandler    *utils.SSEHandler
	yamlHandler   *utils.YAMLHandler
	eventsHandler *utils.EventsHandler
}

// NewHPAsHandler creates a new HPAsHandler
func NewHPAsHandler(store *storage.KubeConfigStore, clientFactory *k8s.ClientFactory, log *logger.Logger) *HPAsHandler {
	return &HPAsHandler{
		store:         store,
		clientFactory: clientFactory,
		logger:        log,
		sseHandler:    utils.NewSSEHandler(log),
		yamlHandler:   utils.NewYAMLHandler(log),
		eventsHandler: utils.NewEventsHandler(log),
	}
}

// getClientAndConfig gets the Kubernetes client and config for the given config ID and cluster
func (h *HPAsHandler) getClientAndConfig(c *gin.Context) (*kubernetes.Clientset, error) {
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

// GetHPA returns a specific HPA
func (h *HPAsHandler) GetHPA(c *gin.Context) {
	client, err := h.getClientAndConfig(c)
	if err != nil {
		h.logger.WithError(err).Error("Failed to get client for HPA")
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	namespace := c.Param("namespace")
	name := c.Param("name")
	hpa, err := client.AutoscalingV2().HorizontalPodAutoscalers(namespace).Get(c.Request.Context(), name, metav1.GetOptions{})
	if err != nil {
		h.logger.WithError(err).WithField("hpa", name).WithField("namespace", namespace).Error("Failed to get HPA")
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	// Check if this is an SSE request (EventSource expects SSE format)
	acceptHeader := c.GetHeader("Accept")
	if acceptHeader == "text/event-stream" {
		h.sseHandler.SendSSEResponse(c, hpa)
		return
	}

	c.JSON(http.StatusOK, hpa)
}

// GetHPAByName returns a specific HPA by name using namespace from query parameters
func (h *HPAsHandler) GetHPAByName(c *gin.Context) {
	client, err := h.getClientAndConfig(c)
	if err != nil {
		h.logger.WithError(err).Error("Failed to get client for HPA")
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	name := c.Param("name")
	namespace := c.Query("namespace")

	if namespace == "" {
		h.logger.WithField("hpa", name).Error("Namespace is required for HPA lookup")
		c.JSON(http.StatusBadRequest, gin.H{"error": "namespace parameter is required"})
		return
	}

	hpa, err := client.AutoscalingV2().HorizontalPodAutoscalers(namespace).Get(c.Request.Context(), name, metav1.GetOptions{})
	if err != nil {
		h.logger.WithError(err).WithField("hpa", name).WithField("namespace", namespace).Error("Failed to get HPA")
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	// Check if this is an SSE request (EventSource expects SSE format)
	acceptHeader := c.GetHeader("Accept")
	if acceptHeader == "text/event-stream" {
		h.sseHandler.SendSSEResponse(c, hpa)
		return
	}

	c.JSON(http.StatusOK, hpa)
}

// GetHPAYAMLByName returns the YAML representation of a specific HPA by name using namespace from query parameters
func (h *HPAsHandler) GetHPAYAMLByName(c *gin.Context) {
	client, err := h.getClientAndConfig(c)
	if err != nil {
		h.logger.WithError(err).Error("Failed to get client for HPA YAML")
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	name := c.Param("name")
	namespace := c.Query("namespace")

	if namespace == "" {
		h.logger.WithField("hpa", name).Error("Namespace is required for HPA YAML lookup")
		c.JSON(http.StatusBadRequest, gin.H{"error": "namespace parameter is required"})
		return
	}

	hpa, err := client.AutoscalingV2().HorizontalPodAutoscalers(namespace).Get(c.Request.Context(), name, metav1.GetOptions{})
	if err != nil {
		h.logger.WithError(err).WithField("hpa", name).WithField("namespace", namespace).Error("Failed to get HPA for YAML")
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	// Convert to YAML
	yamlData, err := yaml.Marshal(hpa)
	if err != nil {
		h.logger.WithError(err).Error("Failed to marshal HPA to YAML")
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

// GetHPAYAML returns the YAML representation of a specific HPA
func (h *HPAsHandler) GetHPAYAML(c *gin.Context) {
	client, err := h.getClientAndConfig(c)
	if err != nil {
		h.logger.WithError(err).Error("Failed to get client for HPA YAML")
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	namespace := c.Param("namespace")
	name := c.Param("name")
	hpa, err := client.AutoscalingV2().HorizontalPodAutoscalers(namespace).Get(c.Request.Context(), name, metav1.GetOptions{})
	if err != nil {
		h.logger.WithError(err).WithField("hpa", name).WithField("namespace", namespace).Error("Failed to get HPA for YAML")
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	// Convert to YAML
	yamlData, err := yaml.Marshal(hpa)
	if err != nil {
		h.logger.WithError(err).Error("Failed to marshal HPA to YAML")
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

// GetHPAEventsByName returns events for a specific HPA by name using namespace from query parameters
func (h *HPAsHandler) GetHPAEventsByName(c *gin.Context) {
	name := c.Param("name")
	namespace := c.Query("namespace")

	if namespace == "" {
		h.logger.WithField("hpa", name).Error("Namespace is required for HPA events lookup")
		c.JSON(http.StatusBadRequest, gin.H{"error": "namespace parameter is required"})
		return
	}

	client, err := h.getClientAndConfig(c)
	if err != nil {
		h.logger.WithError(err).Error("Failed to get client for HPA events")
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	h.eventsHandler.GetResourceEventsWithNamespace(c, client, "HorizontalPodAutoscaler", name, namespace, h.sseHandler.SendSSEResponse)
}

// GetHPAEvents returns events for a specific HPA
func (h *HPAsHandler) GetHPAEvents(c *gin.Context) {
	name := c.Param("name")
	namespace := c.Param("namespace")

	client, err := h.getClientAndConfig(c)
	if err != nil {
		h.logger.WithError(err).Error("Failed to get client for HPA events")
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	h.eventsHandler.GetResourceEventsWithNamespace(c, client, "HorizontalPodAutoscaler", name, namespace, h.sseHandler.SendSSEResponse)
}
