package workloads

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

// DaemonSetsHandler handles DaemonSet-related operations
type DaemonSetsHandler struct {
	store         *storage.KubeConfigStore
	clientFactory *k8s.ClientFactory
	logger        *logger.Logger
	eventsHandler *utils.EventsHandler
	yamlHandler   *utils.YAMLHandler
	sseHandler    *utils.SSEHandler
	tracingHelper *tracing.TracingHelper
}

// NewDaemonSetsHandler creates a new DaemonSets handler
func NewDaemonSetsHandler(store *storage.KubeConfigStore, clientFactory *k8s.ClientFactory, log *logger.Logger) *DaemonSetsHandler {
	return &DaemonSetsHandler{
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
func (h *DaemonSetsHandler) getClientAndConfig(c *gin.Context) (*kubernetes.Clientset, error) {
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

// GetDaemonSetsSSE returns daemonsets as Server-Sent Events with real-time updates
// @Summary Get DaemonSets (SSE)
// @Description Retrieve all daemonsets with real-time updates via Server-Sent Events
// @Tags Workloads
// @Accept json
// @Produce text/event-stream
// @Param config query string true "Kubernetes config ID"
// @Param cluster query string false "Cluster name (for multi-cluster configs)"
// @Param namespace query string false "Namespace to filter daemonsets (empty for all namespaces)"
// @Success 200 {array} types.DaemonSetListResponse "Stream of daemonset data"
// @Failure 400 {object} map[string]string "Bad request - invalid parameters"
// @Failure 403 {object} map[string]string "Forbidden - insufficient permissions"
// @Failure 500 {object} map[string]string "Internal server error"
// @Security BearerAuth
// @Security KubeConfig
// @Router /api/v1/daemonsets [get]
func (h *DaemonSetsHandler) GetDaemonSetsSSE(c *gin.Context) {
	// Start child span for client setup
	ctx, clientSpan := h.tracingHelper.StartAuthSpan(c.Request.Context(), "setup-client-for-sse")
	defer clientSpan.End()

	client, err := h.getClientAndConfig(c)
	if err != nil {
		h.logger.WithError(err).Error("Failed to get client for daemonsets SSE")
		h.tracingHelper.RecordError(clientSpan, err, "Failed to get Kubernetes client")
		h.sseHandler.SendSSEError(c, http.StatusBadRequest, err.Error())
		return
	}
	h.tracingHelper.RecordSuccess(clientSpan, "Kubernetes client setup for SSE")

	namespace := c.Query("namespace")

	// Function to fetch and transform daemonsets data
	fetchDaemonSets := func() (interface{}, error) {
		// Start child span for data fetching
		_, fetchSpan := h.tracingHelper.StartKubernetesAPISpan(ctx, "list", "daemonsets", namespace)
		defer fetchSpan.End()

		daemonSetList, err := client.AppsV1().DaemonSets(namespace).List(c.Request.Context(), metav1.ListOptions{})
		if err != nil {
			h.tracingHelper.RecordError(fetchSpan, err, "Failed to list daemonsets for SSE")
			return nil, err
		}

		// Start child span for data transformation
		_, transformSpan := h.tracingHelper.StartDataProcessingSpan(ctx, "transform-daemonsets")
		defer transformSpan.End()

		// Transform daemonsets to frontend-expected format
		var response []types.DaemonSetListResponse
		for _, daemonSet := range daemonSetList.Items {
			response = append(response, transformers.TransformDaemonSetToResponse(&daemonSet))
		}

		h.tracingHelper.AddResourceAttributes(fetchSpan, "", "daemonsets", len(daemonSetList.Items))
		h.tracingHelper.RecordSuccess(fetchSpan, fmt.Sprintf("Listed %d daemonsets for SSE", len(daemonSetList.Items)))
		h.tracingHelper.AddResourceAttributes(transformSpan, "", "daemonsets", len(response))
		h.tracingHelper.RecordSuccess(transformSpan, fmt.Sprintf("Transformed %d daemonsets", len(response)))

		return response, nil
	}

	// Get initial data
	initialData, err := fetchDaemonSets()
	if err != nil {
		h.logger.WithError(err).Error("Failed to list daemonsets for SSE")
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
		h.sseHandler.SendSSEResponseWithUpdates(c, initialData, fetchDaemonSets)
		return
	}

	// For non-SSE requests, return JSON
	c.JSON(http.StatusOK, initialData)
}

// GetDaemonSet returns a specific daemonset
// @Summary Get DaemonSet by Namespace and Name
// @Description Retrieve a specific daemonset by namespace and name
// @Tags Workloads
// @Accept json
// @Produce text/event-stream
// @Param config query string true "Kubernetes config ID"
// @Param cluster query string false "Cluster name (for multi-cluster configs)"
// @Param namespace path string true "Namespace name"
// @Param name path string true "DaemonSet name"
// @Success 200 {object} object "DaemonSet details"
// @Failure 400 {object} map[string]string "Bad request - invalid parameters"
// @Failure 404 {object} map[string]string "DaemonSet not found"
// @Security BearerAuth
// @Security KubeConfig
// @Router /api/v1/daemonsets/{namespace}/{name} [get]
func (h *DaemonSetsHandler) GetDaemonSet(c *gin.Context) {
	// Start child span for client setup
	ctx, clientSpan := h.tracingHelper.StartAuthSpan(c.Request.Context(), "get-client-config")
	defer clientSpan.End()

	client, err := h.getClientAndConfig(c)
	if err != nil {
		h.logger.WithError(err).Error("Failed to get client for daemonset")
		h.tracingHelper.RecordError(clientSpan, err, "Failed to get Kubernetes client")
		// For EventSource, send error as SSE
		if c.GetHeader("Accept") == "text/event-stream" {
			h.sseHandler.SendSSEError(c, http.StatusBadRequest, err.Error())
		} else {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		}
		return
	}
	h.tracingHelper.RecordSuccess(clientSpan, "Kubernetes client obtained")

	namespace := c.Param("namespace")
	name := c.Param("name")

	// Start child span for Kubernetes API call
	_, k8sSpan := h.tracingHelper.StartKubernetesAPISpan(ctx, "get", "daemonset", namespace)
	defer k8sSpan.End()

	daemonSet, err := client.AppsV1().DaemonSets(namespace).Get(c.Request.Context(), name, metav1.GetOptions{})
	if err != nil {
		h.logger.WithError(err).WithField("daemonset", name).WithField("namespace", namespace).Error("Failed to get daemonset")
		h.tracingHelper.RecordError(k8sSpan, err, "Failed to get daemonset")
		// For EventSource, send error as SSE
		if c.GetHeader("Accept") == "text/event-stream" {
			h.sseHandler.SendSSEError(c, http.StatusNotFound, err.Error())
		} else {
			c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		}
		return
	}

	h.tracingHelper.AddResourceAttributes(k8sSpan, name, "daemonset", 1)
	h.tracingHelper.RecordSuccess(k8sSpan, fmt.Sprintf("Retrieved daemonset: %s", name))

	// Check if this is an SSE request (EventSource expects SSE format)
	acceptHeader := c.GetHeader("Accept")
	if acceptHeader == "text/event-stream" {
		h.sseHandler.SendSSEResponse(c, daemonSet)
		return
	}

	c.JSON(http.StatusOK, daemonSet)
}

// GetDaemonSetByName returns a specific daemonset by name
// @Summary Get DaemonSet by Name
// @Description Retrieve a specific daemonset by name with namespace as query parameter
// @Tags Workloads
// @Accept json
// @Produce json
// @Param config query string true "Kubernetes config ID"
// @Param cluster query string false "Cluster name (for multi-cluster configs)"
// @Param name path string true "DaemonSet name"
// @Param namespace query string true "Namespace name"
// @Success 200 {object} object "DaemonSet details"
// @Failure 400 {object} map[string]string "Bad request - missing namespace parameter"
// @Failure 404 {object} map[string]string "DaemonSet not found"
// @Security BearerAuth
// @Security KubeConfig
// @Router /api/v1/daemonset/{name} [get]
func (h *DaemonSetsHandler) GetDaemonSetByName(c *gin.Context) {
	// Start child span for client setup
	ctx, clientSpan := h.tracingHelper.StartAuthSpan(c.Request.Context(), "get-client-config")
	defer clientSpan.End()

	client, err := h.getClientAndConfig(c)
	if err != nil {
		h.logger.WithError(err).Error("Failed to get client for daemonset by name")
		h.tracingHelper.RecordError(clientSpan, err, "Failed to get Kubernetes client")
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	h.tracingHelper.RecordSuccess(clientSpan, "Kubernetes client obtained")

	name := c.Param("name")
	namespace := c.Query("namespace")

	if namespace == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "namespace parameter is required"})
		return
	}

	// Start child span for Kubernetes API call
	_, k8sSpan := h.tracingHelper.StartKubernetesAPISpan(ctx, "get", "daemonset", namespace)
	defer k8sSpan.End()

	daemonSet, err := client.AppsV1().DaemonSets(namespace).Get(c.Request.Context(), name, metav1.GetOptions{})
	if err != nil {
		h.logger.WithError(err).WithField("daemonset", name).WithField("namespace", namespace).Error("Failed to get daemonset by name")
		h.tracingHelper.RecordError(k8sSpan, err, "Failed to get daemonset by name")
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	h.tracingHelper.AddResourceAttributes(k8sSpan, name, "daemonset", 1)
	h.tracingHelper.RecordSuccess(k8sSpan, fmt.Sprintf("Retrieved daemonset by name: %s", name))

	c.JSON(http.StatusOK, daemonSet)
}

// GetDaemonSetYAMLByName returns the YAML representation of a specific daemonset by name
// @Summary Get DaemonSet YAML by Name
// @Description Retrieve the YAML representation of a specific daemonset by name
// @Tags Workloads
// @Accept json
// @Produce text/plain
// @Param config query string true "Kubernetes config ID"
// @Param cluster query string false "Cluster name (for multi-cluster configs)"
// @Param name path string true "DaemonSet name"
// @Param namespace query string true "Namespace name"
// @Success 200 {string} string "DaemonSet YAML"
// @Failure 400 {object} map[string]string "Bad request - missing namespace parameter"
// @Failure 404 {object} map[string]string "DaemonSet not found"
// @Security BearerAuth
// @Security KubeConfig
// @Router /api/v1/daemonset/{name}/yaml [get]
func (h *DaemonSetsHandler) GetDaemonSetYAMLByName(c *gin.Context) {
	// Start child span for client setup
	ctx, clientSpan := h.tracingHelper.StartAuthSpan(c.Request.Context(), "get-client-config")
	defer clientSpan.End()

	client, err := h.getClientAndConfig(c)
	if err != nil {
		h.logger.WithError(err).Error("Failed to get client for daemonset YAML by name")
		h.tracingHelper.RecordError(clientSpan, err, "Failed to get Kubernetes client")
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	h.tracingHelper.RecordSuccess(clientSpan, "Kubernetes client obtained")

	name := c.Param("name")
	namespace := c.Query("namespace")

	if namespace == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "namespace parameter is required"})
		return
	}

	// Start child span for Kubernetes API call
	_, k8sSpan := h.tracingHelper.StartKubernetesAPISpan(ctx, "get", "daemonset", namespace)
	defer k8sSpan.End()

	daemonSet, err := client.AppsV1().DaemonSets(namespace).Get(c.Request.Context(), name, metav1.GetOptions{})
	if err != nil {
		h.logger.WithError(err).WithField("daemonset", name).WithField("namespace", namespace).Error("Failed to get daemonset for YAML by name")
		h.tracingHelper.RecordError(k8sSpan, err, "Failed to get daemonset for YAML")
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	h.tracingHelper.AddResourceAttributes(k8sSpan, name, "daemonset", 1)
	h.tracingHelper.RecordSuccess(k8sSpan, fmt.Sprintf("Retrieved daemonset YAML: %s", name))

	// Start child span for YAML processing
	_, yamlSpan := h.tracingHelper.StartDataProcessingSpan(ctx, "generate-yaml")
	defer yamlSpan.End()

	h.yamlHandler.SendYAMLResponse(c, daemonSet, name)
	h.tracingHelper.RecordSuccess(yamlSpan, "Generated YAML response")
}

// GetDaemonSetYAML returns the YAML representation of a specific daemonset
// @Summary Get DaemonSet YAML by Namespace and Name
// @Description Retrieve the YAML representation of a specific daemonset by namespace and name
// @Tags Workloads
// @Accept json
// @Produce text/plain
// @Param config query string true "Kubernetes config ID"
// @Param cluster query string false "Cluster name (for multi-cluster configs)"
// @Param namespace path string true "Namespace name"
// @Param name path string true "DaemonSet name"
// @Success 200 {string} string "DaemonSet YAML"
// @Failure 400 {object} map[string]string "Bad request - invalid parameters"
// @Failure 404 {object} map[string]string "DaemonSet not found"
// @Security BearerAuth
// @Security KubeConfig
// @Router /api/v1/daemonsets/{namespace}/{name}/yaml [get]
func (h *DaemonSetsHandler) GetDaemonSetYAML(c *gin.Context) {
	// Start child span for client setup
	ctx, clientSpan := h.tracingHelper.StartAuthSpan(c.Request.Context(), "get-client-config")
	defer clientSpan.End()

	client, err := h.getClientAndConfig(c)
	if err != nil {
		h.logger.WithError(err).Error("Failed to get client for daemonset YAML")
		h.tracingHelper.RecordError(clientSpan, err, "Failed to get Kubernetes client")
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	h.tracingHelper.RecordSuccess(clientSpan, "Kubernetes client obtained")

	namespace := c.Param("namespace")
	name := c.Param("name")

	// Start child span for Kubernetes API call
	_, k8sSpan := h.tracingHelper.StartKubernetesAPISpan(ctx, "get", "daemonset", namespace)
	defer k8sSpan.End()

	daemonSet, err := client.AppsV1().DaemonSets(namespace).Get(c.Request.Context(), name, metav1.GetOptions{})
	if err != nil {
		h.logger.WithError(err).WithField("daemonset", name).WithField("namespace", namespace).Error("Failed to get daemonset for YAML")
		h.tracingHelper.RecordError(k8sSpan, err, "Failed to get daemonset for YAML")
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	h.tracingHelper.AddResourceAttributes(k8sSpan, name, "daemonset", 1)
	h.tracingHelper.RecordSuccess(k8sSpan, fmt.Sprintf("Retrieved daemonset YAML: %s", name))

	// Start child span for YAML processing
	_, yamlSpan := h.tracingHelper.StartDataProcessingSpan(ctx, "generate-yaml")
	defer yamlSpan.End()

	h.yamlHandler.SendYAMLResponse(c, daemonSet, name)
	h.tracingHelper.RecordSuccess(yamlSpan, "Generated YAML response")
}

// GetDaemonSetEventsByName returns events for a specific daemonset by name
// @Summary Get DaemonSet Events by Name
// @Description Retrieve events for a specific daemonset by name
// @Tags Workloads
// @Accept json
// @Produce text/event-stream
// @Param config query string true "Kubernetes config ID"
// @Param cluster query string false "Cluster name (for multi-cluster configs)"
// @Param name path string true "DaemonSet name"
// @Param namespace query string true "Namespace name"
// @Success 200 {array} object "DaemonSet events"
// @Failure 400 {object} map[string]string "Bad request - missing namespace parameter"
// @Security BearerAuth
// @Security KubeConfig
// @Router /api/v1/daemonset/{name}/events [get]
func (h *DaemonSetsHandler) GetDaemonSetEventsByName(c *gin.Context) {
	client, err := h.getClientAndConfig(c)
	if err != nil {
		h.logger.WithError(err).Error("Failed to get client for daemonset events")
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	name := c.Param("name")
	namespace := c.Query("namespace")

	if namespace == "" {
		h.logger.WithField("daemonset", name).Error("Namespace is required for daemonset events lookup")
		c.JSON(http.StatusBadRequest, gin.H{"error": "namespace parameter is required"})
		return
	}

	h.eventsHandler.GetResourceEventsWithNamespace(c, client, "DaemonSet", name, namespace, h.sseHandler.SendSSEResponse)
}

// GetDaemonSetEvents returns events for a specific daemonset
// @Summary Get DaemonSet Events by Namespace and Name
// @Description Retrieve events for a specific daemonset by namespace and name
// @Tags Workloads
// @Accept json
// @Produce text/event-stream
// @Param config query string true "Kubernetes config ID"
// @Param cluster query string false "Cluster name (for multi-cluster configs)"
// @Param namespace path string true "Namespace name"
// @Param name path string true "DaemonSet name"
// @Success 200 {array} object "DaemonSet events"
// @Failure 400 {object} map[string]string "Bad request - invalid parameters"
// @Security BearerAuth
// @Security KubeConfig
// @Router /api/v1/daemonsets/{namespace}/{name}/events [get]
func (h *DaemonSetsHandler) GetDaemonSetEvents(c *gin.Context) {
	client, err := h.getClientAndConfig(c)
	if err != nil {
		h.logger.WithError(err).Error("Failed to get client for daemonset events")
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	name := c.Param("name")
	h.eventsHandler.GetResourceEvents(c, client, "DaemonSet", name, h.sseHandler.SendSSEResponse)
}

// GetDaemonSetPods returns pods for a specific daemonset
// @Summary Get DaemonSet Pods by Namespace and Name
// @Description Retrieve all pods belonging to a specific daemonset by namespace and name
// @Tags Workloads
// @Accept json
// @Produce json
// @Param config query string true "Kubernetes config ID"
// @Param cluster query string false "Cluster name (for multi-cluster configs)"
// @Param namespace path string true "Namespace name"
// @Param name path string true "DaemonSet name"
// @Success 200 {array} types.PodListResponse "DaemonSet pods"
// @Failure 400 {object} map[string]string "Bad request - invalid parameters"
// @Failure 404 {object} map[string]string "DaemonSet not found"
// @Failure 500 {object} map[string]string "Internal server error"
// @Security BearerAuth
// @Security KubeConfig
// @Router /api/v1/daemonsets/{namespace}/{name}/pods [get]
func (h *DaemonSetsHandler) GetDaemonSetPods(c *gin.Context) {
	client, err := h.getClientAndConfig(c)
	if err != nil {
		h.logger.WithError(err).Error("Failed to get client for daemonset pods")
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	namespace := c.Param("namespace")
	name := c.Param("name")

	// Get the daemonset to get its selector
	daemonSet, err := client.AppsV1().DaemonSets(namespace).Get(c.Request.Context(), name, metav1.GetOptions{})
	if err != nil {
		h.logger.WithError(err).WithField("daemonset", name).WithField("namespace", namespace).Error("Failed to get daemonset for pods")
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	// Create label selector from daemonset selector
	selector := ""
	if daemonSet.Spec.Selector != nil {
		selector = metav1.FormatLabelSelector(daemonSet.Spec.Selector)
	}

	// Get pods with the daemonset selector
	podList, err := client.CoreV1().Pods(namespace).List(c.Request.Context(), metav1.ListOptions{
		LabelSelector: selector,
	})
	if err != nil {
		h.logger.WithError(err).WithField("daemonset", name).WithField("namespace", namespace).Error("Failed to get daemonset pods")
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

// RestartDaemonSet restarts a daemonset using rolling restart
// @Summary Restart DaemonSet
// @Description Restart all pods in a daemonset using rolling restart strategy
// @Tags Workloads
// @Accept json
// @Produce json
// @Param config query string true "Kubernetes config ID"
// @Param cluster query string false "Cluster name (for multi-cluster configs)"
// @Param name path string true "DaemonSet name"
// @Param namespace query string true "Namespace name"
// @Success 200 {object} map[string]string "DaemonSet restart initiated successfully"
// @Failure 400 {object} map[string]string "Bad request - invalid parameters"
// @Security BearerAuth
// @Security KubeConfig
// @Router /api/v1/daemonset/{name}/restart [post]
func (h *DaemonSetsHandler) RestartDaemonSet(c *gin.Context) {
	// Start child span for client setup
	ctx, clientSpan := h.tracingHelper.StartAuthSpan(c.Request.Context(), "get-client-config")
	defer clientSpan.End()

	client, err := h.getClientAndConfig(c)
	if err != nil {
		h.logger.WithError(err).Error("Failed to get client for restarting daemonset")
		h.tracingHelper.RecordError(clientSpan, err, "Failed to get Kubernetes client")
		c.JSON(http.StatusBadRequest, gin.H{"message": err.Error(), "code": http.StatusBadRequest})
		return
	}
	h.tracingHelper.RecordSuccess(clientSpan, "Kubernetes client obtained")

	name := c.Param("name")
	namespace := c.Query("namespace")
	if namespace == "" {
		c.JSON(http.StatusBadRequest, gin.H{"message": "namespace parameter is required", "code": http.StatusBadRequest})
		return
	}

	// Start child span for rolling restart operation
	_, restartSpan := h.tracingHelper.StartKubernetesAPISpan(ctx, "rolling-restart", "daemonset", namespace)
	defer restartSpan.End()

	// DaemonSets only support rolling restart (no recreate option like StatefulSets)
	err = h.performRollingRestart(client, name, namespace)
	if err != nil {
		h.logger.WithError(err).WithField("daemonset", name).WithField("namespace", namespace).Error("Failed to perform rolling restart")
		h.tracingHelper.RecordError(restartSpan, err, "Failed to perform rolling restart")
		c.JSON(http.StatusBadRequest, gin.H{"message": err.Error(), "code": http.StatusBadRequest})
		return
	}

	h.tracingHelper.AddResourceAttributes(restartSpan, name, "daemonset", 1)
	h.tracingHelper.RecordSuccess(restartSpan, "Rolling restart initiated successfully")

	c.JSON(http.StatusOK, gin.H{"message": "Rolling restart initiated - pods will be replaced gradually while maintaining availability"})
}

// performRollingRestart performs a rolling restart by adding a restart annotation
func (h *DaemonSetsHandler) performRollingRestart(client *kubernetes.Clientset, name, namespace string) error {
	// Get the current daemonset
	daemonSet, err := client.AppsV1().DaemonSets(namespace).Get(context.Background(), name, metav1.GetOptions{})
	if err != nil {
		return fmt.Errorf("failed to get daemonset: %w", err)
	}

	// Add restart annotation to pod template
	if daemonSet.Spec.Template.Annotations == nil {
		daemonSet.Spec.Template.Annotations = make(map[string]string)
	}
	daemonSet.Spec.Template.Annotations["kubectl.kubernetes.io/restartedAt"] = time.Now().Format(time.RFC3339)

	// Update the daemonset
	_, err = client.AppsV1().DaemonSets(namespace).Update(context.Background(), daemonSet, metav1.UpdateOptions{})
	if err != nil {
		return fmt.Errorf("failed to update daemonset with restart annotation: %w", err)
	}

	return nil
}

// GetDaemonSetPodsByName returns pods for a specific daemonset by name
// @Summary Get DaemonSet Pods by Name
// @Description Retrieve all pods belonging to a specific daemonset by name with namespace as query parameter
// @Tags Workloads
// @Accept json
// @Produce json
// @Param config query string true "Kubernetes config ID"
// @Param cluster query string false "Cluster name (for multi-cluster configs)"
// @Param name path string true "DaemonSet name"
// @Param namespace query string true "Namespace name"
// @Success 200 {array} types.PodListResponse "DaemonSet pods"
// @Failure 400 {object} map[string]string "Bad request - missing namespace parameter"
// @Failure 404 {object} map[string]string "DaemonSet not found"
// @Failure 500 {object} map[string]string "Internal server error"
// @Security BearerAuth
// @Security KubeConfig
// @Router /api/v1/daemonset/{name}/pods [get]
func (h *DaemonSetsHandler) GetDaemonSetPodsByName(c *gin.Context) {
	client, err := h.getClientAndConfig(c)
	if err != nil {
		h.logger.WithError(err).Error("Failed to get client for daemonset pods by name")
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	name := c.Param("name")
	namespace := c.Query("namespace")

	if namespace == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "namespace parameter is required"})
		return
	}

	// Get the daemonset to get its selector
	daemonSet, err := client.AppsV1().DaemonSets(namespace).Get(c.Request.Context(), name, metav1.GetOptions{})
	if err != nil {
		h.logger.WithError(err).WithField("daemonset", name).WithField("namespace", namespace).Error("Failed to get daemonset for pods by name")
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	// Create label selector from daemonset selector
	selector := ""
	if daemonSet.Spec.Selector != nil {
		selector = metav1.FormatLabelSelector(daemonSet.Spec.Selector)
	}

	// Get pods with the daemonset selector
	podList, err := client.CoreV1().Pods(namespace).List(c.Request.Context(), metav1.ListOptions{
		LabelSelector: selector,
	})
	if err != nil {
		h.logger.WithError(err).WithField("daemonset", name).WithField("namespace", namespace).Error("Failed to get daemonset pods by name")
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
