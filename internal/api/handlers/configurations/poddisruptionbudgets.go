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

// PodDisruptionBudgetsHandler handles PodDisruptionBudget-related API requests
type PodDisruptionBudgetsHandler struct {
	store         *storage.KubeConfigStore
	clientFactory *k8s.ClientFactory
	logger        *logger.Logger
	sseHandler    *utils.SSEHandler
	yamlHandler   *utils.YAMLHandler
	eventsHandler *utils.EventsHandler
}

// NewPodDisruptionBudgetsHandler creates a new PodDisruptionBudgetsHandler
func NewPodDisruptionBudgetsHandler(store *storage.KubeConfigStore, clientFactory *k8s.ClientFactory, log *logger.Logger) *PodDisruptionBudgetsHandler {
	return &PodDisruptionBudgetsHandler{
		store:         store,
		clientFactory: clientFactory,
		logger:        log,
		sseHandler:    utils.NewSSEHandler(log),
		yamlHandler:   utils.NewYAMLHandler(log),
		eventsHandler: utils.NewEventsHandler(log),
	}
}

// getClientAndConfig gets the Kubernetes client and config for the given config ID and cluster
func (h *PodDisruptionBudgetsHandler) getClientAndConfig(c *gin.Context) (*kubernetes.Clientset, error) {
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

// GetPodDisruptionBudgets returns all pod disruption budgets in a namespace
func (h *PodDisruptionBudgetsHandler) GetPodDisruptionBudgets(c *gin.Context) {
	client, err := h.getClientAndConfig(c)
	if err != nil {
		h.logger.WithError(err).Error("Failed to get client for pod disruption budgets")
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	namespace := c.Query("namespace")
	podDisruptionBudgetList, err := client.PolicyV1().PodDisruptionBudgets(namespace).List(c.Request.Context(), metav1.ListOptions{})
	if err != nil {
		h.logger.WithError(err).Error("Failed to list pod disruption budgets")
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	// Transform pod disruption budgets to the expected format
	var transformedPodDisruptionBudgets []types.PodDisruptionBudgetListResponse
	for _, pdb := range podDisruptionBudgetList.Items {
		transformedPodDisruptionBudgets = append(transformedPodDisruptionBudgets, transformers.TransformPodDisruptionBudgetToResponse(&pdb))
	}

	c.JSON(http.StatusOK, transformedPodDisruptionBudgets)
}

// GetPodDisruptionBudgetsSSE returns pod disruption budgets as Server-Sent Events with real-time updates
func (h *PodDisruptionBudgetsHandler) GetPodDisruptionBudgetsSSE(c *gin.Context) {
	client, err := h.getClientAndConfig(c)
	if err != nil {
		h.logger.WithError(err).Error("Failed to get client for pod disruption budgets SSE")
		h.sseHandler.SendSSEError(c, http.StatusBadRequest, err.Error())
		return
	}

	namespace := c.Query("namespace")

	// Function to fetch and transform pod disruption budgets data
	fetchPodDisruptionBudgets := func() (interface{}, error) {
		podDisruptionBudgetList, err := client.PolicyV1().PodDisruptionBudgets(namespace).List(c.Request.Context(), metav1.ListOptions{})
		if err != nil {
			return nil, err
		}

		// Transform pod disruption budgets to the expected format
		var transformedPodDisruptionBudgets []types.PodDisruptionBudgetListResponse
		for _, pdb := range podDisruptionBudgetList.Items {
			transformedPodDisruptionBudgets = append(transformedPodDisruptionBudgets, transformers.TransformPodDisruptionBudgetToResponse(&pdb))
		}

		return transformedPodDisruptionBudgets, nil
	}

	// Get initial data
	initialData, err := fetchPodDisruptionBudgets()
	if err != nil {
		h.logger.WithError(err).Error("Failed to list pod disruption budgets for SSE")
		h.sseHandler.SendSSEError(c, http.StatusInternalServerError, err.Error())
		return
	}

	// Send SSE response with periodic updates
	h.sseHandler.SendSSEResponseWithUpdates(c, initialData, fetchPodDisruptionBudgets)
}

// GetPodDisruptionBudget returns a specific pod disruption budget
func (h *PodDisruptionBudgetsHandler) GetPodDisruptionBudget(c *gin.Context) {
	client, err := h.getClientAndConfig(c)
	if err != nil {
		h.logger.WithError(err).Error("Failed to get client for pod disruption budget")
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	namespace := c.Param("namespace")
	name := c.Param("name")
	podDisruptionBudget, err := client.PolicyV1().PodDisruptionBudgets(namespace).Get(c.Request.Context(), name, metav1.GetOptions{})
	if err != nil {
		h.logger.WithError(err).WithField("poddisruptionbudget", name).WithField("namespace", namespace).Error("Failed to get pod disruption budget")
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	// Check if this is an SSE request (EventSource expects SSE format)
	acceptHeader := c.GetHeader("Accept")
	if acceptHeader == "text/event-stream" {
		h.sseHandler.SendSSEResponse(c, podDisruptionBudget)
		return
	}

	c.JSON(http.StatusOK, podDisruptionBudget)
}

// GetPodDisruptionBudgetByName returns a specific pod disruption budget by name using namespace from query parameters
func (h *PodDisruptionBudgetsHandler) GetPodDisruptionBudgetByName(c *gin.Context) {
	client, err := h.getClientAndConfig(c)
	if err != nil {
		h.logger.WithError(err).Error("Failed to get client for pod disruption budget")
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	name := c.Param("name")
	namespace := c.Query("namespace")

	if namespace == "" {
		h.logger.WithField("poddisruptionbudget", name).Error("Namespace is required for pod disruption budget lookup")
		c.JSON(http.StatusBadRequest, gin.H{"error": "namespace parameter is required"})
		return
	}

	podDisruptionBudget, err := client.PolicyV1().PodDisruptionBudgets(namespace).Get(c.Request.Context(), name, metav1.GetOptions{})
	if err != nil {
		h.logger.WithError(err).WithField("poddisruptionbudget", name).WithField("namespace", namespace).Error("Failed to get pod disruption budget")
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	// Check if this is an SSE request (EventSource expects SSE format)
	acceptHeader := c.GetHeader("Accept")
	if acceptHeader == "text/event-stream" {
		h.sseHandler.SendSSEResponse(c, podDisruptionBudget)
		return
	}

	c.JSON(http.StatusOK, podDisruptionBudget)
}

// GetPodDisruptionBudgetYAMLByName returns the YAML representation of a specific pod disruption budget by name using namespace from query parameters
func (h *PodDisruptionBudgetsHandler) GetPodDisruptionBudgetYAMLByName(c *gin.Context) {
	client, err := h.getClientAndConfig(c)
	if err != nil {
		h.logger.WithError(err).Error("Failed to get client for pod disruption budget YAML")
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	name := c.Param("name")
	namespace := c.Query("namespace")

	if namespace == "" {
		h.logger.WithField("poddisruptionbudget", name).Error("Namespace is required for pod disruption budget YAML lookup")
		c.JSON(http.StatusBadRequest, gin.H{"error": "namespace parameter is required"})
		return
	}

	podDisruptionBudget, err := client.PolicyV1().PodDisruptionBudgets(namespace).Get(c.Request.Context(), name, metav1.GetOptions{})
	if err != nil {
		h.logger.WithError(err).WithField("poddisruptionbudget", name).WithField("namespace", namespace).Error("Failed to get pod disruption budget for YAML")
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	// Convert to YAML
	yamlData, err := yaml.Marshal(podDisruptionBudget)
	if err != nil {
		h.logger.WithError(err).Error("Failed to marshal pod disruption budget to YAML")
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

// GetPodDisruptionBudgetYAML returns the YAML representation of a specific pod disruption budget
func (h *PodDisruptionBudgetsHandler) GetPodDisruptionBudgetYAML(c *gin.Context) {
	client, err := h.getClientAndConfig(c)
	if err != nil {
		h.logger.WithError(err).Error("Failed to get client for pod disruption budget YAML")
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	namespace := c.Param("namespace")
	name := c.Param("name")
	podDisruptionBudget, err := client.PolicyV1().PodDisruptionBudgets(namespace).Get(c.Request.Context(), name, metav1.GetOptions{})
	if err != nil {
		h.logger.WithError(err).WithField("poddisruptionbudget", name).WithField("namespace", namespace).Error("Failed to get pod disruption budget for YAML")
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	// Convert to YAML
	yamlData, err := yaml.Marshal(podDisruptionBudget)
	if err != nil {
		h.logger.WithError(err).Error("Failed to marshal pod disruption budget to YAML")
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

// GetPodDisruptionBudgetEventsByName returns events for a specific pod disruption budget by name using namespace from query parameters
func (h *PodDisruptionBudgetsHandler) GetPodDisruptionBudgetEventsByName(c *gin.Context) {
	name := c.Param("name")
	namespace := c.Query("namespace")

	if namespace == "" {
		h.logger.WithField("poddisruptionbudget", name).Error("Namespace is required for pod disruption budget events lookup")
		c.JSON(http.StatusBadRequest, gin.H{"error": "namespace parameter is required"})
		return
	}

	client, err := h.getClientAndConfig(c)
	if err != nil {
		h.logger.WithError(err).Error("Failed to get client for pod disruption budget events")
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	h.eventsHandler.GetResourceEventsWithNamespace(c, client, "PodDisruptionBudget", name, namespace, h.sseHandler.SendSSEResponse)
}

// GetPodDisruptionBudgetEvents returns events for a specific pod disruption budget
func (h *PodDisruptionBudgetsHandler) GetPodDisruptionBudgetEvents(c *gin.Context) {
	name := c.Param("name")
	namespace := c.Param("namespace")

	client, err := h.getClientAndConfig(c)
	if err != nil {
		h.logger.WithError(err).Error("Failed to get client for pod disruption budget events")
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	h.eventsHandler.GetResourceEventsWithNamespace(c, client, "PodDisruptionBudget", name, namespace, h.sseHandler.SendSSEResponse)
}
