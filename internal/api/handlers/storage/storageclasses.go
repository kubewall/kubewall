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

// StorageClassesHandler handles StorageClass-related operations
type StorageClassesHandler struct {
	store         *storage.KubeConfigStore
	clientFactory *k8s.ClientFactory
	logger        *logger.Logger
	eventsHandler *utils.EventsHandler
	yamlHandler   *utils.YAMLHandler
	sseHandler    *utils.SSEHandler
	tracingHelper *tracing.TracingHelper
}

// NewStorageClassesHandler creates a new StorageClasses handler
func NewStorageClassesHandler(store *storage.KubeConfigStore, clientFactory *k8s.ClientFactory, log *logger.Logger) *StorageClassesHandler {
	return &StorageClassesHandler{
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
func (h *StorageClassesHandler) getClientAndConfig(c *gin.Context) (*kubernetes.Clientset, error) {
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

// GetStorageClassesSSE returns storage classes as Server-Sent Events with real-time updates
func (h *StorageClassesHandler) GetStorageClassesSSE(c *gin.Context) {
	// Start child span for client setup
	ctx, clientSpan := h.tracingHelper.StartAuthSpan(c.Request.Context(), "setup-client-for-sse")
	defer clientSpan.End()

	client, err := h.getClientAndConfig(c)
	if err != nil {
		h.logger.WithError(err).Error("Failed to get client for storage classes SSE")
		h.tracingHelper.RecordError(clientSpan, err, "Failed to get client for storage classes SSE")
		h.sseHandler.SendSSEError(c, http.StatusBadRequest, err.Error())
		return
	}
	h.tracingHelper.RecordSuccess(clientSpan, "Client setup completed for storage classes SSE")

	// Function to fetch storage classes data
	fetchStorageClasses := func() (interface{}, error) {
		// Start child span for Kubernetes API call
		_, k8sSpan := h.tracingHelper.StartKubernetesAPISpan(ctx, "list", "storageclass", "")
		defer k8sSpan.End()

		storageClasses, err := client.StorageV1().StorageClasses().List(ctx, metav1.ListOptions{})
		if err != nil {
			h.tracingHelper.RecordError(k8sSpan, err, "Failed to list storage classes")
			return nil, err
		}
		h.tracingHelper.AddResourceAttributes(k8sSpan, "storage-classes", "storageclass", len(storageClasses.Items))
		h.tracingHelper.RecordSuccess(k8sSpan, "Successfully listed storage classes")

		// Start child span for data processing
		_, processSpan := h.tracingHelper.StartDataProcessingSpan(ctx, "transform-data")
		defer processSpan.End()

		// Transform storage classes to frontend-expected format
		responses := make([]types.StorageClassListResponse, len(storageClasses.Items))
		for i, sc := range storageClasses.Items {
			responses[i] = transformers.TransformStorageClassToResponse(&sc)
		}
		h.tracingHelper.RecordSuccess(processSpan, "Successfully transformed storage classes data")

		return responses, nil
	}

	// Get initial data
	initialData, err := fetchStorageClasses()
	if err != nil {
		h.logger.WithError(err).Error("Failed to list storage classes for SSE")
		// Check if this is a permission error
		if utils.IsPermissionError(err) {
			h.sseHandler.SendSSEPermissionError(c, err)
		} else {
			h.sseHandler.SendSSEError(c, http.StatusInternalServerError, err.Error())
		}
		return
	}

	// Send SSE response with periodic updates
	h.sseHandler.SendSSEResponseWithUpdates(c, initialData, fetchStorageClasses)
}

// GetStorageClass returns a specific storage class
func (h *StorageClassesHandler) GetStorageClass(c *gin.Context) {
	// Start child span for client setup
	ctx, clientSpan := h.tracingHelper.StartAuthSpan(c.Request.Context(), "setup-client")
	defer clientSpan.End()

	client, err := h.getClientAndConfig(c)
	if err != nil {
		h.logger.WithError(err).Error("Failed to get client for storage class")
		h.tracingHelper.RecordError(clientSpan, err, "Failed to get client for storage class")
		// For EventSource, send error as SSE
		if c.GetHeader("Accept") == "text/event-stream" {
			h.sseHandler.SendSSEError(c, http.StatusBadRequest, err.Error())
		} else {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		}
		return
	}
	h.tracingHelper.RecordSuccess(clientSpan, "Client setup completed for storage class")

	name := c.Param("name")

	// Start child span for Kubernetes API call
	_, k8sSpan := h.tracingHelper.StartKubernetesAPISpan(ctx, "get", "storageclass", "")
	defer k8sSpan.End()

	storageClass, err := client.StorageV1().StorageClasses().Get(ctx, name, metav1.GetOptions{})
	if err != nil {
		h.logger.WithError(err).WithField("storageclass", name).Error("Failed to get storage class")
		h.tracingHelper.RecordError(k8sSpan, err, "Failed to get storage class")
		// For EventSource, send error as SSE
		if c.GetHeader("Accept") == "text/event-stream" {
			h.sseHandler.SendSSEError(c, http.StatusNotFound, err.Error())
		} else {
			c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		}
		return
	}
	h.tracingHelper.AddResourceAttributes(k8sSpan, name, "storageclass", 1)
	h.tracingHelper.RecordSuccess(k8sSpan, "Successfully retrieved storage class")

	// Check if this is an SSE request (EventSource expects SSE format)
	acceptHeader := c.GetHeader("Accept")
	if acceptHeader == "text/event-stream" {
		h.sseHandler.SendSSEResponse(c, storageClass)
		return
	}

	c.JSON(http.StatusOK, storageClass)
}

// GetStorageClassByName returns a specific storage class by name
func (h *StorageClassesHandler) GetStorageClassByName(c *gin.Context) {
	// Start child span for client setup
	ctx, clientSpan := h.tracingHelper.StartAuthSpan(c.Request.Context(), "setup-client")
	defer clientSpan.End()

	client, err := h.getClientAndConfig(c)
	if err != nil {
		h.logger.WithError(err).Error("Failed to get client for storage class by name")
		h.tracingHelper.RecordError(clientSpan, err, "Failed to get client for storage class by name")
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	h.tracingHelper.RecordSuccess(clientSpan, "Client setup completed for storage class by name")

	name := c.Param("name")

	// Start child span for Kubernetes API call
	_, k8sSpan := h.tracingHelper.StartKubernetesAPISpan(ctx, "get", "storageclass", "")
	defer k8sSpan.End()

	storageClass, err := client.StorageV1().StorageClasses().Get(ctx, name, metav1.GetOptions{})
	if err != nil {
		h.logger.WithError(err).WithField("storageclass", name).Error("Failed to get storage class by name")
		h.tracingHelper.RecordError(k8sSpan, err, "Failed to get storage class by name")
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}
	h.tracingHelper.AddResourceAttributes(k8sSpan, name, "storageclass", 1)
	h.tracingHelper.RecordSuccess(k8sSpan, "Successfully retrieved storage class by name")

	c.JSON(http.StatusOK, storageClass)
}

// GetStorageClassYAMLByName returns the YAML representation of a specific storage class by name
func (h *StorageClassesHandler) GetStorageClassYAMLByName(c *gin.Context) {
	// Start child span for client setup
	ctx, clientSpan := h.tracingHelper.StartAuthSpan(c.Request.Context(), "setup-client")
	defer clientSpan.End()

	client, err := h.getClientAndConfig(c)
	if err != nil {
		h.logger.WithError(err).Error("Failed to get client for storage class YAML by name")
		h.tracingHelper.RecordError(clientSpan, err, "Failed to get client for storage class YAML by name")
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	h.tracingHelper.RecordSuccess(clientSpan, "Client setup completed for storage class YAML by name")

	name := c.Param("name")

	// Start child span for Kubernetes API call
	_, k8sSpan := h.tracingHelper.StartKubernetesAPISpan(ctx, "get", "storageclass", "")
	defer k8sSpan.End()

	storageClass, err := client.StorageV1().StorageClasses().Get(ctx, name, metav1.GetOptions{})
	if err != nil {
		h.logger.WithError(err).WithField("storageclass", name).Error("Failed to get storage class for YAML by name")
		h.tracingHelper.RecordError(k8sSpan, err, "Failed to get storage class for YAML by name")
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}
	h.tracingHelper.AddResourceAttributes(k8sSpan, name, "storageclass", 1)
	h.tracingHelper.RecordSuccess(k8sSpan, "Successfully retrieved storage class for YAML by name")

	// Start child span for YAML generation
	_, yamlSpan := h.tracingHelper.StartDataProcessingSpan(ctx, "generate-yaml")
	defer yamlSpan.End()

	h.yamlHandler.SendYAMLResponse(c, storageClass, name)
	h.tracingHelper.RecordSuccess(yamlSpan, "Successfully generated YAML for storage class")
}

// GetStorageClassYAML returns the YAML representation of a specific storage class
func (h *StorageClassesHandler) GetStorageClassYAML(c *gin.Context) {
	// Start child span for client setup
	ctx, clientSpan := h.tracingHelper.StartAuthSpan(c.Request.Context(), "setup-client")
	defer clientSpan.End()

	client, err := h.getClientAndConfig(c)
	if err != nil {
		h.logger.WithError(err).Error("Failed to get client for storage class YAML")
		h.tracingHelper.RecordError(clientSpan, err, "Failed to get client for storage class YAML")
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	h.tracingHelper.RecordSuccess(clientSpan, "Client setup completed for storage class YAML")

	name := c.Param("name")

	// Start child span for Kubernetes API call
	_, k8sSpan := h.tracingHelper.StartKubernetesAPISpan(ctx, "get", "storageclass", "")
	defer k8sSpan.End()

	storageClass, err := client.StorageV1().StorageClasses().Get(ctx, name, metav1.GetOptions{})
	if err != nil {
		h.logger.WithError(err).WithField("storageclass", name).Error("Failed to get storage class for YAML")
		h.tracingHelper.RecordError(k8sSpan, err, "Failed to get storage class for YAML")
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}
	h.tracingHelper.AddResourceAttributes(k8sSpan, name, "storageclass", 1)
	h.tracingHelper.RecordSuccess(k8sSpan, "Successfully retrieved storage class for YAML")

	// Start child span for YAML generation
	_, yamlSpan := h.tracingHelper.StartDataProcessingSpan(ctx, "generate-yaml")
	defer yamlSpan.End()

	h.yamlHandler.SendYAMLResponse(c, storageClass, name)
	h.tracingHelper.RecordSuccess(yamlSpan, "Successfully generated YAML for storage class")
}

// GetStorageClassEventsByName returns events for a specific storage class by name
func (h *StorageClassesHandler) GetStorageClassEventsByName(c *gin.Context) {
	// Start child span for client setup
	ctx, clientSpan := h.tracingHelper.StartAuthSpan(c.Request.Context(), "setup-client")
	defer clientSpan.End()

	client, err := h.getClientAndConfig(c)
	if err != nil {
		h.logger.WithError(err).Error("Failed to get client for storage class events")
		h.tracingHelper.RecordError(clientSpan, err, "Failed to get client for storage class events")
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	h.tracingHelper.RecordSuccess(clientSpan, "Client setup completed for storage class events")

	name := c.Param("name")

	// Start child span for events retrieval
	_, eventsSpan := h.tracingHelper.StartKubernetesAPISpan(ctx, "list", "events", "")
	defer eventsSpan.End()

	h.eventsHandler.GetResourceEvents(c, client, "StorageClass", name, h.sseHandler.SendSSEResponse)
	h.tracingHelper.RecordSuccess(eventsSpan, "Successfully retrieved events for storage class")
}

// GetStorageClassEvents returns events for a specific storage class
func (h *StorageClassesHandler) GetStorageClassEvents(c *gin.Context) {
	// Start child span for client setup
	ctx, clientSpan := h.tracingHelper.StartAuthSpan(c.Request.Context(), "setup-client")
	defer clientSpan.End()

	client, err := h.getClientAndConfig(c)
	if err != nil {
		h.logger.WithError(err).Error("Failed to get client for storage class events")
		h.tracingHelper.RecordError(clientSpan, err, "Failed to get client for storage class events")
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	h.tracingHelper.RecordSuccess(clientSpan, "Client setup completed for storage class events")

	name := c.Param("name")

	// Start child span for events retrieval
	_, eventsSpan := h.tracingHelper.StartKubernetesAPISpan(ctx, "list", "events", "")
	defer eventsSpan.End()

	h.eventsHandler.GetResourceEvents(c, client, "StorageClass", name, h.sseHandler.SendSSEResponse)
	h.tracingHelper.RecordSuccess(eventsSpan, "Successfully retrieved events for storage class")
}
