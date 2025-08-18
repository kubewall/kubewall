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

// StatefulSetsHandler handles StatefulSet-related operations
type StatefulSetsHandler struct {
	store         *storage.KubeConfigStore
	clientFactory *k8s.ClientFactory
	logger        *logger.Logger
	eventsHandler *utils.EventsHandler
	yamlHandler   *utils.YAMLHandler
	sseHandler    *utils.SSEHandler
	tracingHelper *tracing.TracingHelper
}

// NewStatefulSetsHandler creates a new StatefulSets handler
func NewStatefulSetsHandler(store *storage.KubeConfigStore, clientFactory *k8s.ClientFactory, log *logger.Logger) *StatefulSetsHandler {
	return &StatefulSetsHandler{
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
func (h *StatefulSetsHandler) getClientAndConfig(c *gin.Context) (*kubernetes.Clientset, error) {
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

// GetStatefulSetsSSE returns statefulsets as Server-Sent Events with real-time updates
func (h *StatefulSetsHandler) GetStatefulSetsSSE(c *gin.Context) {
	// Start child span for client setup
	ctx, clientSpan := h.tracingHelper.StartAuthSpan(c.Request.Context(), "setup-client-for-sse")
	defer clientSpan.End()

	client, err := h.getClientAndConfig(c)
	if err != nil {
		h.logger.WithError(err).Error("Failed to get client for statefulsets SSE")
		h.tracingHelper.RecordError(clientSpan, err, "Failed to get Kubernetes client")
		h.sseHandler.SendSSEError(c, http.StatusBadRequest, err.Error())
		return
	}
	h.tracingHelper.RecordSuccess(clientSpan, "Kubernetes client setup for SSE")

	namespace := c.Query("namespace")

	// Function to fetch and transform statefulsets data
	fetchStatefulSets := func() (interface{}, error) {
		// Start child span for data fetching
		_, fetchSpan := h.tracingHelper.StartKubernetesAPISpan(ctx, "list", "statefulsets", namespace)
		defer fetchSpan.End()

		statefulSetList, err := client.AppsV1().StatefulSets(namespace).List(c.Request.Context(), metav1.ListOptions{})
		if err != nil {
			h.tracingHelper.RecordError(fetchSpan, err, "Failed to list statefulsets for SSE")
			return nil, err
		}

		// Start child span for data transformation
		_, transformSpan := h.tracingHelper.StartDataProcessingSpan(ctx, "transform-statefulsets")
		defer transformSpan.End()

		// Transform statefulsets to frontend-expected format
		var response []types.StatefulSetListResponse
		for _, statefulSet := range statefulSetList.Items {
			response = append(response, transformers.TransformStatefulSetToResponse(&statefulSet))
		}

		h.tracingHelper.AddResourceAttributes(fetchSpan, "", "statefulsets", len(statefulSetList.Items))
		h.tracingHelper.RecordSuccess(fetchSpan, fmt.Sprintf("Listed %d statefulsets for SSE", len(statefulSetList.Items)))
		h.tracingHelper.AddResourceAttributes(transformSpan, "", "statefulsets", len(response))
		h.tracingHelper.RecordSuccess(transformSpan, fmt.Sprintf("Transformed %d statefulsets", len(response)))

		return response, nil
	}

	// Get initial data
	initialData, err := fetchStatefulSets()
	if err != nil {
		h.logger.WithError(err).Error("Failed to list statefulsets for SSE")
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
		h.sseHandler.SendSSEResponseWithUpdates(c, initialData, fetchStatefulSets)
		return
	}

	// For non-SSE requests, return JSON
	c.JSON(http.StatusOK, initialData)
}

// GetStatefulSet returns a specific statefulset
func (h *StatefulSetsHandler) GetStatefulSet(c *gin.Context) {
	// Start child span for client setup
	ctx, clientSpan := h.tracingHelper.StartAuthSpan(c.Request.Context(), "get-client-config")
	defer clientSpan.End()

	client, err := h.getClientAndConfig(c)
	if err != nil {
		h.logger.WithError(err).Error("Failed to get client for statefulset")
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
	_, k8sSpan := h.tracingHelper.StartKubernetesAPISpan(ctx, "get", "statefulset", namespace)
	defer k8sSpan.End()

	statefulSet, err := client.AppsV1().StatefulSets(namespace).Get(c.Request.Context(), name, metav1.GetOptions{})
	if err != nil {
		h.logger.WithError(err).WithField("statefulset", name).WithField("namespace", namespace).Error("Failed to get statefulset")
		h.tracingHelper.RecordError(k8sSpan, err, "Failed to get statefulset")
		// For EventSource, send error as SSE
		if c.GetHeader("Accept") == "text/event-stream" {
			h.sseHandler.SendSSEError(c, http.StatusNotFound, err.Error())
		} else {
			c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		}
		return
	}
	h.tracingHelper.AddResourceAttributes(k8sSpan, name, "statefulset", 1)
	h.tracingHelper.RecordSuccess(k8sSpan, fmt.Sprintf("Retrieved statefulset: %s", name))

	// Check if this is an SSE request (EventSource expects SSE format)
	acceptHeader := c.GetHeader("Accept")
	if acceptHeader == "text/event-stream" {
		h.sseHandler.SendSSEResponse(c, statefulSet)
		return
	}

	c.JSON(http.StatusOK, statefulSet)
}

// GetStatefulSetByName returns a specific statefulset by name
func (h *StatefulSetsHandler) GetStatefulSetByName(c *gin.Context) {
	// Start child span for client setup
	ctx, clientSpan := h.tracingHelper.StartAuthSpan(c.Request.Context(), "get-client-config")
	defer clientSpan.End()

	client, err := h.getClientAndConfig(c)
	if err != nil {
		h.logger.WithError(err).Error("Failed to get client for statefulset by name")
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
	_, k8sSpan := h.tracingHelper.StartKubernetesAPISpan(ctx, "get", "statefulset", namespace)
	defer k8sSpan.End()

	statefulSet, err := client.AppsV1().StatefulSets(namespace).Get(c.Request.Context(), name, metav1.GetOptions{})
	if err != nil {
		h.logger.WithError(err).WithField("statefulset", name).WithField("namespace", namespace).Error("Failed to get statefulset by name")
		h.tracingHelper.RecordError(k8sSpan, err, "Failed to get statefulset by name")
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}
	h.tracingHelper.AddResourceAttributes(k8sSpan, name, "statefulset", 1)
	h.tracingHelper.RecordSuccess(k8sSpan, fmt.Sprintf("Retrieved statefulset by name: %s", name))

	c.JSON(http.StatusOK, statefulSet)
}

// GetStatefulSetYAMLByName returns the YAML representation of a specific statefulset by name
func (h *StatefulSetsHandler) GetStatefulSetYAMLByName(c *gin.Context) {
	// Start child span for client setup
	ctx, clientSpan := h.tracingHelper.StartAuthSpan(c.Request.Context(), "get-client-config")
	defer clientSpan.End()

	client, err := h.getClientAndConfig(c)
	if err != nil {
		h.logger.WithError(err).Error("Failed to get client for statefulset YAML by name")
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
	_, k8sSpan := h.tracingHelper.StartKubernetesAPISpan(ctx, "get", "statefulset", namespace)
	defer k8sSpan.End()

	statefulSet, err := client.AppsV1().StatefulSets(namespace).Get(c.Request.Context(), name, metav1.GetOptions{})
	if err != nil {
		h.logger.WithError(err).WithField("statefulset", name).WithField("namespace", namespace).Error("Failed to get statefulset for YAML by name")
		h.tracingHelper.RecordError(k8sSpan, err, "Failed to get statefulset for YAML")
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}
	h.tracingHelper.AddResourceAttributes(k8sSpan, name, "statefulset", 1)
	h.tracingHelper.RecordSuccess(k8sSpan, fmt.Sprintf("Retrieved statefulset for YAML: %s", name))

	// Start child span for YAML generation
	_, yamlSpan := h.tracingHelper.StartDataProcessingSpan(ctx, "generate-yaml")
	defer yamlSpan.End()

	h.yamlHandler.SendYAMLResponse(c, statefulSet, name)
	h.tracingHelper.RecordSuccess(yamlSpan, "Generated YAML response")
}

// GetStatefulSetYAML returns the YAML representation of a specific statefulset
func (h *StatefulSetsHandler) GetStatefulSetYAML(c *gin.Context) {
	// Start child span for client setup
	ctx, clientSpan := h.tracingHelper.StartAuthSpan(c.Request.Context(), "get-client-config")
	defer clientSpan.End()

	client, err := h.getClientAndConfig(c)
	if err != nil {
		h.logger.WithError(err).Error("Failed to get client for statefulset YAML")
		h.tracingHelper.RecordError(clientSpan, err, "Failed to get Kubernetes client")
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	h.tracingHelper.RecordSuccess(clientSpan, "Kubernetes client setup completed")

	namespace := c.Param("namespace")
	name := c.Param("name")

	// Start child span for Kubernetes API call
	_, k8sSpan := h.tracingHelper.StartKubernetesAPISpan(ctx, "get", "statefulset", namespace)
	defer k8sSpan.End()

	statefulSet, err := client.AppsV1().StatefulSets(namespace).Get(c.Request.Context(), name, metav1.GetOptions{})
	if err != nil {
		h.logger.WithError(err).WithField("statefulset", name).WithField("namespace", namespace).Error("Failed to get statefulset for YAML")
		h.tracingHelper.RecordError(k8sSpan, err, "Failed to get statefulset for YAML")
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}
	h.tracingHelper.AddResourceAttributes(k8sSpan, name, "statefulset", 1)
	h.tracingHelper.RecordSuccess(k8sSpan, fmt.Sprintf("Retrieved statefulset for YAML: %s", name))

	// Start child span for YAML generation
	_, yamlSpan := h.tracingHelper.StartDataProcessingSpan(ctx, "generate-yaml")
	defer yamlSpan.End()

	h.yamlHandler.SendYAMLResponse(c, statefulSet, name)
	h.tracingHelper.RecordSuccess(yamlSpan, "Generated YAML response")
}

// GetStatefulSetEventsByName returns events for a specific statefulset by name
func (h *StatefulSetsHandler) GetStatefulSetEventsByName(c *gin.Context) {
	client, err := h.getClientAndConfig(c)
	if err != nil {
		h.logger.WithError(err).Error("Failed to get client for statefulset events")
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	name := c.Param("name")
	namespace := c.Query("namespace")

	if namespace == "" {
		h.logger.WithField("statefulset", name).Error("Namespace is required for statefulset events lookup")
		c.JSON(http.StatusBadRequest, gin.H{"error": "namespace parameter is required"})
		return
	}

	h.eventsHandler.GetResourceEventsWithNamespace(c, client, "StatefulSet", name, namespace, h.sseHandler.SendSSEResponse)
}

// GetStatefulSetEvents returns events for a specific statefulset
func (h *StatefulSetsHandler) GetStatefulSetEvents(c *gin.Context) {
	client, err := h.getClientAndConfig(c)
	if err != nil {
		h.logger.WithError(err).Error("Failed to get client for statefulset events")
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	name := c.Param("name")
	h.eventsHandler.GetResourceEvents(c, client, "StatefulSet", name, h.sseHandler.SendSSEResponse)
}

// GetStatefulSetPods returns pods for a specific statefulset
func (h *StatefulSetsHandler) GetStatefulSetPods(c *gin.Context) {
	client, err := h.getClientAndConfig(c)
	if err != nil {
		h.logger.WithError(err).Error("Failed to get client for statefulset pods")
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	namespace := c.Param("namespace")
	name := c.Param("name")

	// Get the statefulset to get its selector
	statefulSet, err := client.AppsV1().StatefulSets(namespace).Get(c.Request.Context(), name, metav1.GetOptions{})
	if err != nil {
		h.logger.WithError(err).WithField("statefulset", name).WithField("namespace", namespace).Error("Failed to get statefulset for pods")
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	// Create label selector from statefulset selector
	selector := ""
	if statefulSet.Spec.Selector != nil {
		selector = metav1.FormatLabelSelector(statefulSet.Spec.Selector)
	}

	// Get pods with the statefulset selector
	podList, err := client.CoreV1().Pods(namespace).List(c.Request.Context(), metav1.ListOptions{
		LabelSelector: selector,
	})
	if err != nil {
		h.logger.WithError(err).WithField("statefulset", name).WithField("namespace", namespace).Error("Failed to get statefulset pods")
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

// GetStatefulSetPodsByName returns pods for a specific statefulset by name
func (h *StatefulSetsHandler) GetStatefulSetPodsByName(c *gin.Context) {
	client, err := h.getClientAndConfig(c)
	if err != nil {
		h.logger.WithError(err).Error("Failed to get client for statefulset pods by name")
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	name := c.Param("name")
	namespace := c.Query("namespace")

	if namespace == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "namespace parameter is required"})
		return
	}

	// Get the statefulset to get its selector
	statefulSet, err := client.AppsV1().StatefulSets(namespace).Get(c.Request.Context(), name, metav1.GetOptions{})
	if err != nil {
		h.logger.WithError(err).WithField("statefulset", name).WithField("namespace", namespace).Error("Failed to get statefulset for pods by name")
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	// Create label selector from statefulset selector
	selector := ""
	if statefulSet.Spec.Selector != nil {
		selector = metav1.FormatLabelSelector(statefulSet.Spec.Selector)
	}

	// Get pods with the statefulset selector
	podList, err := client.CoreV1().Pods(namespace).List(c.Request.Context(), metav1.ListOptions{
		LabelSelector: selector,
	})
	if err != nil {
		h.logger.WithError(err).WithField("statefulset", name).WithField("namespace", namespace).Error("Failed to get statefulset pods by name")
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

// ScaleStatefulSet updates the replicas of a StatefulSet via the scale subresource
func (h *StatefulSetsHandler) ScaleStatefulSet(c *gin.Context) {
	// Start child span for client setup
	ctx, clientSpan := h.tracingHelper.StartAuthSpan(c.Request.Context(), "get-client-config")
	defer clientSpan.End()

	client, err := h.getClientAndConfig(c)
	if err != nil {
		h.logger.WithError(err).Error("Failed to get client for scaling statefulset")
		h.tracingHelper.RecordError(clientSpan, err, "Failed to get Kubernetes client")
		c.JSON(http.StatusBadRequest, gin.H{"message": err.Error(), "code": http.StatusBadRequest})
		return
	}
	h.tracingHelper.RecordSuccess(clientSpan, "Kubernetes client setup completed")

	name := c.Param("name")
	namespace := c.Query("namespace")
	if namespace == "" {
		c.JSON(http.StatusBadRequest, gin.H{"message": "namespace parameter is required", "code": http.StatusBadRequest})
		return
	}

	// Start child span for request parsing
	_, parseSpan := h.tracingHelper.StartDataProcessingSpan(ctx, "parse-scale-request")
	defer parseSpan.End()

	var body struct {
		Replicas int32 `json:"replicas"`
	}
	if err := c.BindJSON(&body); err != nil {
		h.tracingHelper.RecordError(parseSpan, err, "Failed to parse scale request")
		c.JSON(http.StatusBadRequest, gin.H{"message": "invalid request body", "code": http.StatusBadRequest})
		return
	}
	h.tracingHelper.RecordSuccess(parseSpan, fmt.Sprintf("Parsed scale request for %d replicas", body.Replicas))

	// Start child span for getting current scale
	_, getScaleSpan := h.tracingHelper.StartKubernetesAPISpan(ctx, "get-scale", "statefulset", namespace)
	defer getScaleSpan.End()

	scale, err := client.AppsV1().StatefulSets(namespace).GetScale(c.Request.Context(), name, metav1.GetOptions{})
	if err != nil {
		h.logger.WithError(err).WithField("statefulset", name).WithField("namespace", namespace).Error("Failed to get statefulset scale")
		h.tracingHelper.RecordError(getScaleSpan, err, "Failed to get statefulset scale")
		c.JSON(http.StatusBadRequest, gin.H{"message": err.Error(), "code": http.StatusBadRequest})
		return
	}
	h.tracingHelper.AddResourceAttributes(getScaleSpan, name, "statefulset", 1)
	h.tracingHelper.RecordSuccess(getScaleSpan, fmt.Sprintf("Retrieved current scale for statefulset: %s", name))

	// Start child span for updating scale
	_, updateScaleSpan := h.tracingHelper.StartKubernetesAPISpan(ctx, "update-scale", "statefulset", namespace)
	defer updateScaleSpan.End()

	scale.Spec.Replicas = body.Replicas
	if _, err := client.AppsV1().StatefulSets(namespace).UpdateScale(c.Request.Context(), name, scale, metav1.UpdateOptions{}); err != nil {
		h.logger.WithError(err).WithField("statefulset", name).WithField("namespace", namespace).Error("Failed to update statefulset scale")
		h.tracingHelper.RecordError(updateScaleSpan, err, "Failed to update statefulset scale")
		c.JSON(http.StatusBadRequest, gin.H{"message": err.Error(), "code": http.StatusBadRequest})
		return
	}
	h.tracingHelper.AddResourceAttributes(updateScaleSpan, name, "statefulset", int(body.Replicas))
	h.tracingHelper.RecordSuccess(updateScaleSpan, fmt.Sprintf("Scaled statefulset %s to %d replicas", name, body.Replicas))

	c.JSON(http.StatusOK, gin.H{"message": "StatefulSet Scaled"})
}

// RestartStatefulSet restarts all pods in a statefulset by adding a restart annotation
func (h *StatefulSetsHandler) RestartStatefulSet(c *gin.Context) {
	// Start child span for client setup
	ctx, clientSpan := h.tracingHelper.StartAuthSpan(c.Request.Context(), "get-client-config")
	defer clientSpan.End()

	client, err := h.getClientAndConfig(c)
	if err != nil {
		h.logger.WithError(err).Error("Failed to get client for restarting statefulset")
		h.tracingHelper.RecordError(clientSpan, err, "Failed to get Kubernetes client")
		c.JSON(http.StatusBadRequest, gin.H{"message": err.Error(), "code": http.StatusBadRequest})
		return
	}
	h.tracingHelper.RecordSuccess(clientSpan, "Kubernetes client setup completed")

	name := c.Param("name")
	namespace := c.Query("namespace")
	if namespace == "" {
		c.JSON(http.StatusBadRequest, gin.H{"message": "namespace parameter is required", "code": http.StatusBadRequest})
		return
	}

	// Start child span for request parsing
	_, parseSpan := h.tracingHelper.StartDataProcessingSpan(ctx, "parse-restart-request")
	defer parseSpan.End()

	var body struct {
		RestartType string `json:"restartType"` // "rolling" or "recreate"
	}
	if err := c.BindJSON(&body); err != nil {
		// Default to rolling restart if no body provided
		body.RestartType = "rolling"
	}

	// Validate restart type
	if body.RestartType != "rolling" && body.RestartType != "recreate" {
		h.tracingHelper.RecordError(parseSpan, fmt.Errorf("invalid restart type: %s", body.RestartType), "Invalid restart type")
		c.JSON(http.StatusBadRequest, gin.H{"message": "restartType must be 'rolling' or 'recreate'", "code": http.StatusBadRequest})
		return
	}
	h.tracingHelper.RecordSuccess(parseSpan, fmt.Sprintf("Parsed restart request with type: %s", body.RestartType))

	// Start child span for restart operation
	_, restartSpan := h.tracingHelper.StartKubernetesAPISpan(ctx, "restart", "statefulset", namespace)
	defer restartSpan.End()

	if body.RestartType == "rolling" {
		// Rolling restart: Add restart annotation to trigger gradual pod replacement
		err = h.performRollingRestart(client, name, namespace)
		if err != nil {
			h.logger.WithError(err).WithField("statefulset", name).WithField("namespace", namespace).Error("Failed to perform rolling restart")
			h.tracingHelper.RecordError(restartSpan, err, "Failed to perform rolling restart")
			c.JSON(http.StatusBadRequest, gin.H{"message": err.Error(), "code": http.StatusBadRequest})
			return
		}
		h.tracingHelper.AddResourceAttributes(restartSpan, name, "statefulset", 1)
		h.tracingHelper.RecordSuccess(restartSpan, fmt.Sprintf("Rolling restart initiated for statefulset: %s", name))
		c.JSON(http.StatusOK, gin.H{"message": "Rolling restart initiated - pods will be replaced gradually while maintaining availability"})
	} else {
		// Recreate restart: Set replicas to 0, then back to original count
		err = h.performRecreateRestart(client, name, namespace)
		if err != nil {
			h.logger.WithError(err).WithField("statefulset", name).WithField("namespace", namespace).Error("Failed to perform recreate restart")
			h.tracingHelper.RecordError(restartSpan, err, "Failed to perform recreate restart")
			c.JSON(http.StatusBadRequest, gin.H{"message": err.Error(), "code": http.StatusBadRequest})
			return
		}
		h.tracingHelper.AddResourceAttributes(restartSpan, name, "statefulset", 1)
		h.tracingHelper.RecordSuccess(restartSpan, fmt.Sprintf("Recreate restart initiated for statefulset: %s", name))
		c.JSON(http.StatusOK, gin.H{"message": "Recreate restart initiated - pods will be restarted in the background"})
	}
}

// performRollingRestart performs a rolling restart by adding a restart annotation
func (h *StatefulSetsHandler) performRollingRestart(client *kubernetes.Clientset, name, namespace string) error {
	// Get the current statefulset
	statefulSet, err := client.AppsV1().StatefulSets(namespace).Get(context.Background(), name, metav1.GetOptions{})
	if err != nil {
		return fmt.Errorf("failed to get statefulset: %w", err)
	}

	// Add restart annotation to pod template
	if statefulSet.Spec.Template.Annotations == nil {
		statefulSet.Spec.Template.Annotations = make(map[string]string)
	}
	statefulSet.Spec.Template.Annotations["kubectl.kubernetes.io/restartedAt"] = time.Now().Format(time.RFC3339)

	// Update the statefulset
	_, err = client.AppsV1().StatefulSets(namespace).Update(context.Background(), statefulSet, metav1.UpdateOptions{})
	if err != nil {
		return fmt.Errorf("failed to update statefulset with restart annotation: %w", err)
	}

	return nil
}

// performRecreateRestart performs a recreate restart by scaling to 0 and back
func (h *StatefulSetsHandler) performRecreateRestart(client *kubernetes.Clientset, name, namespace string) error {
	// Get the current statefulset
	statefulSet, err := client.AppsV1().StatefulSets(namespace).Get(context.Background(), name, metav1.GetOptions{})
	if err != nil {
		return fmt.Errorf("failed to get statefulset: %w", err)
	}

	// Store original replica count
	originalReplicas := *statefulSet.Spec.Replicas

	// Scale to 0
	if err := h.scaleStatefulSetWithRetry(client, name, namespace, 0); err != nil {
		return fmt.Errorf("failed to scale statefulset to 0: %w", err)
	}

	// Wait a moment for pods to terminate
	time.Sleep(2 * time.Second)

	// Scale back to original count in a goroutine to avoid blocking the response
	go func() {
		time.Sleep(5 * time.Second) // Wait for pods to fully terminate
		if err := h.scaleStatefulSetWithRetry(client, name, namespace, originalReplicas); err != nil {
			h.logger.WithError(err).WithField("statefulset", name).WithField("namespace", namespace).Error("Failed to scale statefulset back to original count")
		}
	}()

	return nil
}

// scaleStatefulSetWithRetry scales a statefulset with retry logic for conflict errors
func (h *StatefulSetsHandler) scaleStatefulSetWithRetry(client *kubernetes.Clientset, name, namespace string, replicas int32) error {
	for i := 0; i < 5; i++ {
		scale, err := client.AppsV1().StatefulSets(namespace).GetScale(context.Background(), name, metav1.GetOptions{})
		if err != nil {
			return fmt.Errorf("failed to get statefulset scale: %w", err)
		}

		scale.Spec.Replicas = replicas
		_, err = client.AppsV1().StatefulSets(namespace).UpdateScale(context.Background(), name, scale, metav1.UpdateOptions{})
		if err == nil {
			return nil
		}

		// If it's a conflict error, retry after a short delay
		if isStatefulSetConflictError(err) {
			time.Sleep(time.Duration(i+1) * 100 * time.Millisecond)
			continue
		}

		return fmt.Errorf("failed to update statefulset scale: %w", err)
	}

	return fmt.Errorf("failed to scale statefulset after 5 retries")
}

// isStatefulSetConflictError checks if the error is a conflict error
func isStatefulSetConflictError(err error) bool {
	if err == nil {
		return false
	}
	return err.Error() == "Operation cannot be fulfilled on statefulsets.apps \"\" the object has been modified; please apply your changes to the latest version and try again"
}
