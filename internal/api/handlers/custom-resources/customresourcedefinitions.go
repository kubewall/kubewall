package custom_resources

import (
	"fmt"
	"net/http"

	"github.com/Facets-cloud/kube-dash/internal/api/transformers"
	"github.com/Facets-cloud/kube-dash/internal/api/utils"
	"github.com/Facets-cloud/kube-dash/internal/k8s"
	"github.com/Facets-cloud/kube-dash/internal/storage"
	"github.com/Facets-cloud/kube-dash/internal/tracing"
	"github.com/Facets-cloud/kube-dash/pkg/logger"

	"github.com/gin-gonic/gin"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/client-go/dynamic"
	"k8s.io/client-go/kubernetes"
	"k8s.io/client-go/tools/clientcmd"
)

// CustomResourceDefinitionsHandler handles CustomResourceDefinitions operations
type CustomResourceDefinitionsHandler struct {
	store         *storage.KubeConfigStore
	clientFactory *k8s.ClientFactory
	logger        *logger.Logger
	sseHandler    *utils.SSEHandler
	tracingHelper *tracing.TracingHelper
}

// NewCustomResourceDefinitionsHandler creates a new CustomResourceDefinitionsHandler
func NewCustomResourceDefinitionsHandler(store *storage.KubeConfigStore, clientFactory *k8s.ClientFactory, log *logger.Logger) *CustomResourceDefinitionsHandler {
	return &CustomResourceDefinitionsHandler{
		store:         store,
		clientFactory: clientFactory,
		logger:        log,
		sseHandler:    utils.NewSSEHandler(log),
		tracingHelper: tracing.GetTracingHelper(),
	}
}

// getClientAndConfig gets the Kubernetes client and config for the given config ID and cluster
func (h *CustomResourceDefinitionsHandler) getClientAndConfig(c *gin.Context) (*kubernetes.Clientset, error) {
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

// getDynamicClient gets the dynamic client for custom resources
func (h *CustomResourceDefinitionsHandler) getDynamicClient(c *gin.Context) (dynamic.Interface, error) {
	configID := c.Query("config")
	cluster := c.Query("cluster")

	if configID == "" {
		return nil, fmt.Errorf("config parameter is required")
	}

	config, err := h.store.GetKubeConfig(configID)
	if err != nil {
		return nil, fmt.Errorf("config not found: %w", err)
	}

	// Create a copy of the config and set the context to the specific cluster
	configCopy := config.DeepCopy()

	// Find the context that matches the cluster name
	for contextName, context := range configCopy.Contexts {
		if context.Cluster == cluster {
			configCopy.CurrentContext = contextName
			break
		}
	}

	// If no matching context found, use the first context
	if configCopy.CurrentContext == "" && len(configCopy.Contexts) > 0 {
		for contextName := range configCopy.Contexts {
			configCopy.CurrentContext = contextName
			break
		}
	}

	// Create client config
	clientConfig := clientcmd.NewDefaultClientConfig(*configCopy, &clientcmd.ConfigOverrides{})
	restConfig, err := clientConfig.ClientConfig()
	if err != nil {
		return nil, fmt.Errorf("failed to create client config: %w", err)
	}

	// Create dynamic client
	dynamicClient, err := dynamic.NewForConfig(restConfig)
	if err != nil {
		return nil, fmt.Errorf("failed to create dynamic client: %w", err)
	}

	return dynamicClient, nil
}

// GetCustomResourceDefinitions returns all CRDs
func (h *CustomResourceDefinitionsHandler) GetCustomResourceDefinitions(c *gin.Context) {
	// Start main span for CRD list operation
	ctx, span := h.tracingHelper.StartAuthSpan(c.Request.Context(), "crd.list_definitions")
	defer span.End()

	// Child span for client acquisition
	clientCtx, clientSpan := h.tracingHelper.StartAuthSpan(ctx, "crd.client_acquisition")
	dynamicClient, err := h.getDynamicClient(c)
	if err != nil {
		h.logger.WithError(err).Error("Failed to get dynamic client for CRDs")
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		h.tracingHelper.RecordError(clientSpan, err, "Failed to get dynamic client")
		clientSpan.End()
		h.tracingHelper.RecordError(span, err, "GetCustomResourceDefinitions failed")
		return
	}
	h.tracingHelper.RecordSuccess(clientSpan, "Dynamic client acquired")
	clientSpan.End()

	// Child span for Kubernetes API operations
	apiCtx, apiSpan := h.tracingHelper.StartKubernetesAPISpan(clientCtx, "list", "customresourcedefinitions", "")
	// CRDs are in the apiextensions.k8s.io/v1 API group
	gvr := schema.GroupVersionResource{
		Group:    "apiextensions.k8s.io",
		Version:  "v1",
		Resource: "customresourcedefinitions",
	}

	crdList, err := dynamicClient.Resource(gvr).List(apiCtx, metav1.ListOptions{})
	if err != nil {
		h.logger.WithError(err).Error("Failed to list custom resource definitions")
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		h.tracingHelper.RecordError(apiSpan, err, "Failed to list CRDs")
		apiSpan.End()
		h.tracingHelper.RecordError(span, err, "GetCustomResourceDefinitions failed")
		return
	}
	h.tracingHelper.RecordSuccess(apiSpan, "CRD list API call completed")
	apiSpan.End()

	// Child span for data processing
	_, processingSpan := h.tracingHelper.StartDataProcessingSpan(apiCtx, "crd.data_processing")
	// Convert to unstructured objects
	var crds []unstructured.Unstructured
	items, _ := crdList.UnstructuredContent()["items"].([]interface{})
	for _, item := range items {
		if crd, ok := item.(map[string]interface{}); ok {
			crds = append(crds, unstructured.Unstructured{Object: crd})
		}
	}

	// Transform to frontend format
	transformed := transformers.TransformCustomResourceDefinitions(crds)
	h.tracingHelper.RecordSuccess(processingSpan, "Data processing completed")
	processingSpan.End()

	c.JSON(http.StatusOK, transformed)
	h.tracingHelper.RecordSuccess(span, "CRD list operation completed")
}

// GetCustomResourceDefinitionsSSE returns CRDs as Server-Sent Events with real-time updates
func (h *CustomResourceDefinitionsHandler) GetCustomResourceDefinitionsSSE(c *gin.Context) {
	// Start main span for CRD SSE operation
	ctx, span := h.tracingHelper.StartAuthSpan(c.Request.Context(), "crd.list_definitions_sse")
	defer span.End()

	// Child span for client acquisition
	clientCtx, clientSpan := h.tracingHelper.StartAuthSpan(ctx, "crd.client_acquisition")
	dynamicClient, err := h.getDynamicClient(c)
	if err != nil {
		h.logger.WithError(err).Error("Failed to get dynamic client for CRDs SSE")
		h.sseHandler.SendSSEError(c, http.StatusBadRequest, err.Error())
		h.tracingHelper.RecordError(clientSpan, err, "Failed to get dynamic client")
		clientSpan.End()
		h.tracingHelper.RecordError(span, err, "GetCustomResourceDefinitionsSSE failed")
		return
	}
	h.tracingHelper.RecordSuccess(clientSpan, "Dynamic client acquired")
	clientSpan.End()

	// Function to fetch CRDs data
	fetchCRDs := func() (interface{}, error) {
		// Child span for Kubernetes API operations within fetchCRDs
		apiCtx, apiSpan := h.tracingHelper.StartKubernetesAPISpan(clientCtx, "list", "customresourcedefinitions", "")
		defer apiSpan.End()

		// CRDs are in the apiextensions.k8s.io/v1 API group
		gvr := schema.GroupVersionResource{
			Group:    "apiextensions.k8s.io",
			Version:  "v1",
			Resource: "customresourcedefinitions",
		}

		crdList, err := dynamicClient.Resource(gvr).List(apiCtx, metav1.ListOptions{})
		if err != nil {
			h.tracingHelper.RecordError(apiSpan, err, "Failed to list CRDs")
			return nil, err
		}
		h.tracingHelper.RecordSuccess(apiSpan, "CRD list API call completed")

		// Child span for data processing
		_, processingSpan := h.tracingHelper.StartDataProcessingSpan(apiCtx, "crd.data_processing")
		defer processingSpan.End()

		// Convert to unstructured objects
		var crds []unstructured.Unstructured
		items, _ := crdList.UnstructuredContent()["items"].([]interface{})
		for _, item := range items {
			if crd, ok := item.(map[string]interface{}); ok {
				crds = append(crds, unstructured.Unstructured{Object: crd})
			}
		}

		// Transform to frontend format
		transformed := transformers.TransformCustomResourceDefinitions(crds)
		h.tracingHelper.RecordSuccess(processingSpan, "Data processing completed")
		return transformed, nil
	}

	// Get initial data
	initialData, err := fetchCRDs()
	if err != nil {
		h.logger.WithError(err).Error("Failed to list custom resource definitions for SSE")
		// Check if this is a permission error
		if utils.IsPermissionError(err) {
			h.sseHandler.SendSSEPermissionError(c, err)
		} else {
			h.sseHandler.SendSSEError(c, http.StatusInternalServerError, err.Error())
		}
		h.tracingHelper.RecordError(span, err, "GetCustomResourceDefinitionsSSE failed")
		return
	}

	// Check if this is an SSE request (EventSource expects SSE format)
	acceptHeader := c.GetHeader("Accept")
	if acceptHeader == "text/event-stream" {
		// Send SSE response with periodic updates
		h.sseHandler.SendSSEResponseWithUpdates(c, initialData, fetchCRDs)
		h.tracingHelper.RecordSuccess(span, "CRD SSE stream established")
		return
	}

	// For non-SSE requests, return JSON
	c.JSON(http.StatusOK, initialData)
	h.tracingHelper.RecordSuccess(span, "CRD SSE operation completed")
}

// GetCustomResourceDefinition returns a specific CRD
func (h *CustomResourceDefinitionsHandler) GetCustomResourceDefinition(c *gin.Context) {
	// Start main span for single CRD retrieval operation
	ctx, span := h.tracingHelper.StartAuthSpan(c.Request.Context(), "crd.get_definition")
	defer span.End()

	name := c.Param("name")
	h.tracingHelper.AddResourceAttributes(span, name, "customresourcedefinition", 1)

	// Child span for client acquisition
	clientCtx, clientSpan := h.tracingHelper.StartAuthSpan(ctx, "crd.client_acquisition")
	dynamicClient, err := h.getDynamicClient(c)
	if err != nil {
		h.logger.WithError(err).Error("Failed to get dynamic client for CRD")
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		h.tracingHelper.RecordError(clientSpan, err, "Failed to get dynamic client")
		clientSpan.End()
		h.tracingHelper.RecordError(span, err, "GetCustomResourceDefinition failed")
		return
	}
	h.tracingHelper.RecordSuccess(clientSpan, "Dynamic client acquired")
	clientSpan.End()

	// Child span for Kubernetes API operations
	apiCtx, apiSpan := h.tracingHelper.StartKubernetesAPISpan(clientCtx, "get", "customresourcedefinition", "")
	gvr := schema.GroupVersionResource{
		Group:    "apiextensions.k8s.io",
		Version:  "v1",
		Resource: "customresourcedefinitions",
	}

	crd, err := dynamicClient.Resource(gvr).Get(apiCtx, name, metav1.GetOptions{})
	if err != nil {
		h.logger.WithError(err).WithField("crd", name).Error("Failed to get custom resource definition")
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		h.tracingHelper.RecordError(apiSpan, err, "Failed to get CRD")
		apiSpan.End()
		h.tracingHelper.RecordError(span, err, "GetCustomResourceDefinition failed")
		return
	}
	h.tracingHelper.RecordSuccess(apiSpan, "CRD get API call completed")
	apiSpan.End()

	// Check if this is an SSE request (EventSource expects SSE format)
	acceptHeader := c.GetHeader("Accept")
	if acceptHeader == "text/event-stream" {
		h.sseHandler.SendSSEResponse(c, crd)
		h.tracingHelper.RecordSuccess(span, "CRD SSE response sent")
		return
	}

	c.JSON(http.StatusOK, crd)
	h.tracingHelper.RecordSuccess(span, "CRD get operation completed")
}
