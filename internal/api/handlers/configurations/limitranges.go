package configurations

import (
	"fmt"
	"net/http"

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

// LimitRangesHandler handles LimitRange-related API requests
type LimitRangesHandler struct {
	store         *storage.KubeConfigStore
	clientFactory *k8s.ClientFactory
	logger        *logger.Logger
	sseHandler    *utils.SSEHandler
	yamlHandler   *utils.YAMLHandler
	eventsHandler *utils.EventsHandler
	tracingHelper *tracing.TracingHelper
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
		tracingHelper: tracing.GetTracingHelper(),
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
	// Start client setup span
	_, clientSpan := h.tracingHelper.StartAuthSpan(c.Request.Context(), "get-client-config")
	defer clientSpan.End()
	client, err := h.getClientAndConfig(c)
	if err != nil {
		h.tracingHelper.RecordError(clientSpan, err, "Failed to get Kubernetes client")
		h.logger.WithError(err).Error("Failed to get client for limit ranges")
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	namespace := c.Query("namespace")
	h.tracingHelper.RecordSuccess(clientSpan, "Successfully obtained Kubernetes client")

	// Start Kubernetes API call span
	_, apiSpan := h.tracingHelper.StartKubernetesAPISpan(c.Request.Context(), "list", "limitranges", namespace)
	defer apiSpan.End()
	limitRangeList, err := client.CoreV1().LimitRanges(namespace).List(c.Request.Context(), metav1.ListOptions{})
	if err != nil {
		h.tracingHelper.RecordError(apiSpan, err, "Failed to list limit ranges")
		h.logger.WithError(err).Error("Failed to list limit ranges")
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	h.tracingHelper.RecordSuccess(apiSpan, "Successfully listed limit ranges")
	h.tracingHelper.AddResourceAttributes(apiSpan, namespace, "limitranges", len(limitRangeList.Items))

	// Start data processing span
	_, processSpan := h.tracingHelper.StartDataProcessingSpan(c.Request.Context(), "transform-limitranges")
	defer processSpan.End()
	// Transform limit ranges to the expected format
	var transformedLimitRanges []types.LimitRangeListResponse
	for _, limitRange := range limitRangeList.Items {
		transformedLimitRanges = append(transformedLimitRanges, transformers.TransformLimitRangeToResponse(&limitRange))
	}
	h.tracingHelper.AddResourceAttributes(processSpan, namespace, "limitranges", len(transformedLimitRanges))
	h.tracingHelper.RecordSuccess(processSpan, "Successfully transformed limit ranges")

	c.JSON(http.StatusOK, transformedLimitRanges)
}

// GetLimitRangesSSE returns limit ranges as Server-Sent Events with real-time updates
func (h *LimitRangesHandler) GetLimitRangesSSE(c *gin.Context) {
	// Start client setup span
	_, clientSpan := h.tracingHelper.StartAuthSpan(c.Request.Context(), "get-client-config")
	defer clientSpan.End()
	client, err := h.getClientAndConfig(c)
	if err != nil {
		h.tracingHelper.RecordError(clientSpan, err, "Failed to get Kubernetes client")
		h.logger.WithError(err).Error("Failed to get client for limit ranges SSE")
		h.sseHandler.SendSSEError(c, http.StatusBadRequest, err.Error())
		return
	}
	namespace := c.Query("namespace")
	h.tracingHelper.RecordSuccess(clientSpan, "Successfully obtained Kubernetes client")

	// Function to fetch and transform limit ranges data
	fetchLimitRanges := func() (interface{}, error) {
		// Start data fetching span
		_, fetchSpan := h.tracingHelper.StartKubernetesAPISpan(c.Request.Context(), "list", "limitranges", namespace)
		defer fetchSpan.End()
		limitRangeList, err := client.CoreV1().LimitRanges(namespace).List(c.Request.Context(), metav1.ListOptions{})
		if err != nil {
			h.tracingHelper.RecordError(fetchSpan, err, "Failed to list limit ranges")
			return nil, err
		}
		h.tracingHelper.RecordSuccess(fetchSpan, "Successfully listed limit ranges")
		h.tracingHelper.AddResourceAttributes(fetchSpan, namespace, "limitranges", len(limitRangeList.Items))

		// Start data transformation span
		_, transformSpan := h.tracingHelper.StartDataProcessingSpan(c.Request.Context(), "transform-limitranges")
		defer transformSpan.End()
		// Transform limit ranges to the expected format
		var transformedLimitRanges []types.LimitRangeListResponse
		for _, limitRange := range limitRangeList.Items {
			transformedLimitRanges = append(transformedLimitRanges, transformers.TransformLimitRangeToResponse(&limitRange))
		}
		h.tracingHelper.RecordSuccess(transformSpan, "Successfully transformed limit ranges")
		h.tracingHelper.AddResourceAttributes(transformSpan, namespace, "limitranges", len(transformedLimitRanges))

		return transformedLimitRanges, nil
	}

	// Get initial data
	initialData, err := fetchLimitRanges()
	if err != nil {
		h.logger.WithError(err).Error("Failed to list limit ranges for SSE")
		// Check if this is a permission error
		if utils.IsPermissionError(err) {
			h.sseHandler.SendSSEPermissionError(c, err)
		} else {
			h.sseHandler.SendSSEError(c, http.StatusInternalServerError, err.Error())
		}
		return
	}

	// Send SSE response with periodic updates
	h.sseHandler.SendSSEResponseWithUpdates(c, initialData, fetchLimitRanges)
}

// GetLimitRange returns a specific limit range
func (h *LimitRangesHandler) GetLimitRange(c *gin.Context) {
	// Start client setup span
	_, clientSpan := h.tracingHelper.StartAuthSpan(c.Request.Context(), "get-client-config")
	defer clientSpan.End()
	client, err := h.getClientAndConfig(c)
	if err != nil {
		h.tracingHelper.RecordError(clientSpan, err, "Failed to get Kubernetes client")
		h.logger.WithError(err).Error("Failed to get client for limit range")
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	namespace := c.Param("namespace")
	name := c.Param("name")
	h.tracingHelper.RecordSuccess(clientSpan, "Successfully obtained Kubernetes client")

	// Start Kubernetes API call span
	_, apiSpan := h.tracingHelper.StartKubernetesAPISpan(c.Request.Context(), "get", "limitrange", name)
	defer apiSpan.End()
	limitRange, err := client.CoreV1().LimitRanges(namespace).Get(c.Request.Context(), name, metav1.GetOptions{})
	if err != nil {
		h.tracingHelper.RecordError(apiSpan, err, "Failed to get limit range")
		h.logger.WithError(err).WithField("limitrange", name).WithField("namespace", namespace).Error("Failed to get limit range")
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}
	h.tracingHelper.RecordSuccess(apiSpan, "Successfully retrieved limit range")
	h.tracingHelper.AddResourceAttributes(apiSpan, name, "limitrange", 1)

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
	// Start client setup span
	_, clientSpan := h.tracingHelper.StartAuthSpan(c.Request.Context(), "get-client-config")
	defer clientSpan.End()
	client, err := h.getClientAndConfig(c)
	if err != nil {
		h.tracingHelper.RecordError(clientSpan, err, "Failed to get Kubernetes client")
		h.logger.WithError(err).Error("Failed to get client for limit range")
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	name := c.Param("name")
	namespace := c.Query("namespace")

	if namespace == "" {
		h.tracingHelper.RecordError(clientSpan, fmt.Errorf("namespace parameter is required"), "Missing namespace parameter")
		h.logger.WithField("limitrange", name).Error("Namespace is required for limit range lookup")
		c.JSON(http.StatusBadRequest, gin.H{"error": "namespace parameter is required"})
		return
	}
	h.tracingHelper.RecordSuccess(clientSpan, "Successfully obtained Kubernetes client")

	// Start Kubernetes API call span
	_, apiSpan := h.tracingHelper.StartKubernetesAPISpan(c.Request.Context(), "get", "limitrange", name)
	defer apiSpan.End()
	limitRange, err := client.CoreV1().LimitRanges(namespace).Get(c.Request.Context(), name, metav1.GetOptions{})
	if err != nil {
		h.tracingHelper.RecordError(apiSpan, err, "Failed to get limit range")
		h.logger.WithError(err).WithField("limitrange", name).WithField("namespace", namespace).Error("Failed to get limit range")
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}
	h.tracingHelper.RecordSuccess(apiSpan, "Successfully retrieved limit range")
	h.tracingHelper.AddResourceAttributes(apiSpan, name, "limitrange", 1)

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
	// Start client setup span
	_, clientSpan := h.tracingHelper.StartAuthSpan(c.Request.Context(), "get-client-config")
	defer clientSpan.End()
	client, err := h.getClientAndConfig(c)
	if err != nil {
		h.tracingHelper.RecordError(clientSpan, err, "Failed to get Kubernetes client")
		h.logger.WithError(err).Error("Failed to get client for limit range YAML")
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	name := c.Param("name")
	namespace := c.Query("namespace")

	if namespace == "" {
		h.tracingHelper.RecordError(clientSpan, fmt.Errorf("namespace parameter is required"), "Missing namespace parameter")
		h.logger.WithField("limitrange", name).Error("Namespace is required for limit range YAML lookup")
		c.JSON(http.StatusBadRequest, gin.H{"error": "namespace parameter is required"})
		return
	}
	h.tracingHelper.RecordSuccess(clientSpan, "Successfully obtained Kubernetes client")

	// Start Kubernetes API call span
	_, apiSpan := h.tracingHelper.StartKubernetesAPISpan(c.Request.Context(), "get", "limitrange", name)
	defer apiSpan.End()
	limitRange, err := client.CoreV1().LimitRanges(namespace).Get(c.Request.Context(), name, metav1.GetOptions{})
	if err != nil {
		h.tracingHelper.RecordError(apiSpan, err, "Failed to get limit range for YAML")
		h.logger.WithError(err).WithField("limitrange", name).WithField("namespace", namespace).Error("Failed to get limit range for YAML")
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}
	h.tracingHelper.RecordSuccess(apiSpan, "Successfully retrieved limit range for YAML")
	h.tracingHelper.AddResourceAttributes(apiSpan, name, "limitrange", 1)

	// Start YAML generation span
	_, yamlSpan := h.tracingHelper.StartDataProcessingSpan(c.Request.Context(), "generate-yaml")
	defer yamlSpan.End()
	h.yamlHandler.SendYAMLResponse(c, limitRange, name)
	h.tracingHelper.RecordSuccess(yamlSpan, "Successfully generated YAML response")
}

// GetLimitRangeYAML returns the YAML representation of a specific limit range
func (h *LimitRangesHandler) GetLimitRangeYAML(c *gin.Context) {
	// Start client setup span
	_, clientSpan := h.tracingHelper.StartAuthSpan(c.Request.Context(), "get-client-config")
	defer clientSpan.End()
	client, err := h.getClientAndConfig(c)
	if err != nil {
		h.tracingHelper.RecordError(clientSpan, err, "Failed to get Kubernetes client")
		h.logger.WithError(err).Error("Failed to get client for limit range YAML")
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	namespace := c.Param("namespace")
	name := c.Param("name")
	h.tracingHelper.RecordSuccess(clientSpan, "Successfully obtained Kubernetes client")

	// Start Kubernetes API call span
	_, apiSpan := h.tracingHelper.StartKubernetesAPISpan(c.Request.Context(), "get", "limitrange", name)
	defer apiSpan.End()
	limitRange, err := client.CoreV1().LimitRanges(namespace).Get(c.Request.Context(), name, metav1.GetOptions{})
	if err != nil {
		h.tracingHelper.RecordError(apiSpan, err, "Failed to get limit range for YAML")
		h.logger.WithError(err).WithField("limitrange", name).WithField("namespace", namespace).Error("Failed to get limit range for YAML")
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}
	h.tracingHelper.RecordSuccess(apiSpan, "Successfully retrieved limit range for YAML")
	h.tracingHelper.AddResourceAttributes(apiSpan, name, "limitrange", 1)

	// Start YAML generation span
	_, yamlSpan := h.tracingHelper.StartDataProcessingSpan(c.Request.Context(), "generate-yaml")
	defer yamlSpan.End()
	h.yamlHandler.SendYAMLResponse(c, limitRange, name)
	h.tracingHelper.RecordSuccess(yamlSpan, "Successfully generated YAML response")
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

	// Start client setup span
	_, clientSpan := h.tracingHelper.StartAuthSpan(c.Request.Context(), "get-client-config")
	defer clientSpan.End()
	client, err := h.getClientAndConfig(c)
	if err != nil {
		h.tracingHelper.RecordError(clientSpan, err, "Failed to get Kubernetes client")
		h.logger.WithError(err).Error("Failed to get client for limit range events")
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	h.tracingHelper.RecordSuccess(clientSpan, "Successfully obtained Kubernetes client")

	// Start events retrieval span
	_, eventsSpan := h.tracingHelper.StartKubernetesAPISpan(c.Request.Context(), "list", "events", name)
	defer eventsSpan.End()
	h.eventsHandler.GetResourceEventsWithNamespace(c, client, "LimitRange", name, namespace, h.sseHandler.SendSSEResponse)
	h.tracingHelper.RecordSuccess(eventsSpan, "Successfully retrieved limit range events")
	h.tracingHelper.AddResourceAttributes(eventsSpan, name, "events", 0)
}

// GetLimitRangeEvents returns events for a specific limit range
func (h *LimitRangesHandler) GetLimitRangeEvents(c *gin.Context) {
	name := c.Param("name")
	namespace := c.Param("namespace")

	// Start client setup span
	_, clientSpan := h.tracingHelper.StartAuthSpan(c.Request.Context(), "get-client-config")
	defer clientSpan.End()
	client, err := h.getClientAndConfig(c)
	if err != nil {
		h.tracingHelper.RecordError(clientSpan, err, "Failed to get Kubernetes client")
		h.logger.WithError(err).Error("Failed to get client for limit range events")
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	h.tracingHelper.RecordSuccess(clientSpan, "Successfully obtained Kubernetes client")

	// Start events retrieval span
	_, eventsSpan := h.tracingHelper.StartKubernetesAPISpan(c.Request.Context(), "list", "events", name)
	defer eventsSpan.End()
	h.eventsHandler.GetResourceEventsWithNamespace(c, client, "LimitRange", name, namespace, h.sseHandler.SendSSEResponse)
	h.tracingHelper.RecordSuccess(eventsSpan, "Successfully retrieved limit range events")
	h.tracingHelper.AddResourceAttributes(eventsSpan, name, "events", 0)
}
