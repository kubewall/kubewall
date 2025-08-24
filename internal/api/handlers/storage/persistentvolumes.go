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
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/client-go/kubernetes"
)

// PersistentVolumesHandler handles PersistentVolume-related operations
type PersistentVolumesHandler struct {
	store         *storage.KubeConfigStore
	clientFactory *k8s.ClientFactory
	logger        *logger.Logger
	eventsHandler *utils.EventsHandler
	yamlHandler   *utils.YAMLHandler
	sseHandler    *utils.SSEHandler
	tracingHelper *tracing.TracingHelper
}

// NewPersistentVolumesHandler creates a new PersistentVolumes handler
func NewPersistentVolumesHandler(store *storage.KubeConfigStore, clientFactory *k8s.ClientFactory, log *logger.Logger) *PersistentVolumesHandler {
	return &PersistentVolumesHandler{
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
func (h *PersistentVolumesHandler) getClientAndConfig(c *gin.Context) (*kubernetes.Clientset, error) {
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

// GetPersistentVolumesSSE returns persistent volumes as Server-Sent Events with real-time updates
// @Summary Get Persistent Volumes (SSE)
// @Description Get all persistent volumes with real-time updates via Server-Sent Events
// @Tags Storage
// @Accept json
// @Produce text/event-stream
// @Param config query string true "Kubernetes configuration ID"
// @Param cluster query string false "Cluster name"
// @Success 200 {array} types.PersistentVolumeListResponse "Stream of PV data"
// @Failure 400 {object} map[string]string "Bad request"
// @Failure 500 {object} map[string]string "Internal server error"
// @Security KubeConfig
// @Router /api/v1/persistentvolumes [get]
func (h *PersistentVolumesHandler) GetPersistentVolumesSSE(c *gin.Context) {
	// Start child span for client setup
	ctx, clientSpan := h.tracingHelper.StartAuthSpan(c.Request.Context(), "setup-client-for-sse")
	defer clientSpan.End()

	client, err := h.getClientAndConfig(c)
	if err != nil {
		h.logger.WithError(err).Error("Failed to get client for persistent volumes SSE")
		h.tracingHelper.RecordError(clientSpan, err, "Failed to get client for persistent volumes SSE")
		h.sseHandler.SendSSEError(c, http.StatusBadRequest, err.Error())
		return
	}
	h.tracingHelper.RecordSuccess(clientSpan, "Client setup completed for persistent volumes SSE")

	// Function to fetch persistent volumes data
	fetchPVs := func() (interface{}, error) {
		// Start child span for Kubernetes API call
		_, k8sSpan := h.tracingHelper.StartKubernetesAPISpan(ctx, "list", "persistentvolume", "")
		defer k8sSpan.End()

		pvs, err := client.CoreV1().PersistentVolumes().List(ctx, metav1.ListOptions{})
		if err != nil {
			h.tracingHelper.RecordError(k8sSpan, err, "Failed to list persistent volumes")
			return nil, err
		}
		h.tracingHelper.AddResourceAttributes(k8sSpan, "persistent-volumes", "persistentvolume", len(pvs.Items))
		h.tracingHelper.RecordSuccess(k8sSpan, "Successfully listed persistent volumes")

		// Start child span for data processing
		_, processSpan := h.tracingHelper.StartDataProcessingSpan(ctx, "transform-data")
		defer processSpan.End()

		// Transform persistent volumes to frontend-expected format
		responses := make([]types.PersistentVolumeListResponse, len(pvs.Items))
		for i, pv := range pvs.Items {
			responses[i] = transformers.TransformPVToResponse(&pv)
		}
		h.tracingHelper.RecordSuccess(processSpan, "Successfully transformed persistent volumes data")

		return responses, nil
	}

	// Get initial data
	initialData, err := fetchPVs()
	if err != nil {
		h.logger.WithError(err).Error("Failed to list persistent volumes for SSE")

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
		h.sseHandler.SendSSEResponseWithUpdates(c, initialData, fetchPVs)
		return
	}

	// For non-SSE requests, return JSON
	c.JSON(http.StatusOK, initialData)
}

// GetPersistentVolume returns a specific persistent volume
func (h *PersistentVolumesHandler) GetPersistentVolume(c *gin.Context) {
	// Start child span for client setup
	ctx, clientSpan := h.tracingHelper.StartAuthSpan(c.Request.Context(), "get-client-config")
	defer clientSpan.End()

	client, err := h.getClientAndConfig(c)
	if err != nil {
		h.logger.WithError(err).Error("Failed to get client for persistent volume")
		h.tracingHelper.RecordError(clientSpan, err, "Failed to get client for persistent volume")
		// For EventSource, send error as SSE
		if c.GetHeader("Accept") == "text/event-stream" {
			h.sseHandler.SendSSEError(c, http.StatusBadRequest, err.Error())
		} else {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		}
		return
	}
	h.tracingHelper.RecordSuccess(clientSpan, "Client setup completed for persistent volume")

	name := c.Param("name")

	// Start child span for Kubernetes API call
	_, k8sSpan := h.tracingHelper.StartKubernetesAPISpan(ctx, "get", "persistentvolume", "")
	defer k8sSpan.End()

	pv, err := client.CoreV1().PersistentVolumes().Get(ctx, name, metav1.GetOptions{})
	if err != nil {
		h.logger.WithError(err).WithField("pv", name).Error("Failed to get persistent volume")
		h.tracingHelper.RecordError(k8sSpan, err, "Failed to get persistent volume")
		// For EventSource, send error as SSE
		if c.GetHeader("Accept") == "text/event-stream" {
			h.sseHandler.SendSSEError(c, http.StatusNotFound, err.Error())
		} else {
			c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		}
		return
	}
	h.tracingHelper.AddResourceAttributes(k8sSpan, name, "persistentvolume", 1)
	h.tracingHelper.RecordSuccess(k8sSpan, "Successfully retrieved persistent volume")

	// Check if this is an SSE request (EventSource expects SSE format)
	acceptHeader := c.GetHeader("Accept")
	if acceptHeader == "text/event-stream" {
		h.sseHandler.SendSSEResponse(c, pv)
		return
	}

	c.JSON(http.StatusOK, pv)
}

// GetPersistentVolumeByName returns a specific persistent volume by name
func (h *PersistentVolumesHandler) GetPersistentVolumeByName(c *gin.Context) {
	// Start child span for client setup
	ctx, clientSpan := h.tracingHelper.StartAuthSpan(c.Request.Context(), "get-client-config")
	defer clientSpan.End()

	client, err := h.getClientAndConfig(c)
	if err != nil {
		h.logger.WithError(err).Error("Failed to get client for persistent volume by name")
		h.tracingHelper.RecordError(clientSpan, err, "Failed to get client for persistent volume by name")
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	h.tracingHelper.RecordSuccess(clientSpan, "Client setup completed for persistent volume by name")

	name := c.Param("name")

	// Start child span for Kubernetes API call
	_, k8sSpan := h.tracingHelper.StartKubernetesAPISpan(ctx, "get", "persistentvolume", "")
	defer k8sSpan.End()

	pv, err := client.CoreV1().PersistentVolumes().Get(ctx, name, metav1.GetOptions{})
	if err != nil {
		h.logger.WithError(err).WithField("pv", name).Error("Failed to get persistent volume by name")
		h.tracingHelper.RecordError(k8sSpan, err, "Failed to get persistent volume by name")
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}
	h.tracingHelper.AddResourceAttributes(k8sSpan, name, "persistentvolume", 1)
	h.tracingHelper.RecordSuccess(k8sSpan, "Successfully retrieved persistent volume by name")

	c.JSON(http.StatusOK, pv)
}

// GetPersistentVolumeYAMLByName returns the YAML representation of a specific persistent volume by name
func (h *PersistentVolumesHandler) GetPersistentVolumeYAMLByName(c *gin.Context) {
	// Start child span for client setup
	ctx, clientSpan := h.tracingHelper.StartAuthSpan(c.Request.Context(), "get-client-config")
	defer clientSpan.End()

	client, err := h.getClientAndConfig(c)
	if err != nil {
		h.logger.WithError(err).Error("Failed to get client for persistent volume YAML by name")
		h.tracingHelper.RecordError(clientSpan, err, "Failed to get client for persistent volume YAML by name")
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	h.tracingHelper.RecordSuccess(clientSpan, "Client setup completed for persistent volume YAML by name")

	name := c.Param("name")

	// Start child span for Kubernetes API call
	_, k8sSpan := h.tracingHelper.StartKubernetesAPISpan(ctx, "get", "persistentvolume", "")
	defer k8sSpan.End()

	pv, err := client.CoreV1().PersistentVolumes().Get(ctx, name, metav1.GetOptions{})
	if err != nil {
		h.logger.WithError(err).WithField("pv", name).Error("Failed to get persistent volume for YAML by name")
		h.tracingHelper.RecordError(k8sSpan, err, "Failed to get persistent volume for YAML by name")
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}
	h.tracingHelper.AddResourceAttributes(k8sSpan, name, "persistentvolume", 1)
	h.tracingHelper.RecordSuccess(k8sSpan, "Successfully retrieved persistent volume for YAML by name")

	// Start child span for YAML generation
	_, yamlSpan := h.tracingHelper.StartDataProcessingSpan(ctx, "generate-yaml")
	defer yamlSpan.End()

	h.yamlHandler.SendYAMLResponse(c, pv, name)
	h.tracingHelper.RecordSuccess(yamlSpan, "Successfully generated YAML for persistent volume")
}

// GetPersistentVolumeYAML returns the YAML representation of a specific persistent volume
func (h *PersistentVolumesHandler) GetPersistentVolumeYAML(c *gin.Context) {
	// Start child span for client setup
	ctx, clientSpan := h.tracingHelper.StartAuthSpan(c.Request.Context(), "get-client-config")
	defer clientSpan.End()

	client, err := h.getClientAndConfig(c)
	if err != nil {
		h.logger.WithError(err).Error("Failed to get client for persistent volume YAML")
		h.tracingHelper.RecordError(clientSpan, err, "Failed to get client for persistent volume YAML")
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	h.tracingHelper.RecordSuccess(clientSpan, "Client setup completed for persistent volume YAML")

	name := c.Param("name")

	// Start child span for Kubernetes API call
	_, k8sSpan := h.tracingHelper.StartKubernetesAPISpan(ctx, "get", "persistentvolume", "")
	defer k8sSpan.End()

	pv, err := client.CoreV1().PersistentVolumes().Get(ctx, name, metav1.GetOptions{})
	if err != nil {
		h.logger.WithError(err).WithField("pv", name).Error("Failed to get persistent volume for YAML")
		h.tracingHelper.RecordError(k8sSpan, err, "Failed to get persistent volume for YAML")
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}
	h.tracingHelper.AddResourceAttributes(k8sSpan, name, "persistentvolume", 1)
	h.tracingHelper.RecordSuccess(k8sSpan, "Successfully retrieved persistent volume for YAML")

	// Start child span for YAML generation
	_, yamlSpan := h.tracingHelper.StartDataProcessingSpan(ctx, "generate-yaml")
	defer yamlSpan.End()

	h.yamlHandler.SendYAMLResponse(c, pv, name)
	h.tracingHelper.RecordSuccess(yamlSpan, "Successfully generated YAML for persistent volume")
}

// GetPersistentVolumeEventsByName returns events for a specific persistent volume by name
func (h *PersistentVolumesHandler) GetPersistentVolumeEventsByName(c *gin.Context) {
	// Start child span for client setup
	ctx, clientSpan := h.tracingHelper.StartAuthSpan(c.Request.Context(), "get-client-config")
	defer clientSpan.End()

	client, err := h.getClientAndConfig(c)
	if err != nil {
		h.logger.WithError(err).Error("Failed to get client for persistent volume events")
		h.tracingHelper.RecordError(clientSpan, err, "Failed to get client for persistent volume events")
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	h.tracingHelper.RecordSuccess(clientSpan, "Client setup completed for persistent volume events")

	name := c.Param("name")

	// Start child span for events retrieval
	_, eventsSpan := h.tracingHelper.StartKubernetesAPISpan(ctx, "list", "events", "")
	defer eventsSpan.End()

	h.eventsHandler.GetResourceEvents(c, client, "PersistentVolume", name, h.sseHandler.SendSSEResponse)
	h.tracingHelper.RecordSuccess(eventsSpan, "Successfully retrieved events for persistent volume")
}

// GetPersistentVolumeEvents returns events for a specific persistent volume
func (h *PersistentVolumesHandler) GetPersistentVolumeEvents(c *gin.Context) {
	// Start child span for client setup
	ctx, clientSpan := h.tracingHelper.StartAuthSpan(c.Request.Context(), "get-client-config")
	defer clientSpan.End()

	client, err := h.getClientAndConfig(c)
	if err != nil {
		h.logger.WithError(err).Error("Failed to get client for persistent volume events")
		h.tracingHelper.RecordError(clientSpan, err, "Failed to get client for persistent volume events")
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	h.tracingHelper.RecordSuccess(clientSpan, "Client setup completed for persistent volume events")

	name := c.Param("name")

	// Start child span for events retrieval
	_, eventsSpan := h.tracingHelper.StartKubernetesAPISpan(ctx, "list", "events", "")
	defer eventsSpan.End()

	h.eventsHandler.GetResourceEvents(c, client, "PersistentVolume", name, h.sseHandler.SendSSEResponse)
	h.tracingHelper.RecordSuccess(eventsSpan, "Successfully retrieved events for persistent volume")
}
