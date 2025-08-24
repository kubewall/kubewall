package workloads

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

// ReplicaSetsHandler handles ReplicaSet-related operations
type ReplicaSetsHandler struct {
	store         *storage.KubeConfigStore
	clientFactory *k8s.ClientFactory
	logger        *logger.Logger
	eventsHandler *utils.EventsHandler
	yamlHandler   *utils.YAMLHandler
	sseHandler    *utils.SSEHandler
	tracingHelper *tracing.TracingHelper
}

// NewReplicaSetsHandler creates a new ReplicaSets handler
func NewReplicaSetsHandler(store *storage.KubeConfigStore, clientFactory *k8s.ClientFactory, log *logger.Logger) *ReplicaSetsHandler {
	return &ReplicaSetsHandler{
		store:         store,
		clientFactory: clientFactory,
		logger:        log,
		eventsHandler: utils.NewEventsHandler(log),
		yamlHandler:   utils.NewYAMLHandler(log),
		sseHandler:    utils.NewSSEHandler(log),
		tracingHelper: tracing.GetTracingHelper(),
	}
}

// getClientAndConfig gets the Kubernetes client and config for the given config ID and cluster
func (h *ReplicaSetsHandler) getClientAndConfig(c *gin.Context) (*kubernetes.Clientset, error) {
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

// GetReplicaSetsSSE returns replicasets as Server-Sent Events with real-time updates
// @Summary Get ReplicaSets (SSE)
// @Description Streams ReplicaSets data in real-time using Server-Sent Events. Supports namespace filtering and multi-cluster configurations.
// @Tags Workloads
// @Accept text/event-stream
// @Produce text/event-stream,application/json
// @Param config query string true "Kubernetes configuration ID"
// @Param cluster query string false "Cluster name for multi-cluster setups"
// @Param namespace query string false "Kubernetes namespace to filter resources"
// @Success 200 {array} types.ReplicaSetListResponse "Streaming ReplicaSets data"
// @Failure 400 {object} map[string]string "Bad request - missing or invalid parameters"
// @Failure 403 {object} map[string]string "Forbidden - insufficient permissions"
// @Failure 500 {object} map[string]string "Internal server error"
// @Security BearerAuth
// @Security KubeConfig
// @Router /api/v1/replicasets [get]
func (h *ReplicaSetsHandler) GetReplicaSetsSSE(c *gin.Context) {
	// Start child span for client setup
	ctx, clientSpan := h.tracingHelper.StartAuthSpan(c.Request.Context(), "setup-client-for-sse")
	defer clientSpan.End()

	client, err := h.getClientAndConfig(c)
	if err != nil {
		h.logger.WithError(err).Error("Failed to get client for replicasets SSE")
		h.tracingHelper.RecordError(clientSpan, err, "Failed to get Kubernetes client")
		h.sseHandler.SendSSEError(c, http.StatusBadRequest, err.Error())
		return
	}
	h.tracingHelper.RecordSuccess(clientSpan, "Kubernetes client setup for SSE")

	namespace := c.Query("namespace")

	// Function to fetch and transform replicasets data
	fetchReplicaSets := func() (interface{}, error) {
		// Start child span for data fetching
		_, fetchSpan := h.tracingHelper.StartKubernetesAPISpan(ctx, "list", "replicasets", namespace)
		defer fetchSpan.End()

		replicaSetList, err := client.AppsV1().ReplicaSets(namespace).List(c.Request.Context(), metav1.ListOptions{})
		if err != nil {
			h.tracingHelper.RecordError(fetchSpan, err, "Failed to list replicasets for SSE")
			return nil, err
		}

		// Start child span for data transformation
		_, transformSpan := h.tracingHelper.StartDataProcessingSpan(ctx, "transform-replicasets")
		defer transformSpan.End()

		// Transform replicasets to frontend-expected format
		var response []types.ReplicaSetListResponse
		for _, replicaSet := range replicaSetList.Items {
			response = append(response, transformers.TransformReplicaSetToResponse(&replicaSet))
		}

		h.tracingHelper.AddResourceAttributes(fetchSpan, "", "replicasets", len(replicaSetList.Items))
		h.tracingHelper.RecordSuccess(fetchSpan, fmt.Sprintf("Listed %d replicasets for SSE", len(replicaSetList.Items)))
		h.tracingHelper.AddResourceAttributes(transformSpan, "", "replicasets", len(response))
		h.tracingHelper.RecordSuccess(transformSpan, fmt.Sprintf("Transformed %d replicasets", len(response)))

		return response, nil
	}

	// Get initial data
	initialData, err := fetchReplicaSets()
	if err != nil {
		h.logger.WithError(err).Error("Failed to list replicasets for SSE")
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
		h.sseHandler.SendSSEResponseWithUpdates(c, initialData, fetchReplicaSets)
		return
	}

	// For non-SSE requests, return JSON
	c.JSON(http.StatusOK, initialData)
}

// GetReplicaSet returns a specific replicaset
// @Summary Get ReplicaSet by namespace and name
// @Description Retrieves detailed information about a specific ReplicaSet in a given namespace
// @Tags Workloads
// @Accept json
// @Produce json,text/event-stream
// @Param config query string true "Kubernetes configuration ID"
// @Param cluster query string false "Cluster name for multi-cluster setups"
// @Param namespace path string true "Kubernetes namespace"
// @Param name path string true "ReplicaSet name"
// @Success 200 {object} object "ReplicaSet details"
// @Failure 400 {object} map[string]string "Bad request - missing or invalid parameters"
// @Failure 404 {object} map[string]string "ReplicaSet not found"
// @Failure 500 {object} map[string]string "Internal server error"
// @Security BearerAuth
// @Security KubeConfig
// @Router /api/v1/replicasets/{namespace}/{name} [get]
func (h *ReplicaSetsHandler) GetReplicaSet(c *gin.Context) {
	// Start child span for client setup
	ctx, clientSpan := h.tracingHelper.StartAuthSpan(c.Request.Context(), "get-client-config")
	defer clientSpan.End()

	client, err := h.getClientAndConfig(c)
	if err != nil {
		h.logger.WithError(err).Error("Failed to get client for replicaset")
		h.tracingHelper.RecordError(clientSpan, err, "Failed to get Kubernetes client")
		// For EventSource, send error as SSE
		if c.GetHeader("Accept") == "text/event-stream" {
			h.sseHandler.SendSSEError(c, http.StatusBadRequest, err.Error())
		} else {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		}
		return
	}
	h.tracingHelper.RecordSuccess(clientSpan, "Kubernetes client setup completed")

	namespace := c.Param("namespace")
	name := c.Param("name")

	// Start child span for Kubernetes API call
	_, k8sSpan := h.tracingHelper.StartKubernetesAPISpan(ctx, "get", "replicaset", namespace)
	defer k8sSpan.End()

	replicaSet, err := client.AppsV1().ReplicaSets(namespace).Get(c.Request.Context(), name, metav1.GetOptions{})
	if err != nil {
		h.logger.WithError(err).WithField("replicaset", name).WithField("namespace", namespace).Error("Failed to get replicaset")
		h.tracingHelper.RecordError(k8sSpan, err, "Failed to get replicaset")
		// For EventSource, send error as SSE
		if c.GetHeader("Accept") == "text/event-stream" {
			h.sseHandler.SendSSEError(c, http.StatusNotFound, err.Error())
		} else {
			c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		}
		return
	}
	h.tracingHelper.AddResourceAttributes(k8sSpan, name, "replicaset", 1)
	h.tracingHelper.RecordSuccess(k8sSpan, fmt.Sprintf("Retrieved replicaset: %s", name))

	// Check if this is an SSE request (EventSource expects SSE format)
	acceptHeader := c.GetHeader("Accept")
	if acceptHeader == "text/event-stream" {
		h.sseHandler.SendSSEResponse(c, replicaSet)
		return
	}

	c.JSON(http.StatusOK, replicaSet)
}

// GetReplicaSetByName returns a specific replicaset by name
// @Summary Get ReplicaSet by name
// @Description Retrieves detailed information about a specific ReplicaSet by name with namespace as query parameter
// @Tags Workloads
// @Accept json
// @Produce json
// @Param config query string true "Kubernetes configuration ID"
// @Param cluster query string false "Cluster name for multi-cluster setups"
// @Param namespace query string true "Kubernetes namespace"
// @Param name path string true "ReplicaSet name"
// @Success 200 {object} object "ReplicaSet details"
// @Failure 400 {object} map[string]string "Bad request - missing or invalid parameters"
// @Failure 404 {object} map[string]string "ReplicaSet not found"
// @Failure 500 {object} map[string]string "Internal server error"
// @Security BearerAuth
// @Security KubeConfig
// @Router /api/v1/replicaset/{name} [get]
func (h *ReplicaSetsHandler) GetReplicaSetByName(c *gin.Context) {
	// Start child span for client setup
	ctx, clientSpan := h.tracingHelper.StartAuthSpan(c.Request.Context(), "get-client-config")
	defer clientSpan.End()

	client, err := h.getClientAndConfig(c)
	if err != nil {
		h.logger.WithError(err).Error("Failed to get client for replicaset by name")
		h.tracingHelper.RecordError(clientSpan, err, "Failed to get Kubernetes client")
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	h.tracingHelper.RecordSuccess(clientSpan, "Kubernetes client setup completed")

	name := c.Param("name")
	namespace := c.Query("namespace")

	if namespace == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "namespace parameter is required"})
		return
	}

	// Start child span for Kubernetes API call
	_, k8sSpan := h.tracingHelper.StartKubernetesAPISpan(ctx, "get", "replicaset", namespace)
	defer k8sSpan.End()

	replicaSet, err := client.AppsV1().ReplicaSets(namespace).Get(c.Request.Context(), name, metav1.GetOptions{})
	if err != nil {
		h.logger.WithError(err).WithField("replicaset", name).WithField("namespace", namespace).Error("Failed to get replicaset by name")
		h.tracingHelper.RecordError(k8sSpan, err, "Failed to get replicaset by name")
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}
	h.tracingHelper.AddResourceAttributes(k8sSpan, name, "replicaset", 1)
	h.tracingHelper.RecordSuccess(k8sSpan, fmt.Sprintf("Retrieved replicaset by name: %s", name))

	c.JSON(http.StatusOK, replicaSet)
}

// GetReplicaSetYAMLByName returns the YAML representation of a specific replicaset by name
// @Summary Get ReplicaSet YAML by name
// @Description Retrieves the YAML representation of a specific ReplicaSet by name
// @Tags Workloads
// @Accept json
// @Produce text/plain
// @Param config query string true "Kubernetes configuration ID"
// @Param cluster query string false "Cluster name for multi-cluster setups"
// @Param namespace query string true "Kubernetes namespace"
// @Param name path string true "ReplicaSet name"
// @Success 200 {string} string "ReplicaSet YAML representation"
// @Failure 400 {object} map[string]string "Bad request - missing or invalid parameters"
// @Failure 404 {object} map[string]string "ReplicaSet not found"
// @Failure 500 {object} map[string]string "Internal server error"
// @Security BearerAuth
// @Security KubeConfig
// @Router /api/v1/replicaset/{name}/yaml [get]
func (h *ReplicaSetsHandler) GetReplicaSetYAMLByName(c *gin.Context) {
	// Start child span for client setup
	ctx, clientSpan := h.tracingHelper.StartAuthSpan(c.Request.Context(), "get-client-config")
	defer clientSpan.End()

	client, err := h.getClientAndConfig(c)
	if err != nil {
		h.logger.WithError(err).Error("Failed to get client for replicaset YAML by name")
		h.tracingHelper.RecordError(clientSpan, err, "Failed to get Kubernetes client")
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	h.tracingHelper.RecordSuccess(clientSpan, "Kubernetes client setup completed")

	name := c.Param("name")
	namespace := c.Query("namespace")

	if namespace == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "namespace parameter is required"})
		return
	}

	// Start child span for Kubernetes API call
	_, k8sSpan := h.tracingHelper.StartKubernetesAPISpan(ctx, "get", "replicaset", namespace)
	defer k8sSpan.End()

	replicaSet, err := client.AppsV1().ReplicaSets(namespace).Get(c.Request.Context(), name, metav1.GetOptions{})
	if err != nil {
		h.logger.WithError(err).WithField("replicaset", name).WithField("namespace", namespace).Error("Failed to get replicaset for YAML by name")
		h.tracingHelper.RecordError(k8sSpan, err, "Failed to get replicaset for YAML")
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}
	h.tracingHelper.AddResourceAttributes(k8sSpan, name, "replicaset", 1)
	h.tracingHelper.RecordSuccess(k8sSpan, fmt.Sprintf("Retrieved replicaset for YAML: %s", name))

	// Start child span for YAML generation
	_, yamlSpan := h.tracingHelper.StartDataProcessingSpan(ctx, "generate-yaml")
	defer yamlSpan.End()

	h.yamlHandler.SendYAMLResponse(c, replicaSet, name)
	h.tracingHelper.RecordSuccess(yamlSpan, "Generated YAML response")
}

// GetReplicaSetYAML returns the YAML representation of a specific replicaset
// @Summary Get ReplicaSet YAML by namespace and name
// @Description Retrieves the YAML representation of a specific ReplicaSet in a given namespace
// @Tags Workloads
// @Accept json
// @Produce text/plain
// @Param config query string true "Kubernetes configuration ID"
// @Param cluster query string false "Cluster name for multi-cluster setups"
// @Param namespace path string true "Kubernetes namespace"
// @Param name path string true "ReplicaSet name"
// @Success 200 {string} string "ReplicaSet YAML representation"
// @Failure 400 {object} map[string]string "Bad request - missing or invalid parameters"
// @Failure 404 {object} map[string]string "ReplicaSet not found"
// @Failure 500 {object} map[string]string "Internal server error"
// @Security BearerAuth
// @Security KubeConfig
// @Router /api/v1/replicasets/{namespace}/{name}/yaml [get]
func (h *ReplicaSetsHandler) GetReplicaSetYAML(c *gin.Context) {
	// Start child span for client setup
	ctx, clientSpan := h.tracingHelper.StartAuthSpan(c.Request.Context(), "get-client-config")
	defer clientSpan.End()

	client, err := h.getClientAndConfig(c)
	if err != nil {
		h.logger.WithError(err).Error("Failed to get client for replicaset YAML")
		h.tracingHelper.RecordError(clientSpan, err, "Failed to get Kubernetes client")
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	h.tracingHelper.RecordSuccess(clientSpan, "Kubernetes client setup completed")

	namespace := c.Param("namespace")
	name := c.Param("name")

	// Start child span for Kubernetes API call
	_, k8sSpan := h.tracingHelper.StartKubernetesAPISpan(ctx, "get", "replicaset", namespace)
	defer k8sSpan.End()

	replicaSet, err := client.AppsV1().ReplicaSets(namespace).Get(c.Request.Context(), name, metav1.GetOptions{})
	if err != nil {
		h.logger.WithError(err).WithField("replicaset", name).WithField("namespace", namespace).Error("Failed to get replicaset for YAML")
		h.tracingHelper.RecordError(k8sSpan, err, "Failed to get replicaset for YAML")
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}
	h.tracingHelper.AddResourceAttributes(k8sSpan, name, "replicaset", 1)
	h.tracingHelper.RecordSuccess(k8sSpan, fmt.Sprintf("Retrieved replicaset for YAML: %s", name))

	// Start child span for YAML generation
	_, yamlSpan := h.tracingHelper.StartDataProcessingSpan(ctx, "generate-yaml")
	defer yamlSpan.End()

	h.yamlHandler.SendYAMLResponse(c, replicaSet, name)
	h.tracingHelper.RecordSuccess(yamlSpan, "Generated YAML response")
}

// GetReplicaSetEventsByName returns events for a specific replicaset by name
// @Summary Get ReplicaSet events by name
// @Description Retrieves events related to a specific ReplicaSet by name
// @Tags Workloads
// @Accept json
// @Produce json,text/event-stream
// @Param config query string true "Kubernetes configuration ID"
// @Param cluster query string false "Cluster name for multi-cluster setups"
// @Param namespace query string true "Kubernetes namespace"
// @Param name path string true "ReplicaSet name"
// @Success 200 {array} object "ReplicaSet events"
// @Failure 400 {object} map[string]string "Bad request - missing or invalid parameters"
// @Failure 404 {object} map[string]string "ReplicaSet not found"
// @Failure 500 {object} map[string]string "Internal server error"
// @Security BearerAuth
// @Security KubeConfig
// @Router /api/v1/replicaset/{name}/events [get]
func (h *ReplicaSetsHandler) GetReplicaSetEventsByName(c *gin.Context) {
	client, err := h.getClientAndConfig(c)
	if err != nil {
		h.logger.WithError(err).Error("Failed to get client for replicaset events")
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	name := c.Param("name")
	namespace := c.Query("namespace")

	if namespace == "" {
		h.logger.WithField("replicaset", name).Error("Namespace is required for replicaset events lookup")
		c.JSON(http.StatusBadRequest, gin.H{"error": "namespace parameter is required"})
		return
	}

	h.eventsHandler.GetResourceEventsWithNamespace(c, client, "ReplicaSet", name, namespace, h.sseHandler.SendSSEResponse)
}

// GetReplicaSetEvents returns events for a specific replicaset
// @Summary Get ReplicaSet events by namespace and name
// @Description Retrieves events related to a specific ReplicaSet in a given namespace
// @Tags Workloads
// @Accept json
// @Produce json,text/event-stream
// @Param config query string true "Kubernetes configuration ID"
// @Param cluster query string false "Cluster name for multi-cluster setups"
// @Param name path string true "ReplicaSet name"
// @Success 200 {array} object "ReplicaSet events"
// @Failure 400 {object} map[string]string "Bad request - missing or invalid parameters"
// @Failure 404 {object} map[string]string "ReplicaSet not found"
// @Failure 500 {object} map[string]string "Internal server error"
// @Security BearerAuth
// @Security KubeConfig
// @Router /api/v1/replicasets/{namespace}/{name}/events [get]
func (h *ReplicaSetsHandler) GetReplicaSetEvents(c *gin.Context) {
	client, err := h.getClientAndConfig(c)
	if err != nil {
		h.logger.WithError(err).Error("Failed to get client for replicaset events")
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	name := c.Param("name")
	h.eventsHandler.GetResourceEvents(c, client, "ReplicaSet", name, h.sseHandler.SendSSEResponse)
}

// GetReplicaSetPods returns pods for a specific replicaset
// @Summary Get ReplicaSet pods by namespace and name
// @Description Retrieves all pods managed by a specific ReplicaSet in a given namespace
// @Tags Workloads
// @Accept json
// @Produce json
// @Param config query string true "Kubernetes configuration ID"
// @Param cluster query string false "Cluster name for multi-cluster setups"
// @Param namespace path string true "Kubernetes namespace"
// @Param name path string true "ReplicaSet name"
// @Success 200 {array} types.PodListResponse "ReplicaSet pods"
// @Failure 400 {object} map[string]string "Bad request - missing or invalid parameters"
// @Failure 404 {object} map[string]string "ReplicaSet not found"
// @Failure 500 {object} map[string]string "Internal server error"
// @Security BearerAuth
// @Security KubeConfig
// @Router /api/v1/replicasets/{namespace}/{name}/pods [get]
func (h *ReplicaSetsHandler) GetReplicaSetPods(c *gin.Context) {
	client, err := h.getClientAndConfig(c)
	if err != nil {
		h.logger.WithError(err).Error("Failed to get client for replicaset pods")
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	namespace := c.Param("namespace")
	name := c.Param("name")

	// Get the replicaset to get its selector
	replicaSet, err := client.AppsV1().ReplicaSets(namespace).Get(c.Request.Context(), name, metav1.GetOptions{})
	if err != nil {
		h.logger.WithError(err).WithField("replicaset", name).WithField("namespace", namespace).Error("Failed to get replicaset for pods")
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	// Create label selector from replicaset selector
	selector := ""
	if replicaSet.Spec.Selector != nil {
		selector = metav1.FormatLabelSelector(replicaSet.Spec.Selector)
	}

	// Get pods with the replicaset selector
	podList, err := client.CoreV1().Pods(namespace).List(c.Request.Context(), metav1.ListOptions{
		LabelSelector: selector,
	})
	if err != nil {
		h.logger.WithError(err).WithField("replicaset", name).WithField("namespace", namespace).Error("Failed to get replicaset pods")
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	// Transform pods to frontend-expected format
	configID := c.Query("config")
	clusterName := c.Query("cluster")
	var response []types.PodListResponse
	for _, pod := range podList.Items {
		response = append(response, transformers.TransformPodToResponse(&pod, configID, clusterName))
	}

	c.JSON(http.StatusOK, response)
}

// GetReplicaSetPodsByName returns pods for a specific replicaset by name
// @Summary Get ReplicaSet pods by name
// @Description Retrieves all pods managed by a specific ReplicaSet by name with namespace as query parameter
// @Tags Workloads
// @Accept json
// @Produce json
// @Param config query string true "Kubernetes configuration ID"
// @Param cluster query string false "Cluster name for multi-cluster setups"
// @Param namespace query string true "Kubernetes namespace"
// @Param name path string true "ReplicaSet name"
// @Success 200 {array} types.PodListResponse "ReplicaSet pods"
// @Failure 400 {object} map[string]string "Bad request - missing or invalid parameters"
// @Failure 404 {object} map[string]string "ReplicaSet not found"
// @Failure 500 {object} map[string]string "Internal server error"
// @Security BearerAuth
// @Security KubeConfig
// @Router /api/v1/replicaset/{name}/pods [get]
func (h *ReplicaSetsHandler) GetReplicaSetPodsByName(c *gin.Context) {
	client, err := h.getClientAndConfig(c)
	if err != nil {
		h.logger.WithError(err).Error("Failed to get client for replicaset pods by name")
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	name := c.Param("name")
	namespace := c.Query("namespace")

	if namespace == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "namespace parameter is required"})
		return
	}

	// Get the replicaset to get its selector
	replicaSet, err := client.AppsV1().ReplicaSets(namespace).Get(c.Request.Context(), name, metav1.GetOptions{})
	if err != nil {
		h.logger.WithError(err).WithField("replicaset", name).WithField("namespace", namespace).Error("Failed to get replicaset for pods by name")
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	// Create label selector from replicaset selector
	selector := ""
	if replicaSet.Spec.Selector != nil {
		selector = metav1.FormatLabelSelector(replicaSet.Spec.Selector)
	}

	// Get pods with the replicaset selector
	podList, err := client.CoreV1().Pods(namespace).List(c.Request.Context(), metav1.ListOptions{
		LabelSelector: selector,
	})
	if err != nil {
		h.logger.WithError(err).WithField("replicaset", name).WithField("namespace", namespace).Error("Failed to get replicaset pods by name")
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	// Transform pods to frontend-expected format
	configID := c.Query("config")
	clusterName := c.Query("cluster")
	var response []types.PodListResponse
	for _, pod := range podList.Items {
		response = append(response, transformers.TransformPodToResponse(&pod, configID, clusterName))
	}

	c.JSON(http.StatusOK, response)
}
