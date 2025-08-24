package cluster

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

// NamespacesHandler handles namespace-related operations
type NamespacesHandler struct {
	store         *storage.KubeConfigStore
	clientFactory *k8s.ClientFactory
	logger        *logger.Logger
	sseHandler    *utils.SSEHandler
	yamlHandler   *utils.YAMLHandler
	eventsHandler *utils.EventsHandler
	tracingHelper *tracing.TracingHelper
}

// NewNamespacesHandler creates a new NamespacesHandler instance
func NewNamespacesHandler(store *storage.KubeConfigStore, clientFactory *k8s.ClientFactory, log *logger.Logger) *NamespacesHandler {
	return &NamespacesHandler{
		store:         store,
		clientFactory: clientFactory,
		logger:        log,
		sseHandler:    utils.NewSSEHandler(log),
		yamlHandler:   utils.NewYAMLHandler(log),
		eventsHandler: utils.NewEventsHandler(log),
		tracingHelper: tracing.GetTracingHelper(),
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

// GetNamespaces returns all namespaces
// @Summary Get all Namespaces
// @Description Retrieves a list of all namespaces in the Kubernetes cluster
// @Tags Cluster
// @Accept json
// @Produce json
// @Param config query string true "Kubernetes configuration ID"
// @Param cluster query string false "Cluster name for multi-cluster setups"
// @Success 200 {object} object "List of namespaces"
// @Failure 400 {object} map[string]string "Bad request - missing or invalid parameters"
// @Failure 500 {object} map[string]string "Internal server error"
// @Security BearerAuth
// @Security KubeConfig
// @Router /api/v1/namespaces [get]
func (h *NamespacesHandler) GetNamespaces(c *gin.Context) {
	// Start child span for client setup
	ctx, clientSpan := h.tracingHelper.StartAuthSpan(c.Request.Context(), "get-client-config")
	defer clientSpan.End()

	client, err := h.getClientAndConfig(c)
	if err != nil {
		h.logger.WithError(err).Error("Failed to get client for namespaces")
		h.tracingHelper.RecordError(clientSpan, err, "Failed to get Kubernetes client")
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	h.tracingHelper.RecordSuccess(clientSpan, "Successfully obtained Kubernetes client")

	// Start child span for Kubernetes API call
	_, apiSpan := h.tracingHelper.StartKubernetesAPISpan(ctx, "list", "namespaces", "")
	defer apiSpan.End()

	namespaces, err := client.CoreV1().Namespaces().List(ctx, metav1.ListOptions{})
	if err != nil {
		h.logger.WithError(err).Error("Failed to list namespaces")
		h.tracingHelper.RecordError(apiSpan, err, "Failed to list namespaces")
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	h.tracingHelper.RecordSuccess(apiSpan, "Successfully listed namespaces")
	h.tracingHelper.AddResourceAttributes(apiSpan, "", "namespaces", len(namespaces.Items))

	c.JSON(http.StatusOK, namespaces)
}

// GetNamespacesSSE returns namespaces as Server-Sent Events with real-time updates
// @Summary Get Namespaces (SSE)
// @Description Streams Namespaces data in real-time using Server-Sent Events. Provides live updates of namespace status.
// @Tags Cluster
// @Accept text/event-stream
// @Produce text/event-stream,application/json
// @Param config query string true "Kubernetes configuration ID"
// @Param cluster query string false "Cluster name for multi-cluster setups"
// @Success 200 {array} object "Streaming Namespaces data"
// @Failure 400 {object} map[string]string "Bad request - missing or invalid parameters"
// @Failure 403 {object} map[string]string "Forbidden - insufficient permissions"
// @Failure 500 {object} map[string]string "Internal server error"
// @Security BearerAuth
// @Security KubeConfig
// @Router /api/v1/namespaces [get]
func (h *NamespacesHandler) GetNamespacesSSE(c *gin.Context) {
	// Start child span for client setup
	_, clientSpan := h.tracingHelper.StartAuthSpan(c.Request.Context(), "get-client-config")
	defer clientSpan.End()

	client, err := h.getClientAndConfig(c)
	if err != nil {
		h.logger.WithError(err).Error("Failed to get client for namespaces SSE")
		h.tracingHelper.RecordError(clientSpan, err, "Failed to get Kubernetes client")
		h.sseHandler.SendSSEError(c, http.StatusBadRequest, err.Error())
		return
	}
	h.tracingHelper.RecordSuccess(clientSpan, "Successfully obtained Kubernetes client")

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

		// Check if this is a permission error
		if utils.IsPermissionError(err) {
			h.sseHandler.SendSSEPermissionError(c, err)
		} else {
			h.sseHandler.SendSSEError(c, http.StatusInternalServerError, err.Error())
		}
		return
	}

	// Check if this is an SSE request (EventSource expects SSE format)
	acceptHeader := c.GetHeader("Accept")
	if acceptHeader == "text/event-stream" {
		// Send SSE response with periodic updates
		h.sseHandler.SendSSEResponseWithUpdates(c, initialData, fetchNamespaces)
		return
	}

	// For non-SSE requests, return JSON
	c.JSON(http.StatusOK, initialData)
}

// GetNamespace returns a specific namespace
// @Summary Get Namespace by name
// @Description Retrieves detailed information about a specific namespace
// @Tags Cluster
// @Accept json
// @Produce json,text/event-stream
// @Param config query string true "Kubernetes configuration ID"
// @Param cluster query string false "Cluster name for multi-cluster setups"
// @Param name path string true "Namespace name"
// @Success 200 {object} object "Namespace details"
// @Failure 400 {object} map[string]string "Bad request - missing or invalid parameters"
// @Failure 404 {object} map[string]string "Namespace not found"
// @Failure 500 {object} map[string]string "Internal server error"
// @Security BearerAuth
// @Security KubeConfig
// @Router /api/v1/namespaces/{name} [get]
func (h *NamespacesHandler) GetNamespace(c *gin.Context) {
	// Start child span for client setup
	ctx, clientSpan := h.tracingHelper.StartAuthSpan(c.Request.Context(), "get-client-config")
	defer clientSpan.End()

	client, err := h.getClientAndConfig(c)
	if err != nil {
		h.logger.WithError(err).Error("Failed to get client for namespace")
		h.tracingHelper.RecordError(clientSpan, err, "Failed to get Kubernetes client")
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	h.tracingHelper.RecordSuccess(clientSpan, "Successfully obtained Kubernetes client")

	name := c.Param("name")

	// Start child span for Kubernetes API call
	_, apiSpan := h.tracingHelper.StartKubernetesAPISpan(ctx, "get", "namespace", name)
	defer apiSpan.End()

	namespace, err := client.CoreV1().Namespaces().Get(ctx, name, metav1.GetOptions{})
	if err != nil {
		h.logger.WithError(err).WithField("namespace", name).Error("Failed to get namespace")
		h.tracingHelper.RecordError(apiSpan, err, "Failed to get namespace")
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}
	h.tracingHelper.RecordSuccess(apiSpan, "Successfully retrieved namespace")
	h.tracingHelper.AddResourceAttributes(apiSpan, name, "namespace", 1)

	// Check if this is an SSE request (EventSource expects SSE format)
	acceptHeader := c.GetHeader("Accept")
	if acceptHeader == "text/event-stream" {
		h.sseHandler.SendSSEResponse(c, namespace)
		return
	}

	c.JSON(http.StatusOK, namespace)
}

// GetNamespaceYAML returns the YAML representation of a specific namespace
// @Summary Get Namespace YAML
// @Description Retrieves the YAML representation of a specific namespace
// @Tags Cluster
// @Accept json
// @Produce text/plain
// @Param config query string true "Kubernetes configuration ID"
// @Param cluster query string false "Cluster name for multi-cluster setups"
// @Param name path string true "Namespace name"
// @Success 200 {string} string "Namespace YAML representation"
// @Failure 400 {object} map[string]string "Bad request - missing or invalid parameters"
// @Failure 404 {object} map[string]string "Namespace not found"
// @Failure 500 {object} map[string]string "Internal server error"
// @Security BearerAuth
// @Security KubeConfig
// @Router /api/v1/namespaces/{name}/yaml [get]
func (h *NamespacesHandler) GetNamespaceYAML(c *gin.Context) {
	// Start child span for client setup
	ctx, clientSpan := h.tracingHelper.StartAuthSpan(c.Request.Context(), "get-client-config")
	defer clientSpan.End()

	client, err := h.getClientAndConfig(c)
	if err != nil {
		h.logger.WithError(err).Error("Failed to get client for namespace YAML")
		h.tracingHelper.RecordError(clientSpan, err, "Failed to get Kubernetes client")
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	h.tracingHelper.RecordSuccess(clientSpan, "Successfully obtained Kubernetes client")

	name := c.Param("name")

	// Start child span for Kubernetes API call
	_, apiSpan := h.tracingHelper.StartKubernetesAPISpan(ctx, "get", "namespace", name)
	defer apiSpan.End()

	namespace, err := client.CoreV1().Namespaces().Get(ctx, name, metav1.GetOptions{})
	if err != nil {
		h.logger.WithError(err).WithField("namespace", name).Error("Failed to get namespace for YAML")
		h.tracingHelper.RecordError(apiSpan, err, "Failed to get namespace for YAML")
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}
	h.tracingHelper.RecordSuccess(apiSpan, "Successfully retrieved namespace for YAML")
	h.tracingHelper.AddResourceAttributes(apiSpan, name, "namespace", 1)

	// Start child span for YAML generation
	_, yamlSpan := h.tracingHelper.StartDataProcessingSpan(ctx, "generate-yaml")
	defer yamlSpan.End()

	h.yamlHandler.SendYAMLResponse(c, namespace, name)
	h.tracingHelper.RecordSuccess(yamlSpan, "Successfully generated YAML response")
}

// GetNamespaceEvents returns events for a specific namespace
// @Summary Get Namespace events
// @Description Retrieves events related to a specific namespace
// @Tags Cluster
// @Accept json
// @Produce json,text/event-stream
// @Param config query string true "Kubernetes configuration ID"
// @Param cluster query string false "Cluster name for multi-cluster setups"
// @Param name path string true "Namespace name"
// @Success 200 {array} object "Namespace events"
// @Failure 400 {object} map[string]string "Bad request - missing or invalid parameters"
// @Failure 404 {object} map[string]string "Namespace not found"
// @Failure 500 {object} map[string]string "Internal server error"
// @Security BearerAuth
// @Security KubeConfig
// @Router /api/v1/namespaces/{name}/events [get]
func (h *NamespacesHandler) GetNamespaceEvents(c *gin.Context) {
	// Start child span for client setup
	ctx, clientSpan := h.tracingHelper.StartAuthSpan(c.Request.Context(), "get-client-config")
	defer clientSpan.End()

	client, err := h.getClientAndConfig(c)
	if err != nil {
		h.logger.WithError(err).Error("Failed to get client for namespace events")
		h.tracingHelper.RecordError(clientSpan, err, "Failed to get Kubernetes client")
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	h.tracingHelper.RecordSuccess(clientSpan, "Successfully obtained Kubernetes client")

	name := c.Param("name")

	// Start child span for events retrieval
	_, eventsSpan := h.tracingHelper.StartKubernetesAPISpan(ctx, "list", "events", name)
	defer eventsSpan.End()

	h.eventsHandler.GetResourceEvents(c, client, "Namespace", name, h.sseHandler.SendSSEResponse)
	h.tracingHelper.RecordSuccess(eventsSpan, "Successfully retrieved namespace events")
	h.tracingHelper.AddResourceAttributes(eventsSpan, name, "events", 0)
}

// GetNamespacePods returns pods for a specific namespace with SSE support
// @Summary Get Namespace pods
// @Description Retrieves all pods in a specific namespace with real-time updates
// @Tags Cluster
// @Accept json,text/event-stream
// @Produce json,text/event-stream
// @Param config query string true "Kubernetes configuration ID"
// @Param cluster query string false "Cluster name for multi-cluster setups"
// @Param name path string true "Namespace name"
// @Success 200 {array} types.PodListResponse "Namespace pods"
// @Failure 400 {object} map[string]string "Bad request - missing or invalid parameters"
// @Failure 404 {object} map[string]string "Namespace not found"
// @Failure 500 {object} map[string]string "Internal server error"
// @Security BearerAuth
// @Security KubeConfig
// @Router /api/v1/namespaces/{name}/pods [get]
func (h *NamespacesHandler) GetNamespacePods(c *gin.Context) {
	// Start child span for client setup
	_, clientSpan := h.tracingHelper.StartAuthSpan(c.Request.Context(), "get-client-config")
	defer clientSpan.End()

	client, err := h.getClientAndConfig(c)
	if err != nil {
		h.logger.WithError(err).Error("Failed to get client for namespace pods")
		h.tracingHelper.RecordError(clientSpan, err, "Failed to get Kubernetes client")
		h.sseHandler.SendSSEError(c, http.StatusBadRequest, err.Error())
		return
	}
	h.tracingHelper.RecordSuccess(clientSpan, "Successfully obtained Kubernetes client")

	namespaceName := c.Param("name")
	configID := c.Query("config")
	cluster := c.Query("cluster")

	// Function to fetch and transform pods data for the specific namespace
	fetchNamespacePods := func() (interface{}, error) {
		// Get pods directly from the namespace (no field selector needed)
		podList, err := client.CoreV1().Pods(namespaceName).List(c.Request.Context(), metav1.ListOptions{})
		if err != nil {
			return nil, err
		}

		// Transform pods to frontend-expected format
		var response []types.PodListResponse
		for _, pod := range podList.Items {
			response = append(response, transformers.TransformPodToResponse(&pod, configID, cluster))
		}

		return response, nil
	}

	// Get initial data
	initialData, err := fetchNamespacePods()
	if err != nil {
		h.logger.WithError(err).WithField("namespace", namespaceName).Error("Failed to list namespace pods for SSE")
		h.sseHandler.SendSSEError(c, http.StatusInternalServerError, err.Error())
		return
	}

	// Check if this is an SSE request (EventSource expects SSE format)
	acceptHeader := c.GetHeader("Accept")
	if acceptHeader == "text/event-stream" {
		// Send SSE response with periodic updates
		h.sseHandler.SendSSEResponseWithUpdates(c, initialData, fetchNamespacePods)
		return
	}

	// For non-SSE requests, return JSON
	c.JSON(http.StatusOK, initialData)
}
