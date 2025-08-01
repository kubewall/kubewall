package configurations

import (
	"fmt"
	"net/http"

	"github.com/Facets-cloud/kube-dash/internal/api/transformers"
	"github.com/Facets-cloud/kube-dash/internal/api/types"
	"github.com/Facets-cloud/kube-dash/internal/api/utils"
	"github.com/Facets-cloud/kube-dash/internal/k8s"
	"github.com/Facets-cloud/kube-dash/internal/storage"
	"github.com/Facets-cloud/kube-dash/pkg/logger"

	"github.com/gin-gonic/gin"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/client-go/kubernetes"
)

// RuntimeClassesHandler handles RuntimeClass-related API requests
type RuntimeClassesHandler struct {
	store         *storage.KubeConfigStore
	clientFactory *k8s.ClientFactory
	logger        *logger.Logger
	sseHandler    *utils.SSEHandler
	yamlHandler   *utils.YAMLHandler
	eventsHandler *utils.EventsHandler
}

// NewRuntimeClassesHandler creates a new RuntimeClassesHandler
func NewRuntimeClassesHandler(store *storage.KubeConfigStore, clientFactory *k8s.ClientFactory, log *logger.Logger) *RuntimeClassesHandler {
	return &RuntimeClassesHandler{
		store:         store,
		clientFactory: clientFactory,
		logger:        log,
		sseHandler:    utils.NewSSEHandler(log),
		yamlHandler:   utils.NewYAMLHandler(log),
		eventsHandler: utils.NewEventsHandler(log),
	}
}

// getClientAndConfig gets the Kubernetes client and config for the given config ID and cluster
func (h *RuntimeClassesHandler) getClientAndConfig(c *gin.Context) (*kubernetes.Clientset, error) {
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

// GetRuntimeClasses returns all runtime classes
func (h *RuntimeClassesHandler) GetRuntimeClasses(c *gin.Context) {
	client, err := h.getClientAndConfig(c)
	if err != nil {
		h.logger.WithError(err).Error("Failed to get client for runtime classes")
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	runtimeClasses, err := client.NodeV1().RuntimeClasses().List(c.Request.Context(), metav1.ListOptions{})
	if err != nil {
		h.logger.WithError(err).Error("Failed to list runtime classes")
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, runtimeClasses)
}

// GetRuntimeClassesSSE returns runtime classes as Server-Sent Events with real-time updates
func (h *RuntimeClassesHandler) GetRuntimeClassesSSE(c *gin.Context) {
	client, err := h.getClientAndConfig(c)
	if err != nil {
		h.logger.WithError(err).Error("Failed to get client for runtime classes SSE")
		h.sseHandler.SendSSEError(c, http.StatusBadRequest, err.Error())
		return
	}

	// Function to fetch runtime classes data
	fetchRuntimeClasses := func() (interface{}, error) {
		runtimeClassList, err := client.NodeV1().RuntimeClasses().List(c.Request.Context(), metav1.ListOptions{})
		if err != nil {
			return nil, err
		}

		// Transform to response format
		var responses []types.RuntimeClassListResponse
		for _, runtimeClass := range runtimeClassList.Items {
			response := transformers.TransformRuntimeClassToResponse(&runtimeClass)
			responses = append(responses, response)
		}

		// Always return a valid array, never nil
		if responses == nil {
			responses = []types.RuntimeClassListResponse{}
		}

		return responses, nil
	}

	initialData, err := fetchRuntimeClasses()
	if err != nil {
		h.logger.WithError(err).Error("Failed to list runtime classes for SSE")
		// Check if this is a permission error
		if utils.IsPermissionError(err) {
			h.sseHandler.SendSSEPermissionError(c, err)
		} else {
			h.sseHandler.SendSSEError(c, http.StatusInternalServerError, err.Error())
		}
		return
	}

	// Send initial empty array and then fetch data
	h.sseHandler.SendSSEResponseWithUpdates(c, initialData, fetchRuntimeClasses)
}

// GetRuntimeClass returns a specific runtime class
func (h *RuntimeClassesHandler) GetRuntimeClass(c *gin.Context) {
	client, err := h.getClientAndConfig(c)
	if err != nil {
		h.logger.WithError(err).Error("Failed to get client for runtime class")
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	name := c.Param("name")
	if name == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "runtime class name is required"})
		return
	}

	runtimeClass, err := client.NodeV1().RuntimeClasses().Get(c.Request.Context(), name, metav1.GetOptions{})
	if err != nil {
		h.logger.WithError(err).WithField("name", name).Error("Failed to get runtime class")
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, runtimeClass)
}

// GetRuntimeClassByName returns a specific runtime class by name
func (h *RuntimeClassesHandler) GetRuntimeClassByName(c *gin.Context) {
	client, err := h.getClientAndConfig(c)
	if err != nil {
		h.logger.WithError(err).Error("Failed to get client for runtime class by name")
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	name := c.Param("name")
	if name == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "runtime class name is required"})
		return
	}

	runtimeClass, err := client.NodeV1().RuntimeClasses().Get(c.Request.Context(), name, metav1.GetOptions{})
	if err != nil {
		h.logger.WithError(err).WithField("name", name).Error("Failed to get runtime class by name")
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, runtimeClass)
}

// GetRuntimeClassYAMLByName returns the YAML representation of a specific runtime class by name
func (h *RuntimeClassesHandler) GetRuntimeClassYAMLByName(c *gin.Context) {
	client, err := h.getClientAndConfig(c)
	if err != nil {
		h.logger.WithError(err).Error("Failed to get client for runtime class YAML by name")
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	name := c.Param("name")
	if name == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "runtime class name is required"})
		return
	}

	runtimeClass, err := client.NodeV1().RuntimeClasses().Get(c.Request.Context(), name, metav1.GetOptions{})
	if err != nil {
		h.logger.WithError(err).WithField("name", name).Error("Failed to get runtime class for YAML by name")
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	h.yamlHandler.SendYAMLResponse(c, runtimeClass, name)
}

// GetRuntimeClassYAML returns the YAML representation of a specific runtime class
func (h *RuntimeClassesHandler) GetRuntimeClassYAML(c *gin.Context) {
	client, err := h.getClientAndConfig(c)
	if err != nil {
		h.logger.WithError(err).Error("Failed to get client for runtime class YAML")
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	name := c.Param("name")
	if name == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "runtime class name is required"})
		return
	}

	runtimeClass, err := client.NodeV1().RuntimeClasses().Get(c.Request.Context(), name, metav1.GetOptions{})
	if err != nil {
		h.logger.WithError(err).WithField("name", name).Error("Failed to get runtime class for YAML")
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	h.yamlHandler.SendYAMLResponse(c, runtimeClass, name)
}

// GetRuntimeClassEventsByName returns events for a specific runtime class by name
func (h *RuntimeClassesHandler) GetRuntimeClassEventsByName(c *gin.Context) {
	client, err := h.getClientAndConfig(c)
	if err != nil {
		h.logger.WithError(err).Error("Failed to get client for runtime class events by name")
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	name := c.Param("name")
	if name == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "runtime class name is required"})
		return
	}

	h.eventsHandler.GetResourceEvents(c, client, "RuntimeClass", name, h.sseHandler.SendSSEResponse)
}

// GetRuntimeClassEvents returns events for a specific runtime class
func (h *RuntimeClassesHandler) GetRuntimeClassEvents(c *gin.Context) {
	client, err := h.getClientAndConfig(c)
	if err != nil {
		h.logger.WithError(err).Error("Failed to get client for runtime class events")
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	name := c.Param("name")
	if name == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "runtime class name is required"})
		return
	}

	h.eventsHandler.GetResourceEvents(c, client, "RuntimeClass", name, h.sseHandler.SendSSEResponse)
}
