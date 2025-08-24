package storage

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
	corev1 "k8s.io/api/core/v1"
	"k8s.io/apimachinery/pkg/api/resource"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/client-go/kubernetes"
)

// PersistentVolumeClaimsHandler handles PersistentVolumeClaim-related operations
type PersistentVolumeClaimsHandler struct {
	store         *storage.KubeConfigStore
	clientFactory *k8s.ClientFactory
	logger        *logger.Logger
	eventsHandler *utils.EventsHandler
	yamlHandler   *utils.YAMLHandler
	sseHandler    *utils.SSEHandler
	tracingHelper *tracing.TracingHelper
}

// NewPersistentVolumeClaimsHandler creates a new PersistentVolumeClaims handler
func NewPersistentVolumeClaimsHandler(store *storage.KubeConfigStore, clientFactory *k8s.ClientFactory, log *logger.Logger) *PersistentVolumeClaimsHandler {
	return &PersistentVolumeClaimsHandler{
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
func (h *PersistentVolumeClaimsHandler) getClientAndConfig(c *gin.Context) (*kubernetes.Clientset, error) {
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

// GetPersistentVolumeClaimsSSE returns persistent volume claims as Server-Sent Events with real-time updates
// @Summary Get Persistent Volume Claims (SSE)
// @Description Get all persistent volume claims with real-time updates via Server-Sent Events
// @Tags Storage
// @Accept json
// @Produce text/event-stream
// @Param config query string true "Kubernetes configuration ID"
// @Param cluster query string false "Cluster name"
// @Param namespace query string false "Namespace filter"
// @Success 200 {array} types.PersistentVolumeClaimListResponse "Stream of PVC data"
// @Failure 400 {object} map[string]string "Bad request"
// @Failure 500 {object} map[string]string "Internal server error"
// @Security KubeConfig
// @Router /api/v1/persistentvolumeclaims [get]
func (h *PersistentVolumeClaimsHandler) GetPersistentVolumeClaimsSSE(c *gin.Context) {
	// Start child span for client setup
	ctx, clientSpan := h.tracingHelper.StartAuthSpan(c.Request.Context(), "setup-client-for-sse")
	defer clientSpan.End()

	client, err := h.getClientAndConfig(c)
	if err != nil {
		h.logger.WithError(err).Error("Failed to get client for persistent volume claims SSE")
		h.tracingHelper.RecordError(clientSpan, err, "Failed to get client for persistent volume claims SSE")
		h.sseHandler.SendSSEError(c, http.StatusBadRequest, err.Error())
		return
	}
	h.tracingHelper.RecordSuccess(clientSpan, "Client setup completed for persistent volume claims SSE")

	namespace := c.Query("namespace")

	// Function to fetch persistent volume claims data
	fetchPVCs := func() (interface{}, error) {
		// Start child span for Kubernetes API call
		_, k8sSpan := h.tracingHelper.StartKubernetesAPISpan(ctx, "list", "persistentvolumeclaim", namespace)
		defer k8sSpan.End()

		pvcs, err := client.CoreV1().PersistentVolumeClaims(namespace).List(ctx, metav1.ListOptions{})
		if err != nil {
			h.tracingHelper.RecordError(k8sSpan, err, "Failed to list persistent volume claims")
			return nil, err
		}
		h.tracingHelper.AddResourceAttributes(k8sSpan, "persistent-volume-claims", "persistentvolumeclaim", len(pvcs.Items))
		h.tracingHelper.RecordSuccess(k8sSpan, "Successfully listed persistent volume claims")

		// Start child span for data processing
		_, processSpan := h.tracingHelper.StartDataProcessingSpan(ctx, "transform-data")
		defer processSpan.End()

		// Transform persistent volume claims to frontend-expected format
		responses := make([]types.PersistentVolumeClaimListResponse, len(pvcs.Items))
		for i, pvc := range pvcs.Items {
			responses[i] = transformers.TransformPVCToResponse(&pvc)
		}
		h.tracingHelper.RecordSuccess(processSpan, "Successfully transformed persistent volume claims data")

		return responses, nil
	}

	// Get initial data
	initialData, err := fetchPVCs()
	if err != nil {
		h.logger.WithError(err).Error("Failed to list persistent volume claims for SSE")
		// Check if this is a permission error
		if utils.IsPermissionError(err) {
			h.sseHandler.SendSSEPermissionError(c, err)
		} else {
			h.sseHandler.SendSSEError(c, http.StatusInternalServerError, err.Error())
		}
		return
	}

	// Send SSE response with periodic updates
	h.sseHandler.SendSSEResponseWithUpdates(c, initialData, fetchPVCs)
}

// GetPVC returns a specific persistent volume claim
func (h *PersistentVolumeClaimsHandler) GetPVC(c *gin.Context) {
	// Start child span for client setup
	ctx, clientSpan := h.tracingHelper.StartAuthSpan(c.Request.Context(), "setup-client")
	defer clientSpan.End()

	client, err := h.getClientAndConfig(c)
	if err != nil {
		h.logger.WithError(err).Error("Failed to get client for persistent volume claim")
		h.tracingHelper.RecordError(clientSpan, err, "Failed to get client for persistent volume claim")
		// For EventSource, send error as SSE
		if c.GetHeader("Accept") == "text/event-stream" {
			h.sseHandler.SendSSEError(c, http.StatusBadRequest, err.Error())
		} else {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		}
		return
	}
	h.tracingHelper.RecordSuccess(clientSpan, "Client setup completed for persistent volume claim")

	namespace := c.Param("namespace")
	name := c.Param("name")

	// Start child span for Kubernetes API call
	_, k8sSpan := h.tracingHelper.StartKubernetesAPISpan(ctx, "get", "persistentvolumeclaim", namespace)
	defer k8sSpan.End()

	pvc, err := client.CoreV1().PersistentVolumeClaims(namespace).Get(ctx, name, metav1.GetOptions{})
	if err != nil {
		h.logger.WithError(err).WithField("pvc", name).WithField("namespace", namespace).Error("Failed to get persistent volume claim")
		h.tracingHelper.RecordError(k8sSpan, err, "Failed to get persistent volume claim")
		// For EventSource, send error as SSE
		if c.GetHeader("Accept") == "text/event-stream" {
			h.sseHandler.SendSSEError(c, http.StatusNotFound, err.Error())
		} else {
			c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		}
		return
	}
	h.tracingHelper.AddResourceAttributes(k8sSpan, name, "persistentvolumeclaim", 1)
	h.tracingHelper.RecordSuccess(k8sSpan, "Successfully retrieved persistent volume claim")

	// Check if this is an SSE request (EventSource expects SSE format)
	acceptHeader := c.GetHeader("Accept")
	if acceptHeader == "text/event-stream" {
		h.sseHandler.SendSSEResponse(c, pvc)
		return
	}

	c.JSON(http.StatusOK, pvc)
}

// GetPVCByName returns a specific persistent volume claim by name
func (h *PersistentVolumeClaimsHandler) GetPVCByName(c *gin.Context) {
	// Start child span for client setup
	ctx, clientSpan := h.tracingHelper.StartAuthSpan(c.Request.Context(), "setup-client")
	defer clientSpan.End()

	client, err := h.getClientAndConfig(c)
	if err != nil {
		h.logger.WithError(err).Error("Failed to get client for persistent volume claim by name")
		h.tracingHelper.RecordError(clientSpan, err, "Failed to get client for persistent volume claim by name")
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	h.tracingHelper.RecordSuccess(clientSpan, "Client setup completed for persistent volume claim by name")

	name := c.Param("name")
	namespace := c.Query("namespace")

	if namespace == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "namespace parameter is required"})
		return
	}

	// Start child span for Kubernetes API call
	_, k8sSpan := h.tracingHelper.StartKubernetesAPISpan(ctx, "get", "persistentvolumeclaim", namespace)
	defer k8sSpan.End()

	pvc, err := client.CoreV1().PersistentVolumeClaims(namespace).Get(ctx, name, metav1.GetOptions{})
	if err != nil {
		h.logger.WithError(err).WithField("pvc", name).WithField("namespace", namespace).Error("Failed to get persistent volume claim by name")
		h.tracingHelper.RecordError(k8sSpan, err, "Failed to get persistent volume claim by name")
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}
	h.tracingHelper.AddResourceAttributes(k8sSpan, name, "persistentvolumeclaim", 1)
	h.tracingHelper.RecordSuccess(k8sSpan, "Successfully retrieved persistent volume claim by name")

	c.JSON(http.StatusOK, pvc)
}

// GetPVCYAMLByName returns the YAML representation of a specific persistent volume claim by name
func (h *PersistentVolumeClaimsHandler) GetPVCYAMLByName(c *gin.Context) {
	// Start child span for client setup
	ctx, clientSpan := h.tracingHelper.StartAuthSpan(c.Request.Context(), "setup-client")
	defer clientSpan.End()

	client, err := h.getClientAndConfig(c)
	if err != nil {
		h.logger.WithError(err).Error("Failed to get client for persistent volume claim YAML by name")
		h.tracingHelper.RecordError(clientSpan, err, "Failed to get client for persistent volume claim YAML by name")
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	h.tracingHelper.RecordSuccess(clientSpan, "Client setup completed for persistent volume claim YAML by name")

	name := c.Param("name")
	namespace := c.Query("namespace")

	if namespace == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "namespace parameter is required"})
		return
	}

	// Start child span for Kubernetes API call
	_, k8sSpan := h.tracingHelper.StartKubernetesAPISpan(ctx, "get", "persistentvolumeclaim", namespace)
	defer k8sSpan.End()

	pvc, err := client.CoreV1().PersistentVolumeClaims(namespace).Get(ctx, name, metav1.GetOptions{})
	if err != nil {
		h.logger.WithError(err).WithField("pvc", name).WithField("namespace", namespace).Error("Failed to get persistent volume claim for YAML by name")
		h.tracingHelper.RecordError(k8sSpan, err, "Failed to get persistent volume claim for YAML by name")
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}
	h.tracingHelper.AddResourceAttributes(k8sSpan, name, "persistentvolumeclaim", 1)
	h.tracingHelper.RecordSuccess(k8sSpan, "Successfully retrieved persistent volume claim for YAML by name")

	// Start child span for YAML generation
	_, yamlSpan := h.tracingHelper.StartDataProcessingSpan(ctx, "generate-yaml")
	defer yamlSpan.End()

	h.yamlHandler.SendYAMLResponse(c, pvc, name)
	h.tracingHelper.RecordSuccess(yamlSpan, "Successfully generated YAML for persistent volume claim")
}

// GetPVCYAML returns the YAML representation of a specific persistent volume claim
func (h *PersistentVolumeClaimsHandler) GetPVCYAML(c *gin.Context) {
	// Start child span for client setup
	ctx, clientSpan := h.tracingHelper.StartAuthSpan(c.Request.Context(), "setup-client")
	defer clientSpan.End()

	client, err := h.getClientAndConfig(c)
	if err != nil {
		h.logger.WithError(err).Error("Failed to get client for persistent volume claim YAML")
		h.tracingHelper.RecordError(clientSpan, err, "Failed to get client for persistent volume claim YAML")
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	h.tracingHelper.RecordSuccess(clientSpan, "Client setup completed for persistent volume claim YAML")

	namespace := c.Param("namespace")
	name := c.Param("name")

	// Start child span for Kubernetes API call
	_, k8sSpan := h.tracingHelper.StartKubernetesAPISpan(ctx, "get", "persistentvolumeclaim", namespace)
	defer k8sSpan.End()

	pvc, err := client.CoreV1().PersistentVolumeClaims(namespace).Get(ctx, name, metav1.GetOptions{})
	if err != nil {
		h.logger.WithError(err).WithField("pvc", name).WithField("namespace", namespace).Error("Failed to get persistent volume claim for YAML")
		h.tracingHelper.RecordError(k8sSpan, err, "Failed to get persistent volume claim for YAML")
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}
	h.tracingHelper.AddResourceAttributes(k8sSpan, name, "persistentvolumeclaim", 1)
	h.tracingHelper.RecordSuccess(k8sSpan, "Successfully retrieved persistent volume claim for YAML")

	// Start child span for YAML generation
	_, yamlSpan := h.tracingHelper.StartDataProcessingSpan(ctx, "generate-yaml")
	defer yamlSpan.End()

	h.yamlHandler.SendYAMLResponse(c, pvc, name)
	h.tracingHelper.RecordSuccess(yamlSpan, "Successfully generated YAML for persistent volume claim")
}

// GetPVCEventsByName returns events for a specific persistent volume claim by name
func (h *PersistentVolumeClaimsHandler) GetPVCEventsByName(c *gin.Context) {
	// Start child span for client setup
	ctx, clientSpan := h.tracingHelper.StartAuthSpan(c.Request.Context(), "setup-client")
	defer clientSpan.End()

	client, err := h.getClientAndConfig(c)
	if err != nil {
		h.logger.WithError(err).Error("Failed to get client for persistent volume claim events")
		h.tracingHelper.RecordError(clientSpan, err, "Failed to get client for persistent volume claim events")
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	h.tracingHelper.RecordSuccess(clientSpan, "Client setup completed for persistent volume claim events")

	name := c.Param("name")
	namespace := c.Query("namespace")

	if namespace == "" {
		h.logger.WithField("pvc", name).Error("Namespace is required for persistent volume claim events lookup")
		c.JSON(http.StatusBadRequest, gin.H{"error": "namespace parameter is required"})
		return
	}

	// Start child span for events retrieval
	_, eventsSpan := h.tracingHelper.StartKubernetesAPISpan(ctx, "list", "events", namespace)
	defer eventsSpan.End()

	h.eventsHandler.GetResourceEventsWithNamespace(c, client, "PersistentVolumeClaim", name, namespace, h.sseHandler.SendSSEResponse)
	h.tracingHelper.RecordSuccess(eventsSpan, "Successfully retrieved events for persistent volume claim")
}

// GetPVCEvents returns events for a specific persistent volume claim
func (h *PersistentVolumeClaimsHandler) GetPVCEvents(c *gin.Context) {
	// Start child span for client setup
	ctx, clientSpan := h.tracingHelper.StartAuthSpan(c.Request.Context(), "setup-client")
	defer clientSpan.End()

	client, err := h.getClientAndConfig(c)
	if err != nil {
		h.logger.WithError(err).Error("Failed to get client for persistent volume claim events")
		h.tracingHelper.RecordError(clientSpan, err, "Failed to get client for persistent volume claim events")
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	h.tracingHelper.RecordSuccess(clientSpan, "Client setup completed for persistent volume claim events")

	name := c.Param("name")

	// Start child span for events retrieval
	_, eventsSpan := h.tracingHelper.StartKubernetesAPISpan(ctx, "list", "events", "")
	defer eventsSpan.End()

	h.eventsHandler.GetResourceEvents(c, client, "PersistentVolumeClaim", name, h.sseHandler.SendSSEResponse)
	h.tracingHelper.RecordSuccess(eventsSpan, "Successfully retrieved events for persistent volume claim")
}

// ScalePVC scales a persistent volume claim to a new size
func (h *PersistentVolumeClaimsHandler) ScalePVC(c *gin.Context) {
	// Start child span for client setup
	ctx, clientSpan := h.tracingHelper.StartAuthSpan(c.Request.Context(), "setup-client")
	defer clientSpan.End()

	client, err := h.getClientAndConfig(c)
	if err != nil {
		h.logger.WithError(err).Error("Failed to get client for PVC scaling")
		h.tracingHelper.RecordError(clientSpan, err, "Failed to get client for PVC scaling")
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	h.tracingHelper.RecordSuccess(clientSpan, "Client setup completed for PVC scaling")

	namespace := c.Param("namespace")
	name := c.Param("name")

	// Start child span for data processing
	_, processSpan := h.tracingHelper.StartDataProcessingSpan(ctx, "parse-request")
	defer processSpan.End()

	// Parse request body
	var request struct {
		Size string `json:"size" binding:"required"`
	}

	if err := c.ShouldBindJSON(&request); err != nil {
		h.logger.WithError(err).Error("Failed to parse PVC scale request")
		h.tracingHelper.RecordError(processSpan, err, "Failed to parse PVC scale request")
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request body"})
		return
	}
	h.tracingHelper.RecordSuccess(processSpan, "Successfully parsed PVC scale request")

	// Start child span for Kubernetes API call to get current PVC
	_, getSpan := h.tracingHelper.StartKubernetesAPISpan(ctx, "get", "persistentvolumeclaim", namespace)
	defer getSpan.End()

	// Get current PVC
	pvc, err := client.CoreV1().PersistentVolumeClaims(namespace).Get(ctx, name, metav1.GetOptions{})
	if err != nil {
		h.logger.WithError(err).WithField("pvc", name).WithField("namespace", namespace).Error("Failed to get PVC for scaling")
		h.tracingHelper.RecordError(getSpan, err, "Failed to get PVC for scaling")
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}
	h.tracingHelper.AddResourceAttributes(getSpan, name, "persistentvolumeclaim", 1)
	h.tracingHelper.RecordSuccess(getSpan, "Successfully retrieved PVC for scaling")

	// Get current size
	currentSize := pvc.Spec.Resources.Requests.Storage()
	if currentSize == nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Current PVC size cannot be determined"})
		return
	}

	// Parse new size
	newSize, err := resource.ParseQuantity(request.Size)
	if err != nil {
		h.logger.WithError(err).Error("Failed to parse new size")
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid size format"})
		return
	}

	// Validate that new size is greater than current size
	if newSize.Cmp(*currentSize) <= 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "New size must be greater than current size"})
		return
	}

	// Update PVC spec with new size
	pvc.Spec.Resources.Requests[corev1.ResourceStorage] = newSize

	// Start child span for Kubernetes API call to update PVC
	_, updateSpan := h.tracingHelper.StartKubernetesAPISpan(ctx, "update", "persistentvolumeclaim", namespace)
	defer updateSpan.End()

	// Apply the update
	updatedPVC, err := client.CoreV1().PersistentVolumeClaims(namespace).Update(ctx, pvc, metav1.UpdateOptions{})
	if err != nil {
		h.logger.WithError(err).WithField("pvc", name).WithField("namespace", namespace).Error("Failed to update PVC size")
		h.tracingHelper.RecordError(updateSpan, err, "Failed to update PVC size")
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	h.tracingHelper.AddResourceAttributes(updateSpan, name, "persistentvolumeclaim", 1)
	h.tracingHelper.RecordSuccess(updateSpan, "Successfully updated PVC size")

	h.logger.WithField("pvc", name).WithField("namespace", namespace).WithField("oldSize", currentSize.String()).WithField("newSize", newSize.String()).Info("PVC scaled successfully")

	c.JSON(http.StatusOK, gin.H{
		"message": "PVC scaled successfully",
		"pvc":     updatedPVC,
	})
}

// podUsesPVC checks if a pod uses the specified PVC
func (h *PersistentVolumeClaimsHandler) podUsesPVC(pod *corev1.Pod, pvcName string) bool {
	// Check volumes in pod spec
	for _, volume := range pod.Spec.Volumes {
		if volume.PersistentVolumeClaim != nil && volume.PersistentVolumeClaim.ClaimName == pvcName {
			return true
		}
	}
	return false
}

// GetPVCPods returns pods for a specific persistent volume claim
func (h *PersistentVolumeClaimsHandler) GetPVCPods(c *gin.Context) {
	// Start child span for client setup
	ctx, clientSpan := h.tracingHelper.StartAuthSpan(c.Request.Context(), "setup-client")
	defer clientSpan.End()

	client, err := h.getClientAndConfig(c)
	if err != nil {
		h.logger.WithError(err).Error("Failed to get client for PVC pods")
		h.tracingHelper.RecordError(clientSpan, err, "Failed to get client for PVC pods")
		// For EventSource, send error as SSE
		if c.GetHeader("Accept") == "text/event-stream" {
			h.sseHandler.SendSSEError(c, http.StatusBadRequest, err.Error())
		} else {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		}
		return
	}
	h.tracingHelper.RecordSuccess(clientSpan, "Client setup completed for PVC pods")

	namespace := c.Param("namespace")
	name := c.Param("name")

	// Function to fetch pods that use this PVC
	fetchPods := func() (interface{}, error) {
		// Start child span for Kubernetes API call
		_, k8sSpan := h.tracingHelper.StartKubernetesAPISpan(ctx, "list", "pods", namespace)
		defer k8sSpan.End()

		// Get all pods in the namespace
		podList, err := client.CoreV1().Pods(namespace).List(ctx, metav1.ListOptions{})
		if err != nil {
			h.tracingHelper.RecordError(k8sSpan, err, "Failed to list pods for PVC")
			return nil, err
		}
		h.tracingHelper.AddResourceAttributes(k8sSpan, "", "pods", len(podList.Items))
		h.tracingHelper.RecordSuccess(k8sSpan, "Successfully listed pods for PVC")

		// Start child span for data processing
		_, processSpan := h.tracingHelper.StartDataProcessingSpan(ctx, "filter-pods")
		defer processSpan.End()

		// Filter pods that use this PVC
		configID := c.Query("config")
		clusterName := c.Query("cluster")
		var response []types.PodListResponse
		for _, pod := range podList.Items {
			if h.podUsesPVC(&pod, name) {
				response = append(response, transformers.TransformPodToResponse(&pod, configID, clusterName))
			}
		}
		h.tracingHelper.RecordSuccess(processSpan, "Successfully filtered pods for PVC")

		return response, nil
	}

	// Check if this is an SSE request (EventSource expects SSE format)
	acceptHeader := c.GetHeader("Accept")
	if acceptHeader == "text/event-stream" {
		// Get initial data
		initialData, err := fetchPods()
		if err != nil {
			h.logger.WithError(err).WithField("pvc", name).WithField("namespace", namespace).Error("Failed to get PVC pods for SSE")
			// Check if this is a permission error
			if utils.IsPermissionError(err) {
				h.sseHandler.SendSSEPermissionError(c, err)
			} else {
				h.sseHandler.SendSSEError(c, http.StatusInternalServerError, err.Error())
			}
			return
		}

		// Send SSE response with periodic updates
		h.sseHandler.SendSSEResponseWithUpdates(c, initialData, fetchPods)
		return
	}

	// For non-SSE requests, return JSON
	data, err := fetchPods()
	if err != nil {
		h.logger.WithError(err).WithField("pvc", name).WithField("namespace", namespace).Error("Failed to get PVC pods")
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, data)
}

// GetPVCPodsByName returns pods for a specific persistent volume claim by name
func (h *PersistentVolumeClaimsHandler) GetPVCPodsByName(c *gin.Context) {
	// Start child span for client setup
	ctx, clientSpan := h.tracingHelper.StartAuthSpan(c.Request.Context(), "setup-client")
	defer clientSpan.End()

	client, err := h.getClientAndConfig(c)
	if err != nil {
		h.logger.WithError(err).Error("Failed to get client for PVC pods by name")
		h.tracingHelper.RecordError(clientSpan, err, "Failed to get client for PVC pods by name")
		// For EventSource, send error as SSE
		if c.GetHeader("Accept") == "text/event-stream" {
			h.sseHandler.SendSSEError(c, http.StatusBadRequest, err.Error())
		} else {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		}
		return
	}
	h.tracingHelper.RecordSuccess(clientSpan, "Client setup completed for PVC pods by name")

	name := c.Param("name")
	namespace := c.Query("namespace")

	if namespace == "" {
		h.logger.WithField("pvc", name).Error("Namespace is required for PVC pods lookup")
		if c.GetHeader("Accept") == "text/event-stream" {
			h.sseHandler.SendSSEError(c, http.StatusBadRequest, "namespace parameter is required")
		} else {
			c.JSON(http.StatusBadRequest, gin.H{"error": "namespace parameter is required"})
		}
		return
	}

	// Function to fetch pods that use this PVC
	fetchPods := func() (interface{}, error) {
		// Start child span for Kubernetes API call
		_, k8sSpan := h.tracingHelper.StartKubernetesAPISpan(ctx, "list", "pods", namespace)
		defer k8sSpan.End()

		// Get all pods in the namespace
		podList, err := client.CoreV1().Pods(namespace).List(ctx, metav1.ListOptions{})
		if err != nil {
			h.tracingHelper.RecordError(k8sSpan, err, "Failed to list pods for PVC by name")
			return nil, err
		}
		h.tracingHelper.AddResourceAttributes(k8sSpan, "", "pods", len(podList.Items))
		h.tracingHelper.RecordSuccess(k8sSpan, "Successfully listed pods for PVC by name")

		// Start child span for data processing
		_, processSpan := h.tracingHelper.StartDataProcessingSpan(ctx, "filter-pods")
		defer processSpan.End()

		// Filter pods that use this PVC
		configID := c.Query("config")
		clusterName := c.Query("cluster")
		var response []types.PodListResponse
		for _, pod := range podList.Items {
			if h.podUsesPVC(&pod, name) {
				response = append(response, transformers.TransformPodToResponse(&pod, configID, clusterName))
			}
		}
		h.tracingHelper.RecordSuccess(processSpan, "Successfully filtered pods for PVC by name")

		return response, nil
	}

	// Check if this is an SSE request (EventSource expects SSE format)
	acceptHeader := c.GetHeader("Accept")
	if acceptHeader == "text/event-stream" {
		// Get initial data
		initialData, err := fetchPods()
		if err != nil {
			h.logger.WithError(err).WithField("pvc", name).WithField("namespace", namespace).Error("Failed to get PVC pods by name for SSE")
			// Check if this is a permission error
			if utils.IsPermissionError(err) {
				h.sseHandler.SendSSEPermissionError(c, err)
			} else {
				h.sseHandler.SendSSEError(c, http.StatusInternalServerError, err.Error())
			}
			return
		}

		// Send SSE response with periodic updates
		h.sseHandler.SendSSEResponseWithUpdates(c, initialData, fetchPods)
		return
	}

	// For non-SSE requests, return JSON
	data, err := fetchPods()
	if err != nil {
		h.logger.WithError(err).WithField("pvc", name).WithField("namespace", namespace).Error("Failed to get PVC pods by name")
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, data)
}
