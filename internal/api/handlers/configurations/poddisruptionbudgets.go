package configurations

import (
	"context"
	"fmt"
	"net/http"
	"time"

	"github.com/Facets-cloud/kube-dash/internal/api/transformers"
	"github.com/Facets-cloud/kube-dash/internal/api/types"
	"github.com/Facets-cloud/kube-dash/internal/api/utils"
	"github.com/Facets-cloud/kube-dash/internal/k8s"
	"github.com/Facets-cloud/kube-dash/internal/storage"
	"github.com/Facets-cloud/kube-dash/internal/tracing"
	"github.com/Facets-cloud/kube-dash/pkg/logger"

	"github.com/gin-gonic/gin"
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
	tracingHelper *tracing.TracingHelper
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
		tracingHelper: tracing.GetTracingHelper(),
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
// @Summary Get all Pod Disruption Budgets in a namespace
// @Description Retrieves all Pod Disruption Budgets in the specified namespace with transformed response format
// @Tags PodDisruptionBudgets
// @Accept json
// @Produce json
// @Param config query string true "Kubernetes config ID"
// @Param cluster query string false "Cluster name"
// @Param namespace query string true "Namespace name"
// @Success 200 {array} types.PodDisruptionBudgetListResponse "List of transformed Pod Disruption Budgets"
// @Failure 400 {object} map[string]string "Bad request"
// @Failure 500 {object} map[string]string "Internal server error"
// @Security BearerAuth
// @Security KubeConfig
// @Router /api/v1/poddisruptionbudgets [get]
func (h *PodDisruptionBudgetsHandler) GetPodDisruptionBudgets(c *gin.Context) {
	// Start child span for client setup
	ctx, clientSpan := h.tracingHelper.StartAuthSpan(c.Request.Context(), "get-client-config")
	defer clientSpan.End()

	client, err := h.getClientAndConfig(c)
	if err != nil {
		h.logger.WithError(err).Error("Failed to get client for pod disruption budgets")
		h.tracingHelper.RecordError(clientSpan, err, "Failed to get Kubernetes client")
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	h.tracingHelper.RecordSuccess(clientSpan, "Client setup completed")

	namespace := c.Query("namespace")

	// Start child span for Kubernetes API call
	_, k8sSpan := h.tracingHelper.StartKubernetesAPISpan(ctx, "list", "poddisruptionbudgets", namespace)
	defer k8sSpan.End()

	podDisruptionBudgetList, err := client.PolicyV1().PodDisruptionBudgets(namespace).List(ctx, metav1.ListOptions{})
	if err != nil {
		h.logger.WithError(err).Error("Failed to list pod disruption budgets")
		h.tracingHelper.RecordError(k8sSpan, err, "Failed to list pod disruption budgets")
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	h.tracingHelper.RecordSuccess(k8sSpan, "Successfully listed pod disruption budgets")
	h.tracingHelper.AddResourceAttributes(k8sSpan, "poddisruptionbudgets", "poddisruptionbudget", len(podDisruptionBudgetList.Items))

	// Start child span for data processing
	_, processSpan := h.tracingHelper.StartDataProcessingSpan(ctx, "transform-poddisruptionbudgets")
	defer processSpan.End()

	// Transform pod disruption budgets to the expected format
	var transformedPodDisruptionBudgets []types.PodDisruptionBudgetListResponse
	for _, pdb := range podDisruptionBudgetList.Items {
		transformedPodDisruptionBudgets = append(transformedPodDisruptionBudgets, transformers.TransformPodDisruptionBudgetToResponse(&pdb))
	}
	h.tracingHelper.RecordSuccess(processSpan, "Successfully transformed pod disruption budgets")
	h.tracingHelper.AddResourceAttributes(processSpan, "transformed-poddisruptionbudgets", "poddisruptionbudget", len(transformedPodDisruptionBudgets))

	c.JSON(http.StatusOK, transformedPodDisruptionBudgets)
}

// GetPodDisruptionBudgetsSSE returns pod disruption budgets as Server-Sent Events with real-time updates
// @Summary Get Pod Disruption Budgets with real-time updates
// @Description Retrieves Pod Disruption Budgets in the specified namespace with Server-Sent Events for real-time updates
// @Tags PodDisruptionBudgets
// @Accept json
// @Produce text/event-stream
// @Produce json
// @Param config query string true "Kubernetes config ID"
// @Param cluster query string false "Cluster name"
// @Param namespace query string true "Namespace name"
// @Success 200 {array} types.PodDisruptionBudgetListResponse "Stream of transformed Pod Disruption Budgets or JSON array"
// @Failure 400 {object} map[string]string "Bad request"
// @Failure 500 {object} map[string]string "Internal server error"
// @Security BearerAuth
// @Security KubeConfig
// @Router /api/v1/poddisruptionbudgets/sse [get]
func (h *PodDisruptionBudgetsHandler) GetPodDisruptionBudgetsSSE(c *gin.Context) {
	// Start child span for client setup
	ctx, clientSpan := h.tracingHelper.StartAuthSpan(c.Request.Context(), "setup-client-for-sse")
	defer clientSpan.End()

	client, err := h.getClientAndConfig(c)
	if err != nil {
		h.logger.WithError(err).Error("Failed to get client for pod disruption budgets SSE")
		h.tracingHelper.RecordError(clientSpan, err, "Failed to get client for pod disruption budgets SSE")
		h.sseHandler.SendSSEError(c, http.StatusBadRequest, err.Error())
		return
	}
	h.tracingHelper.RecordSuccess(clientSpan, "Client setup completed for pod disruption budgets SSE")

	namespace := c.Query("namespace")

	// Function to fetch and transform pod disruption budgets data
	fetchPodDisruptionBudgets := func() (interface{}, error) {
		// Start child span for data fetching
		_, fetchSpan := h.tracingHelper.StartKubernetesAPISpan(ctx, "list", "poddisruptionbudgets", namespace)
		defer fetchSpan.End()

		// Use context.Background() with timeout instead of request context to avoid cancellation
		fetchCtx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
		defer cancel()

		podDisruptionBudgetList, err := client.PolicyV1().PodDisruptionBudgets(namespace).List(fetchCtx, metav1.ListOptions{})
		if err != nil {
			h.tracingHelper.RecordError(fetchSpan, err, "Failed to fetch pod disruption budgets for SSE")
			return nil, err
		}
		h.tracingHelper.RecordSuccess(fetchSpan, "Successfully fetched pod disruption budgets for SSE")
		h.tracingHelper.AddResourceAttributes(fetchSpan, "poddisruptionbudgets", "poddisruptionbudget", len(podDisruptionBudgetList.Items))

		// Start child span for data transformation
		_, transformSpan := h.tracingHelper.StartDataProcessingSpan(ctx, "transform-poddisruptionbudgets-sse")
		defer transformSpan.End()

		// Transform pod disruption budgets to the expected format
		var transformedPodDisruptionBudgets []types.PodDisruptionBudgetListResponse
		for _, pdb := range podDisruptionBudgetList.Items {
			transformedPodDisruptionBudgets = append(transformedPodDisruptionBudgets, transformers.TransformPodDisruptionBudgetToResponse(&pdb))
		}
		h.tracingHelper.RecordSuccess(transformSpan, "Successfully transformed pod disruption budgets for SSE")
		h.tracingHelper.AddResourceAttributes(transformSpan, "transformed-poddisruptionbudgets", "poddisruptionbudget", len(transformedPodDisruptionBudgets))

		return transformedPodDisruptionBudgets, nil
	}

	// Get initial data
	initialData, err := fetchPodDisruptionBudgets()
	if err != nil {
		h.logger.WithError(err).Error("Failed to list pod disruption budgets for SSE")
		// Check if this is a permission error
		if utils.IsPermissionError(err) {
			h.sseHandler.SendSSEPermissionError(c, err)
		} else {
			h.sseHandler.SendSSEError(c, http.StatusInternalServerError, err.Error())
		}
		return
	}

	// Send SSE response with periodic updates
	h.sseHandler.SendSSEResponseWithUpdates(c, initialData, fetchPodDisruptionBudgets)
}

// GetPodDisruptionBudget returns a specific pod disruption budget
// @Summary Get a specific Pod Disruption Budget
// @Description Retrieves a specific Pod Disruption Budget by name and namespace
// @Tags PodDisruptionBudgets
// @Accept json
// @Produce json
// @Produce text/event-stream
// @Param config query string true "Kubernetes config ID"
// @Param cluster query string false "Cluster name"
// @Param namespace path string true "Namespace name"
// @Param name path string true "Pod Disruption Budget name"
// @Success 200 {object} map[string]interface{} "Pod Disruption Budget details"
// @Failure 400 {object} map[string]string "Bad request"
// @Failure 404 {object} map[string]string "Pod Disruption Budget not found"
// @Security BearerAuth
// @Security KubeConfig
// @Router /api/v1/poddisruptionbudgets/{namespace}/{name} [get]
func (h *PodDisruptionBudgetsHandler) GetPodDisruptionBudget(c *gin.Context) {
	// Start child span for client setup
	ctx, clientSpan := h.tracingHelper.StartAuthSpan(c.Request.Context(), "get-client-config")
	defer clientSpan.End()

	client, err := h.getClientAndConfig(c)
	if err != nil {
		h.logger.WithError(err).Error("Failed to get client for pod disruption budget")
		h.tracingHelper.RecordError(clientSpan, err, "Failed to get Kubernetes client")
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	h.tracingHelper.RecordSuccess(clientSpan, "Client setup completed")

	namespace := c.Param("namespace")
	name := c.Param("name")

	// Start child span for Kubernetes API call
	_, k8sSpan := h.tracingHelper.StartKubernetesAPISpan(ctx, "get", "poddisruptionbudget", namespace)
	defer k8sSpan.End()

	podDisruptionBudget, err := client.PolicyV1().PodDisruptionBudgets(namespace).Get(ctx, name, metav1.GetOptions{})
	if err != nil {
		h.logger.WithError(err).WithField("poddisruptionbudget", name).WithField("namespace", namespace).Error("Failed to get pod disruption budget")
		h.tracingHelper.RecordError(k8sSpan, err, "Failed to get pod disruption budget")
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}
	h.tracingHelper.RecordSuccess(k8sSpan, "Successfully retrieved pod disruption budget")
	h.tracingHelper.AddResourceAttributes(k8sSpan, name, "poddisruptionbudget", 1)

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
	// Start child span for client setup
	ctx, clientSpan := h.tracingHelper.StartAuthSpan(c.Request.Context(), "get-client-config")
	defer clientSpan.End()

	client, err := h.getClientAndConfig(c)
	if err != nil {
		h.logger.WithError(err).Error("Failed to get client for pod disruption budget")
		h.tracingHelper.RecordError(clientSpan, err, "Failed to get Kubernetes client")
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	name := c.Param("name")
	namespace := c.Query("namespace")

	if namespace == "" {
		h.logger.WithField("poddisruptionbudget", name).Error("Namespace is required for pod disruption budget lookup")
		h.tracingHelper.RecordError(clientSpan, fmt.Errorf("namespace parameter is required"), "Namespace parameter is required")
		c.JSON(http.StatusBadRequest, gin.H{"error": "namespace parameter is required"})
		return
	}
	h.tracingHelper.RecordSuccess(clientSpan, "Client setup completed")

	// Start child span for Kubernetes API call
	_, k8sSpan := h.tracingHelper.StartKubernetesAPISpan(ctx, "get", "poddisruptionbudget", namespace)
	defer k8sSpan.End()

	podDisruptionBudget, err := client.PolicyV1().PodDisruptionBudgets(namespace).Get(ctx, name, metav1.GetOptions{})
	if err != nil {
		h.logger.WithError(err).WithField("poddisruptionbudget", name).WithField("namespace", namespace).Error("Failed to get pod disruption budget")
		h.tracingHelper.RecordError(k8sSpan, err, "Failed to get pod disruption budget")
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}
	h.tracingHelper.RecordSuccess(k8sSpan, "Successfully retrieved pod disruption budget")
	h.tracingHelper.AddResourceAttributes(k8sSpan, name, "poddisruptionbudget", 1)

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
	// Start child span for client setup
	ctx, clientSpan := h.tracingHelper.StartAuthSpan(c.Request.Context(), "get-client-config")
	defer clientSpan.End()

	client, err := h.getClientAndConfig(c)
	if err != nil {
		h.logger.WithError(err).Error("Failed to get client for pod disruption budget YAML")
		h.tracingHelper.RecordError(clientSpan, err, "Failed to get Kubernetes client")
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	name := c.Param("name")
	namespace := c.Query("namespace")

	if namespace == "" {
		h.logger.WithField("poddisruptionbudget", name).Error("Namespace is required for pod disruption budget YAML lookup")
		h.tracingHelper.RecordError(clientSpan, fmt.Errorf("namespace parameter is required"), "Namespace parameter is required")
		c.JSON(http.StatusBadRequest, gin.H{"error": "namespace parameter is required"})
		return
	}
	h.tracingHelper.RecordSuccess(clientSpan, "Client setup completed")

	// Start child span for Kubernetes API call
	_, k8sSpan := h.tracingHelper.StartKubernetesAPISpan(ctx, "get", "poddisruptionbudget", namespace)
	defer k8sSpan.End()

	podDisruptionBudget, err := client.PolicyV1().PodDisruptionBudgets(namespace).Get(ctx, name, metav1.GetOptions{})
	if err != nil {
		h.logger.WithError(err).WithField("poddisruptionbudget", name).WithField("namespace", namespace).Error("Failed to get pod disruption budget for YAML")
		h.tracingHelper.RecordError(k8sSpan, err, "Failed to get pod disruption budget for YAML")
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}
	h.tracingHelper.RecordSuccess(k8sSpan, "Successfully retrieved pod disruption budget for YAML")
	h.tracingHelper.AddResourceAttributes(k8sSpan, name, "poddisruptionbudget", 1)

	// Start child span for YAML generation
	_, yamlSpan := h.tracingHelper.StartDataProcessingSpan(ctx, "generate-yaml")
	defer yamlSpan.End()

	h.yamlHandler.SendYAMLResponse(c, podDisruptionBudget, name)
	h.tracingHelper.RecordSuccess(yamlSpan, "Successfully generated YAML response")
}

// GetPodDisruptionBudgetYAML returns the YAML representation of a specific pod disruption budget
func (h *PodDisruptionBudgetsHandler) GetPodDisruptionBudgetYAML(c *gin.Context) {
	// Start child span for client setup
	ctx, clientSpan := h.tracingHelper.StartAuthSpan(c.Request.Context(), "get-client-config")
	defer clientSpan.End()

	client, err := h.getClientAndConfig(c)
	if err != nil {
		h.logger.WithError(err).Error("Failed to get client for pod disruption budget YAML")
		h.tracingHelper.RecordError(clientSpan, err, "Failed to get Kubernetes client")
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	h.tracingHelper.RecordSuccess(clientSpan, "Client setup completed")

	namespace := c.Param("namespace")
	name := c.Param("name")

	// Start child span for Kubernetes API call
	_, k8sSpan := h.tracingHelper.StartKubernetesAPISpan(ctx, "get", "poddisruptionbudget", namespace)
	defer k8sSpan.End()

	podDisruptionBudget, err := client.PolicyV1().PodDisruptionBudgets(namespace).Get(ctx, name, metav1.GetOptions{})
	if err != nil {
		h.logger.WithError(err).WithField("poddisruptionbudget", name).WithField("namespace", namespace).Error("Failed to get pod disruption budget for YAML")
		h.tracingHelper.RecordError(k8sSpan, err, "Failed to get pod disruption budget for YAML")
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}
	h.tracingHelper.RecordSuccess(k8sSpan, "Successfully retrieved pod disruption budget for YAML")
	h.tracingHelper.AddResourceAttributes(k8sSpan, name, "poddisruptionbudget", 1)

	// Start child span for YAML generation
	_, yamlSpan := h.tracingHelper.StartDataProcessingSpan(ctx, "generate-yaml")
	defer yamlSpan.End()

	h.yamlHandler.SendYAMLResponse(c, podDisruptionBudget, name)
	h.tracingHelper.RecordSuccess(yamlSpan, "Successfully generated YAML response")
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

	// Start child span for client setup
	ctx, clientSpan := h.tracingHelper.StartAuthSpan(c.Request.Context(), "get-client-config")
	defer clientSpan.End()

	client, err := h.getClientAndConfig(c)
	if err != nil {
		h.logger.WithError(err).Error("Failed to get client for pod disruption budget events")
		h.tracingHelper.RecordError(clientSpan, err, "Failed to get Kubernetes client")
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	h.tracingHelper.RecordSuccess(clientSpan, "Client setup completed")

	// Start child span for events retrieval
	_, eventsSpan := h.tracingHelper.StartKubernetesAPISpan(ctx, "list", "events", namespace)
	defer eventsSpan.End()

	h.eventsHandler.GetResourceEventsWithNamespace(c, client, "PodDisruptionBudget", name, namespace, h.sseHandler.SendSSEResponse)
	h.tracingHelper.RecordSuccess(eventsSpan, "Successfully retrieved pod disruption budget events")
	h.tracingHelper.AddResourceAttributes(eventsSpan, name, "poddisruptionbudget-events", 1)
}

// GetPodDisruptionBudgetEvents returns events for a specific pod disruption budget
func (h *PodDisruptionBudgetsHandler) GetPodDisruptionBudgetEvents(c *gin.Context) {
	name := c.Param("name")
	namespace := c.Param("namespace")

	// Start child span for client setup
	ctx, clientSpan := h.tracingHelper.StartAuthSpan(c.Request.Context(), "get-client-config")
	defer clientSpan.End()

	client, err := h.getClientAndConfig(c)
	if err != nil {
		h.logger.WithError(err).Error("Failed to get client for pod disruption budget events")
		h.tracingHelper.RecordError(clientSpan, err, "Failed to get Kubernetes client")
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	h.tracingHelper.RecordSuccess(clientSpan, "Client setup completed")

	// Start child span for events retrieval
	_, eventsSpan := h.tracingHelper.StartKubernetesAPISpan(ctx, "list", "events", namespace)
	defer eventsSpan.End()

	h.eventsHandler.GetResourceEventsWithNamespace(c, client, "PodDisruptionBudget", name, namespace, h.sseHandler.SendSSEResponse)
	h.tracingHelper.RecordSuccess(eventsSpan, "Successfully retrieved pod disruption budget events")
	h.tracingHelper.AddResourceAttributes(eventsSpan, name, "poddisruptionbudget-events", 1)
}
