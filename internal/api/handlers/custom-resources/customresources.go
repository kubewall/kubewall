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

// CustomResourcesHandler handles CustomResources operations
type CustomResourcesHandler struct {
	store         *storage.KubeConfigStore
	clientFactory *k8s.ClientFactory
	logger        *logger.Logger
	sseHandler    *utils.SSEHandler
	yamlHandler   *utils.YAMLHandler
	eventsHandler *utils.EventsHandler
	tracingHelper *tracing.TracingHelper
}

// NewCustomResourcesHandler creates a new CustomResourcesHandler
func NewCustomResourcesHandler(store *storage.KubeConfigStore, clientFactory *k8s.ClientFactory, log *logger.Logger) *CustomResourcesHandler {
	return &CustomResourcesHandler{
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
func (h *CustomResourcesHandler) getClientAndConfig(c *gin.Context) (*kubernetes.Clientset, error) {
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
func (h *CustomResourcesHandler) getDynamicClient(c *gin.Context) (dynamic.Interface, error) {
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

// GetCustomResources returns custom resources for a specific CRD
// @Summary Get Custom Resources
// @Description Get all custom resources for a specific Custom Resource Definition
// @Tags Custom Resources
// @Accept json
// @Produce json
// @Param group query string true "Resource group"
// @Param version query string true "Resource version"
// @Param resource query string true "Resource name"
// @Param namespace query string false "Namespace (if empty, returns cluster-wide resources)"
// @Param config query string true "Kubernetes configuration ID"
// @Param cluster query string false "Cluster name"
// @Success 200 {array} map[string]interface{} "List of custom resources"
// @Failure 400 {object} map[string]string "Bad request - missing required parameters"
// @Failure 500 {object} map[string]string "Internal server error"
// @Router /api/v1/customresources [get]
// @Security BearerAuth
// @Security KubeConfig
func (h *CustomResourcesHandler) GetCustomResources(c *gin.Context) {
	// Start main span for custom resources list operation
	ctx, span := h.tracingHelper.StartAuthSpan(c.Request.Context(), "custom_resource.list")
	defer span.End()

	group := c.Query("group")
	version := c.Query("version")
	resource := c.Query("resource")
	namespace := c.Query("namespace")

	// Add resource attributes
	h.tracingHelper.AddResourceAttributes(span, resource, "custom_resource", 1)

	if group == "" || version == "" || resource == "" {
		err := fmt.Errorf("group, version, and resource parameters are required")
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		h.tracingHelper.RecordError(span, err, "GetCustomResources failed")
		return
	}

	// Child span for client acquisition
	clientCtx, clientSpan := h.tracingHelper.StartAuthSpan(ctx, "custom_resource.client_acquisition")
	dynamicClient, err := h.getDynamicClient(c)
	if err != nil {
		h.logger.WithError(err).Error("Failed to get dynamic client for custom resources")
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		h.tracingHelper.RecordError(clientSpan, err, "Failed to get dynamic client")
		clientSpan.End()
		h.tracingHelper.RecordError(span, err, "GetCustomResources failed")
		return
	}
	h.tracingHelper.RecordSuccess(clientSpan, "Dynamic client acquired")
	clientSpan.End()

	// Child span for Kubernetes API operations
	apiCtx, apiSpan := h.tracingHelper.StartKubernetesAPISpan(clientCtx, "list", "custom_resources", namespace)
	gvr := schema.GroupVersionResource{
		Group:    group,
		Version:  version,
		Resource: resource,
	}

	var crList interface{}
	var err2 error

	if namespace != "" {
		crList, err2 = dynamicClient.Resource(gvr).Namespace(namespace).List(apiCtx, metav1.ListOptions{})
	} else {
		crList, err2 = dynamicClient.Resource(gvr).List(apiCtx, metav1.ListOptions{})
	}

	if err2 != nil {
		h.logger.WithError(err2).Error("Failed to list custom resources")
		c.JSON(http.StatusInternalServerError, gin.H{"error": err2.Error()})
		h.tracingHelper.RecordError(apiSpan, err2, "Failed to list custom resources")
		apiSpan.End()
		h.tracingHelper.RecordError(span, err2, "GetCustomResources failed")
		return
	}
	h.tracingHelper.RecordSuccess(apiSpan, "Custom resources list API call completed")
	apiSpan.End()

	// Child span for data processing
	_, processingSpan := h.tracingHelper.StartDataProcessingSpan(apiCtx, "custom_resource.data_processing")
	// Return only the items array for non-SSE list requests (UI containers expect array)
	if ul, ok := crList.(interface{ UnstructuredContent() map[string]interface{} }); ok {
		content := ul.UnstructuredContent()
		if items, exists := content["items"].([]interface{}); exists {
			h.tracingHelper.RecordSuccess(processingSpan, "Data processing completed")
			processingSpan.End()
			c.JSON(http.StatusOK, items)
			h.tracingHelper.RecordSuccess(span, "Custom resources list operation completed")
			return
		}
	}
	h.tracingHelper.RecordSuccess(processingSpan, "Data processing completed")
	processingSpan.End()
	c.JSON(http.StatusOK, crList)
	h.tracingHelper.RecordSuccess(span, "Custom resources list operation completed")
}

// GetCustomResourcesSSE returns custom resources as Server-Sent Events
// @Summary Get Custom Resources (SSE)
// @Description Get custom resources for a specific CRD with real-time updates via Server-Sent Events
// @Tags Custom Resources
// @Accept json
// @Produce text/event-stream
// @Param group query string true "Resource group"
// @Param version query string true "Resource version"
// @Param resource query string true "Resource name"
// @Param namespace query string false "Namespace (if empty, returns cluster-wide resources)"
// @Param config query string true "Kubernetes configuration ID"
// @Param cluster query string false "Cluster name"
// @Success 200 {object} map[string]interface{} "Stream of custom resources data with additional printer columns"
// @Failure 400 {object} map[string]string "Bad request - missing required parameters"
// @Failure 500 {object} map[string]string "Internal server error"
// @Router /api/v1/customresources/sse [get]
// @Security BearerAuth
// @Security KubeConfig
func (h *CustomResourcesHandler) GetCustomResourcesSSE(c *gin.Context) {
	// Start main span for custom resources SSE operation
	ctx, span := h.tracingHelper.StartAuthSpan(c.Request.Context(), "custom_resource.list_sse")
	defer span.End()

	group := c.Query("group")
	version := c.Query("version")
	resource := c.Query("resource")
	namespace := c.Query("namespace")

	// Add resource attributes
	h.tracingHelper.AddResourceAttributes(span, resource, "custom_resource", 1)

	if group == "" || version == "" || resource == "" {
		err := fmt.Errorf("group, version, and resource parameters are required")
		h.sseHandler.SendSSEError(c, http.StatusBadRequest, err.Error())
		h.tracingHelper.RecordError(span, err, "GetCustomResourcesSSE failed")
		return
	}

	// Child span for client acquisition
	clientCtx, clientSpan := h.tracingHelper.StartAuthSpan(ctx, "custom_resource.client_acquisition")
	dynamicClient, err := h.getDynamicClient(c)
	if err != nil {
		h.logger.WithError(err).Error("Failed to get dynamic client for custom resources SSE")
		h.sseHandler.SendSSEError(c, http.StatusBadRequest, err.Error())
		h.tracingHelper.RecordError(clientSpan, err, "Failed to get dynamic client")
		clientSpan.End()
		h.tracingHelper.RecordError(span, err, "GetCustomResourcesSSE failed")
		return
	}
	h.tracingHelper.RecordSuccess(clientSpan, "Dynamic client acquired")
	clientSpan.End()

	gvr := schema.GroupVersionResource{
		Group:    group,
		Version:  version,
		Resource: resource,
	}

	// Helper to fetch and shape list response
	fetchList := func() (interface{}, error) {
		// Child span for Kubernetes API operations within fetchList
		apiCtx, apiSpan := h.tracingHelper.StartKubernetesAPISpan(clientCtx, "list", "custom_resources", namespace)
		defer apiSpan.End()

		var listObj interface{}
		var err2 error
		if namespace != "" {
			listObj, err2 = dynamicClient.Resource(gvr).Namespace(namespace).List(apiCtx, metav1.ListOptions{})
		} else {
			listObj, err2 = dynamicClient.Resource(gvr).List(apiCtx, metav1.ListOptions{})
		}
		if err2 != nil {
			h.tracingHelper.RecordError(apiSpan, err2, "Failed to list custom resources")
			return nil, err2
		}
		h.tracingHelper.RecordSuccess(apiSpan, "Custom resources list API call completed")

		// Child span for data processing
		_, processingSpan := h.tracingHelper.StartDataProcessingSpan(apiCtx, "custom_resource.data_processing")
		defer processingSpan.End()

		// Extract items array
		var items []interface{}
		if ul, ok := listObj.(interface{ UnstructuredContent() map[string]interface{} }); ok {
			if rawItems, exists := ul.UnstructuredContent()["items"].([]interface{}); exists {
				items = rawItems
			}
		}

		// Best-effort: derive additional printer columns from CRD
		apc, _ := h.getAdditionalPrinterColumns(c, dynamicClient, group, resource, version)

		h.tracingHelper.RecordSuccess(processingSpan, "Data processing completed")
		return gin.H{
			"additionalPrinterColumns": apc,
			"list":                     items,
		}, nil
	}

	// Get initial data
	initialData, err := fetchList()
	if err != nil {
		h.logger.WithError(err).Error("Failed to list custom resources for SSE")
		if utils.IsPermissionError(err) {
			h.sseHandler.SendSSEPermissionError(c, err)
		} else {
			h.sseHandler.SendSSEError(c, http.StatusInternalServerError, err.Error())
		}
		h.tracingHelper.RecordError(span, err, "GetCustomResourcesSSE failed")
		return
	}

	// Check if this is an SSE request (EventSource expects SSE format)
	acceptHeader := c.GetHeader("Accept")
	if acceptHeader == "text/event-stream" {
		h.sseHandler.SendSSEResponseWithUpdates(c, initialData, fetchList)
		h.tracingHelper.RecordSuccess(span, "Custom resources SSE stream established")
		return
	}

	// For non-SSE requests, return JSON
	c.JSON(http.StatusOK, initialData)
	h.tracingHelper.RecordSuccess(span, "Custom resources SSE operation completed")
}

// GetCustomResource returns a specific custom resource
// @Summary Get Custom Resource by Name
// @Description Get a specific custom resource by name and namespace
// @Tags Custom Resources
// @Accept json
// @Produce json
// @Param namespace path string true "Namespace"
// @Param name path string true "Resource name"
// @Param group query string true "Resource group"
// @Param version query string true "Resource version"
// @Param resource query string true "Resource type"
// @Param config query string true "Kubernetes configuration ID"
// @Param cluster query string false "Cluster name"
// @Success 200 {object} map[string]interface{} "Custom resource details"
// @Failure 400 {object} map[string]string "Bad request - missing required parameters"
// @Failure 404 {object} map[string]string "Custom resource not found"
// @Router /api/v1/customresources/{namespace}/{name} [get]
// @Security BearerAuth
// @Security KubeConfig
func (h *CustomResourcesHandler) GetCustomResource(c *gin.Context) {
	// Start main span for single custom resource retrieval operation
	ctx, span := h.tracingHelper.StartAuthSpan(c.Request.Context(), "custom_resource.get")
	defer span.End()

	group := c.Query("group")
	version := c.Query("version")
	resource := c.Query("resource")
	namespace := c.Param("namespace")
	name := c.Param("name")

	// Add resource attributes
	h.tracingHelper.AddResourceAttributes(span, name, "custom_resource", 1)

	if group == "" || version == "" || resource == "" {
		err := fmt.Errorf("group, version, and resource parameters are required")
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		h.tracingHelper.RecordError(span, err, "GetCustomResource failed")
		return
	}

	// Child span for client acquisition
	clientCtx, clientSpan := h.tracingHelper.StartAuthSpan(ctx, "custom_resource.client_acquisition")
	dynamicClient, err := h.getDynamicClient(c)
	if err != nil {
		h.logger.WithError(err).Error("Failed to get dynamic client for custom resource")
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		h.tracingHelper.RecordError(clientSpan, err, "Failed to get dynamic client")
		clientSpan.End()
		h.tracingHelper.RecordError(span, err, "GetCustomResource failed")
		return
	}
	h.tracingHelper.RecordSuccess(clientSpan, "Dynamic client acquired")
	clientSpan.End()

	// Child span for Kubernetes API operations
	apiCtx, apiSpan := h.tracingHelper.StartKubernetesAPISpan(clientCtx, "get", "custom_resource", namespace)
	gvr := schema.GroupVersionResource{
		Group:    group,
		Version:  version,
		Resource: resource,
	}

	var cr interface{}
	var err2 error

	if namespace != "" {
		cr, err2 = dynamicClient.Resource(gvr).Namespace(namespace).Get(apiCtx, name, metav1.GetOptions{})
	} else {
		cr, err2 = dynamicClient.Resource(gvr).Get(apiCtx, name, metav1.GetOptions{})
	}

	if err2 != nil {
		h.logger.WithError(err2).WithField("custom_resource", name).Error("Failed to get custom resource")
		c.JSON(http.StatusNotFound, gin.H{"error": err2.Error()})
		h.tracingHelper.RecordError(apiSpan, err2, "Failed to get custom resource")
		apiSpan.End()
		h.tracingHelper.RecordError(span, err2, "GetCustomResource failed")
		return
	}
	h.tracingHelper.RecordSuccess(apiSpan, "Custom resource get API call completed")
	apiSpan.End()

	// Check if this is an SSE request (EventSource expects SSE format)
	acceptHeader := c.GetHeader("Accept")
	if acceptHeader == "text/event-stream" {
		h.sseHandler.SendSSEResponse(c, cr)
		h.tracingHelper.RecordSuccess(span, "Custom resource SSE response sent")
		return
	}

	c.JSON(http.StatusOK, cr)
	h.tracingHelper.RecordSuccess(span, "Custom resource get operation completed")
}

// GetCustomResourceYAML returns the YAML for a specific custom resource (namespaced path)
// @Summary Get Custom Resource YAML
// @Description Get the YAML representation of a specific custom resource
// @Tags Custom Resources
// @Accept json
// @Produce text/plain
// @Param namespace path string true "Namespace"
// @Param name path string true "Resource name"
// @Param group query string true "Resource group"
// @Param version query string true "Resource version"
// @Param resource query string true "Resource type"
// @Param config query string true "Kubernetes configuration ID"
// @Param cluster query string false "Cluster name"
// @Success 200 {string} string "Custom resource YAML"
// @Failure 400 {object} map[string]string "Bad request - missing required parameters"
// @Failure 404 {object} map[string]string "Custom resource not found"
// @Router /api/v1/customresources/{namespace}/{name}/yaml [get]
// @Security BearerAuth
// @Security KubeConfig
func (h *CustomResourcesHandler) GetCustomResourceYAML(c *gin.Context) {
	// Start main span for custom resource YAML operation
	ctx, span := h.tracingHelper.StartAuthSpan(c.Request.Context(), "custom_resource.get_yaml")
	defer span.End()

	group := c.Query("group")
	version := c.Query("version")
	resource := c.Query("resource")
	namespace := c.Param("namespace")
	name := c.Param("name")

	// Add resource attributes
	h.tracingHelper.AddResourceAttributes(span, name, "custom_resource", 1)

	if group == "" || version == "" || resource == "" {
		err := fmt.Errorf("group, version, and resource parameters are required")
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		h.tracingHelper.RecordError(span, err, "GetCustomResourceYAML failed")
		return
	}

	// Child span for client acquisition
	clientCtx, clientSpan := h.tracingHelper.StartAuthSpan(ctx, "custom_resource.client_acquisition")
	dynamicClient, err := h.getDynamicClient(c)
	if err != nil {
		h.logger.WithError(err).Error("Failed to get dynamic client for custom resource YAML")
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		h.tracingHelper.RecordError(clientSpan, err, "Failed to get dynamic client")
		clientSpan.End()
		h.tracingHelper.RecordError(span, err, "GetCustomResourceYAML failed")
		return
	}
	h.tracingHelper.RecordSuccess(clientSpan, "Dynamic client acquired")
	clientSpan.End()

	// Child span for Kubernetes API operations
	apiCtx, apiSpan := h.tracingHelper.StartKubernetesAPISpan(clientCtx, "get", "custom_resource", namespace)
	gvr := schema.GroupVersionResource{Group: group, Version: version, Resource: resource}

	obj, err2 := dynamicClient.Resource(gvr).Namespace(namespace).Get(apiCtx, name, metav1.GetOptions{})
	if err2 != nil {
		h.logger.WithError(err2).WithField("custom_resource", name).Error("Failed to get custom resource for YAML")
		c.JSON(http.StatusNotFound, gin.H{"error": err2.Error()})
		h.tracingHelper.RecordError(apiSpan, err2, "Failed to get custom resource")
		apiSpan.End()
		h.tracingHelper.RecordError(span, err2, "GetCustomResourceYAML failed")
		return
	}
	h.tracingHelper.RecordSuccess(apiSpan, "Custom resource get API call completed")
	apiSpan.End()

	// Child span for YAML generation
	_, yamlSpan := h.tracingHelper.StartDataProcessingSpan(apiCtx, "custom_resource.yaml_generation")
	h.yamlHandler.SendYAMLResponse(c, obj, name)
	h.tracingHelper.RecordSuccess(yamlSpan, "YAML generation completed")
	yamlSpan.End()
	h.tracingHelper.RecordSuccess(span, "Custom resource YAML operation completed")
}

// GetCustomResourceYAMLByName returns the YAML for a specific custom resource (cluster-scoped path with optional namespace via query)
// @Summary Get Custom Resource YAML by Name
// @Description Get the YAML representation of a specific custom resource (cluster-scoped or with optional namespace)
// @Tags Custom Resources
// @Accept json
// @Produce text/plain
// @Param name path string true "Resource name"
// @Param group query string true "Resource group"
// @Param version query string true "Resource version"
// @Param resource query string true "Resource type"
// @Param namespace query string false "Namespace (optional for namespaced resources)"
// @Param config query string true "Kubernetes configuration ID"
// @Param cluster query string false "Cluster name"
// @Success 200 {string} string "Custom resource YAML"
// @Failure 400 {object} map[string]string "Bad request - missing required parameters"
// @Failure 404 {object} map[string]string "Custom resource not found"
// @Router /api/v1/customresources/{name}/yaml [get]
// @Security BearerAuth
// @Security KubeConfig
func (h *CustomResourcesHandler) GetCustomResourceYAMLByName(c *gin.Context) {
	// Start main span for custom resource YAML by name operation
	ctx, span := h.tracingHelper.StartAuthSpan(c.Request.Context(), "custom_resource.get_yaml_by_name")
	defer span.End()

	group := c.Query("group")
	version := c.Query("version")
	resource := c.Query("resource")
	namespace := c.Query("namespace")
	name := c.Param("name")

	// Add resource attributes
	h.tracingHelper.AddResourceAttributes(span, resource, "custom_resource", 1)

	if group == "" || version == "" || resource == "" {
		err := fmt.Errorf("group, version, and resource parameters are required")
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		h.tracingHelper.RecordError(span, err, "GetCustomResourceYAMLByName failed")
		return
	}

	// Child span for client acquisition
	clientCtx, clientSpan := h.tracingHelper.StartAuthSpan(ctx, "custom_resource.client_acquisition")
	dynamicClient, err := h.getDynamicClient(c)
	if err != nil {
		h.logger.WithError(err).Error("Failed to get dynamic client for custom resource YAML")
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		h.tracingHelper.RecordError(clientSpan, err, "Failed to get dynamic client")
		clientSpan.End()
		h.tracingHelper.RecordError(span, err, "GetCustomResourceYAMLByName failed")
		return
	}
	h.tracingHelper.RecordSuccess(clientSpan, "Dynamic client acquired")
	clientSpan.End()

	// Child span for Kubernetes API operations
	apiCtx, apiSpan := h.tracingHelper.StartKubernetesAPISpan(clientCtx, "custom_resource.get_api_call", "get", "custom_resource")
	gvr := schema.GroupVersionResource{Group: group, Version: version, Resource: resource}

	var obj interface{}
	var err2 error
	if namespace != "" {
		obj, err2 = dynamicClient.Resource(gvr).Namespace(namespace).Get(apiCtx, name, metav1.GetOptions{})
	} else {
		obj, err2 = dynamicClient.Resource(gvr).Get(apiCtx, name, metav1.GetOptions{})
	}
	if err2 != nil {
		h.logger.WithError(err2).WithField("custom_resource", name).Error("Failed to get custom resource for YAML")
		c.JSON(http.StatusNotFound, gin.H{"error": err2.Error()})
		h.tracingHelper.RecordError(apiSpan, err2, "Failed to get custom resource")
		apiSpan.End()
		h.tracingHelper.RecordError(span, err2, "GetCustomResourceYAMLByName failed")
		return
	}
	h.tracingHelper.RecordSuccess(apiSpan, "Custom resource get API call completed")
	apiSpan.End()

	// Child span for YAML generation
	_, yamlSpan := h.tracingHelper.StartDataProcessingSpan(apiCtx, "custom_resource.yaml_generation")
	h.yamlHandler.SendYAMLResponse(c, obj, name)
	h.tracingHelper.RecordSuccess(yamlSpan, "YAML generation completed")
	yamlSpan.End()
	h.tracingHelper.RecordSuccess(span, "Custom resource YAML by name operation completed")
}

// GetCustomResourceEvents returns events for a specific custom resource (namespaced path)
// @Summary Get Custom Resource Events
// @Description Get events for a specific custom resource in a namespace
// @Tags Custom Resources
// @Accept json
// @Produce text/event-stream
// @Param namespace path string true "Namespace"
// @Param name path string true "Resource name"
// @Param group query string true "Resource group"
// @Param version query string true "Resource version"
// @Param resource query string true "Resource type"
// @Param config query string true "Kubernetes configuration ID"
// @Param cluster query string false "Cluster name"
// @Success 200 {array} map[string]interface{} "Stream of events for the custom resource"
// @Failure 400 {object} map[string]string "Bad request - missing required parameters"
// @Failure 404 {object} map[string]string "Custom resource not found"
// @Router /api/v1/customresources/{namespace}/{name}/events [get]
// @Security BearerAuth
// @Security KubeConfig
func (h *CustomResourcesHandler) GetCustomResourceEvents(c *gin.Context) {
	// Start main span for custom resource events operation
	ctx, span := h.tracingHelper.StartAuthSpan(c.Request.Context(), "custom_resource.get_events")
	defer span.End()

	group := c.Query("group")
	version := c.Query("version")
	resource := c.Query("resource")
	namespace := c.Param("namespace")
	name := c.Param("name")

	// Add resource attributes
	h.tracingHelper.AddResourceAttributes(span, resource, "custom_resource", 1)

	if group == "" || version == "" || resource == "" {
		err := fmt.Errorf("group, version, and resource parameters are required")
		h.sseHandler.SendSSEError(c, http.StatusBadRequest, err.Error())
		h.tracingHelper.RecordError(span, err, "GetCustomResourceEvents failed")
		return
	}

	// Child span for client acquisition
	clientCtx, clientSpan := h.tracingHelper.StartAuthSpan(ctx, "custom_resource.client_acquisition")
	client, err := h.getClientAndConfig(c)
	if err != nil {
		h.logger.WithError(err).Error("Failed to get client for custom resource events")
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		h.tracingHelper.RecordError(clientSpan, err, "Failed to get client")
		clientSpan.End()
		h.tracingHelper.RecordError(span, err, "GetCustomResourceEvents failed")
		return
	}

	dynamicClient, err := h.getDynamicClient(c)
	if err != nil {
		h.logger.WithError(err).Error("Failed to get dynamic client for custom resource events")
		h.sseHandler.SendSSEError(c, http.StatusBadRequest, err.Error())
		h.tracingHelper.RecordError(clientSpan, err, "Failed to get dynamic client")
		clientSpan.End()
		h.tracingHelper.RecordError(span, err, "GetCustomResourceEvents failed")
		return
	}
	h.tracingHelper.RecordSuccess(clientSpan, "Clients acquired")
	clientSpan.End()

	// Child span for Kubernetes API operations
	apiCtx, apiSpan := h.tracingHelper.StartKubernetesAPISpan(clientCtx, "custom_resource.get_api_call", "get", "custom_resource")
	gvr := schema.GroupVersionResource{Group: group, Version: version, Resource: resource}

	// Fetch the CR to determine its Kind for event filtering
	obj, err2 := dynamicClient.Resource(gvr).Namespace(namespace).Get(apiCtx, name, metav1.GetOptions{})
	if err2 != nil {
		h.sseHandler.SendSSEError(c, http.StatusNotFound, err2.Error())
		h.tracingHelper.RecordError(apiSpan, err2, "Failed to get custom resource")
		apiSpan.End()
		h.tracingHelper.RecordError(span, err2, "GetCustomResourceEvents failed")
		return
	}
	h.tracingHelper.RecordSuccess(apiSpan, "Custom resource get API call completed")
	apiSpan.End()

	// Child span for data processing
	_, processingSpan := h.tracingHelper.StartDataProcessingSpan(apiCtx, "custom_resource.kind_extraction")
	u := obj
	kind := u.GetKind()
	if kind == "" {
		if k, ok2 := u.Object["kind"].(string); ok2 {
			kind = k
		}
	}
	h.tracingHelper.RecordSuccess(processingSpan, "Kind extraction completed")
	processingSpan.End()

	// Child span for events retrieval
	_, eventsSpan := h.tracingHelper.StartKubernetesAPISpan(apiCtx, "custom_resource.get_events", "list", "events")
	h.eventsHandler.GetResourceEventsWithNamespace(c, client, kind, name, namespace, h.sseHandler.SendSSEResponse)
	h.tracingHelper.RecordSuccess(eventsSpan, "Events retrieval completed")
	eventsSpan.End()
	h.tracingHelper.RecordSuccess(span, "Custom resource events operation completed")
}

// GetCustomResourceEventsByName returns events for a specific custom resource (cluster-scoped path, optional namespace via query)
// @Summary Get Custom Resource Events by Name
// @Description Get events for a specific custom resource (cluster-scoped or with optional namespace)
// @Tags Custom Resources
// @Accept json
// @Produce text/event-stream
// @Param name path string true "Resource name"
// @Param group query string true "Resource group"
// @Param version query string true "Resource version"
// @Param resource query string true "Resource type"
// @Param namespace query string false "Namespace (optional for namespaced resources)"
// @Param config query string true "Kubernetes configuration ID"
// @Param cluster query string false "Cluster name"
// @Success 200 {array} map[string]interface{} "Stream of events for the custom resource"
// @Failure 400 {object} map[string]string "Bad request - missing required parameters"
// @Failure 404 {object} map[string]string "Custom resource not found"
// @Router /api/v1/customresources/{name}/events [get]
// @Security BearerAuth
// @Security KubeConfig
func (h *CustomResourcesHandler) GetCustomResourceEventsByName(c *gin.Context) {
	// Start main span for custom resource events by name operation
	ctx, span := h.tracingHelper.StartAuthSpan(c.Request.Context(), "custom_resource.get_events_by_name")
	defer span.End()

	group := c.Query("group")
	version := c.Query("version")
	resource := c.Query("resource")
	namespace := c.Query("namespace")
	name := c.Param("name")

	// Add resource attributes
	h.tracingHelper.AddResourceAttributes(span, resource, "custom_resource", 1)

	if group == "" || version == "" || resource == "" {
		err := fmt.Errorf("group, version, and resource parameters are required")
		h.sseHandler.SendSSEError(c, http.StatusBadRequest, err.Error())
		h.tracingHelper.RecordError(span, err, "GetCustomResourceEventsByName failed")
		return
	}

	// Child span for client acquisition
	clientCtx, clientSpan := h.tracingHelper.StartAuthSpan(ctx, "custom_resource.client_acquisition")
	client, err := h.getClientAndConfig(c)
	if err != nil {
		h.logger.WithError(err).Error("Failed to get client for custom resource events")
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		h.tracingHelper.RecordError(clientSpan, err, "Failed to get client")
		clientSpan.End()
		h.tracingHelper.RecordError(span, err, "GetCustomResourceEventsByName failed")
		return
	}

	dynamicClient, err := h.getDynamicClient(c)
	if err != nil {
		h.logger.WithError(err).Error("Failed to get dynamic client for custom resource events")
		h.sseHandler.SendSSEError(c, http.StatusBadRequest, err.Error())
		h.tracingHelper.RecordError(clientSpan, err, "Failed to get dynamic client")
		clientSpan.End()
		h.tracingHelper.RecordError(span, err, "GetCustomResourceEventsByName failed")
		return
	}
	h.tracingHelper.RecordSuccess(clientSpan, "Clients acquired")
	clientSpan.End()

	// Child span for Kubernetes API operations
	apiCtx, apiSpan := h.tracingHelper.StartKubernetesAPISpan(clientCtx, "custom_resource.get_api_call", "get", "custom_resource")
	gvr := schema.GroupVersionResource{Group: group, Version: version, Resource: resource}

	// Fetch the CR to determine its Kind for event filtering
	var obj interface{}
	var err2 error
	if namespace != "" {
		obj, err2 = dynamicClient.Resource(gvr).Namespace(namespace).Get(apiCtx, name, metav1.GetOptions{})
	} else {
		obj, err2 = dynamicClient.Resource(gvr).Get(apiCtx, name, metav1.GetOptions{})
	}
	if err2 != nil {
		h.sseHandler.SendSSEError(c, http.StatusNotFound, err2.Error())
		h.tracingHelper.RecordError(apiSpan, err2, "Failed to get custom resource")
		apiSpan.End()
		h.tracingHelper.RecordError(span, err2, "GetCustomResourceEventsByName failed")
		return
	}
	h.tracingHelper.RecordSuccess(apiSpan, "Custom resource get API call completed")
	apiSpan.End()

	// Child span for data processing
	_, processingSpan := h.tracingHelper.StartDataProcessingSpan(apiCtx, "custom_resource.kind_extraction")
	var kind string
	if u, ok := obj.(*unstructured.Unstructured); ok {
		kind = u.GetKind()
		if kind == "" {
			if k, ok2 := u.Object["kind"].(string); ok2 {
				kind = k
			}
		}
	}
	h.tracingHelper.RecordSuccess(processingSpan, "Kind extraction completed")
	processingSpan.End()

	// Child span for events retrieval
	_, eventsSpan := h.tracingHelper.StartKubernetesAPISpan(apiCtx, "custom_resource.get_events", "list", "events")
	if namespace != "" {
		h.eventsHandler.GetResourceEventsWithNamespace(c, client, kind, name, namespace, h.sseHandler.SendSSEResponse)
	} else {
		h.eventsHandler.GetResourceEvents(c, client, kind, name, h.sseHandler.SendSSEResponse)
	}
	h.tracingHelper.RecordSuccess(eventsSpan, "Events retrieval completed")
	eventsSpan.End()
	h.tracingHelper.RecordSuccess(span, "Custom resource events by name operation completed")
}

// getAdditionalPrinterColumns fetches additional printer columns for a CRD
func (h *CustomResourcesHandler) getAdditionalPrinterColumns(c *gin.Context, dc dynamic.Interface, group, resource, version string) ([]transformers.AdditionalPrinterColumn, error) {
	crdGVR := schema.GroupVersionResource{Group: "apiextensions.k8s.io", Version: "v1", Resource: "customresourcedefinitions"}
	crdName := fmt.Sprintf("%s.%s", resource, group)
	crd, err := dc.Resource(crdGVR).Get(c.Request.Context(), crdName, metav1.GetOptions{})
	if err != nil {
		return []transformers.AdditionalPrinterColumn{}, err
	}
	content := crd.UnstructuredContent()
	spec, _ := content["spec"].(map[string]interface{})
	cols := []transformers.AdditionalPrinterColumn{}

	// Try spec.additionalPrinterColumns first
	if apc, exists := spec["additionalPrinterColumns"].([]interface{}); exists {
		for _, col := range apc {
			if m, ok := col.(map[string]interface{}); ok {
				name, _ := m["name"].(string)
				jp, _ := m["jsonPath"].(string)
				cols = append(cols, transformers.AdditionalPrinterColumn{Name: name, JSONPath: jp})
			}
		}
		return cols, nil
	}

	// Fallback: spec.versions[x].additionalPrinterColumns
	if versions, ok := spec["versions"].([]interface{}); ok {
		// Prefer matching version
		for _, v := range versions {
			if vm, ok := v.(map[string]interface{}); ok {
				vname, _ := vm["name"].(string)
				if vname == version {
					if apc, ok2 := vm["additionalPrinterColumns"].([]interface{}); ok2 {
						for _, col := range apc {
							if m, ok := col.(map[string]interface{}); ok {
								name, _ := m["name"].(string)
								jp, _ := m["jsonPath"].(string)
								cols = append(cols, transformers.AdditionalPrinterColumn{Name: name, JSONPath: jp})
							}
						}
						return cols, nil
					}
				}
			}
		}
		// Otherwise take first version columns
		if len(versions) > 0 {
			if vm, ok := versions[0].(map[string]interface{}); ok {
				if apc, ok2 := vm["additionalPrinterColumns"].([]interface{}); ok2 {
					for _, col := range apc {
						if m, ok := col.(map[string]interface{}); ok {
							name, _ := m["name"].(string)
							jp, _ := m["jsonPath"].(string)
							cols = append(cols, transformers.AdditionalPrinterColumn{Name: name, JSONPath: jp})
						}
					}
				}
			}
		}
	}
	return cols, nil
}
