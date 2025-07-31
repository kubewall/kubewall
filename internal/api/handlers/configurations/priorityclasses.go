package configurations

import (
	"fmt"
	"net/http"

	"kubewall-backend/internal/api/transformers"
	"kubewall-backend/internal/api/types"
	"kubewall-backend/internal/api/utils"
	"kubewall-backend/internal/k8s"
	"kubewall-backend/internal/storage"
	"kubewall-backend/pkg/logger"

	"github.com/gin-gonic/gin"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/client-go/kubernetes"
)

// PriorityClassesHandler handles PriorityClass-related API requests
type PriorityClassesHandler struct {
	store         *storage.KubeConfigStore
	clientFactory *k8s.ClientFactory
	logger        *logger.Logger
	sseHandler    *utils.SSEHandler
	yamlHandler   *utils.YAMLHandler
	eventsHandler *utils.EventsHandler
}

// NewPriorityClassesHandler creates a new PriorityClassesHandler
func NewPriorityClassesHandler(store *storage.KubeConfigStore, clientFactory *k8s.ClientFactory, log *logger.Logger) *PriorityClassesHandler {
	return &PriorityClassesHandler{
		store:         store,
		clientFactory: clientFactory,
		logger:        log,
		sseHandler:    utils.NewSSEHandler(log),
		yamlHandler:   utils.NewYAMLHandler(log),
		eventsHandler: utils.NewEventsHandler(log),
	}
}

// getClientAndConfig gets the Kubernetes client and config for the given config ID and cluster
func (h *PriorityClassesHandler) getClientAndConfig(c *gin.Context) (*kubernetes.Clientset, error) {
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

// GetPriorityClasses returns all priority classes
func (h *PriorityClassesHandler) GetPriorityClasses(c *gin.Context) {
	client, err := h.getClientAndConfig(c)
	if err != nil {
		h.logger.WithError(err).Error("Failed to get client for priority classes")
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	priorityClasses, err := client.SchedulingV1().PriorityClasses().List(c.Request.Context(), metav1.ListOptions{})
	if err != nil {
		h.logger.WithError(err).Error("Failed to list priority classes")
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, priorityClasses)
}

// GetPriorityClassesSSE returns priority classes as Server-Sent Events with real-time updates
func (h *PriorityClassesHandler) GetPriorityClassesSSE(c *gin.Context) {
	client, err := h.getClientAndConfig(c)
	if err != nil {
		h.logger.WithError(err).Error("Failed to get client for priority classes SSE")
		h.sseHandler.SendSSEError(c, http.StatusBadRequest, err.Error())
		return
	}

	// Function to fetch priority classes data
	fetchPriorityClasses := func() (interface{}, error) {
		priorityClassList, err := client.SchedulingV1().PriorityClasses().List(c.Request.Context(), metav1.ListOptions{})
		if err != nil {
			return nil, err
		}

		// Transform to response format
		var responses []types.PriorityClassListResponse
		for _, priorityClass := range priorityClassList.Items {
			response := transformers.TransformPriorityClassToResponse(&priorityClass)
			responses = append(responses, response)
		}

		return responses, nil
	}

	initialData, err := fetchPriorityClasses()
	if err != nil {
		h.logger.WithError(err).Error("Failed to list priority classes for SSE")
		// Check if this is a permission error
		if utils.IsPermissionError(err) {
			h.sseHandler.SendSSEPermissionError(c, err)
		} else {
			h.sseHandler.SendSSEError(c, http.StatusInternalServerError, err.Error())
		}
		return
	}

	h.sseHandler.SendSSEResponseWithUpdates(c, initialData, fetchPriorityClasses)
}

// GetPriorityClass returns a specific priority class
func (h *PriorityClassesHandler) GetPriorityClass(c *gin.Context) {
	client, err := h.getClientAndConfig(c)
	if err != nil {
		h.logger.WithError(err).Error("Failed to get client for priority class")
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	name := c.Param("name")
	if name == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "priority class name is required"})
		return
	}

	priorityClass, err := client.SchedulingV1().PriorityClasses().Get(c.Request.Context(), name, metav1.GetOptions{})
	if err != nil {
		h.logger.WithError(err).WithField("name", name).Error("Failed to get priority class")
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, priorityClass)
}

// GetPriorityClassByName returns a specific priority class by name
func (h *PriorityClassesHandler) GetPriorityClassByName(c *gin.Context) {
	client, err := h.getClientAndConfig(c)
	if err != nil {
		h.logger.WithError(err).Error("Failed to get client for priority class by name")
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	name := c.Param("name")
	if name == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "priority class name is required"})
		return
	}

	priorityClass, err := client.SchedulingV1().PriorityClasses().Get(c.Request.Context(), name, metav1.GetOptions{})
	if err != nil {
		h.logger.WithError(err).WithField("name", name).Error("Failed to get priority class by name")
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, priorityClass)
}

// GetPriorityClassYAMLByName returns the YAML representation of a specific priority class by name
func (h *PriorityClassesHandler) GetPriorityClassYAMLByName(c *gin.Context) {
	client, err := h.getClientAndConfig(c)
	if err != nil {
		h.logger.WithError(err).Error("Failed to get client for priority class YAML by name")
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	name := c.Param("name")
	if name == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "priority class name is required"})
		return
	}

	priorityClass, err := client.SchedulingV1().PriorityClasses().Get(c.Request.Context(), name, metav1.GetOptions{})
	if err != nil {
		h.logger.WithError(err).WithField("name", name).Error("Failed to get priority class for YAML by name")
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	h.yamlHandler.SendYAMLResponse(c, priorityClass, name)
}

// GetPriorityClassYAML returns the YAML representation of a specific priority class
func (h *PriorityClassesHandler) GetPriorityClassYAML(c *gin.Context) {
	client, err := h.getClientAndConfig(c)
	if err != nil {
		h.logger.WithError(err).Error("Failed to get client for priority class YAML")
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	name := c.Param("name")
	if name == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "priority class name is required"})
		return
	}

	priorityClass, err := client.SchedulingV1().PriorityClasses().Get(c.Request.Context(), name, metav1.GetOptions{})
	if err != nil {
		h.logger.WithError(err).WithField("name", name).Error("Failed to get priority class for YAML")
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	h.yamlHandler.SendYAMLResponse(c, priorityClass, name)
}

// GetPriorityClassEventsByName returns events for a specific priority class by name
func (h *PriorityClassesHandler) GetPriorityClassEventsByName(c *gin.Context) {
	client, err := h.getClientAndConfig(c)
	if err != nil {
		h.logger.WithError(err).Error("Failed to get client for priority class events by name")
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	name := c.Param("name")
	if name == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "priority class name is required"})
		return
	}

	h.eventsHandler.GetResourceEvents(c, client, "PriorityClass", name, h.sseHandler.SendSSEResponse)
}

// GetPriorityClassEvents returns events for a specific priority class
func (h *PriorityClassesHandler) GetPriorityClassEvents(c *gin.Context) {
	client, err := h.getClientAndConfig(c)
	if err != nil {
		h.logger.WithError(err).Error("Failed to get client for priority class events")
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	name := c.Param("name")
	if name == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "priority class name is required"})
		return
	}

	h.eventsHandler.GetResourceEvents(c, client, "PriorityClass", name, h.sseHandler.SendSSEResponse)
}
