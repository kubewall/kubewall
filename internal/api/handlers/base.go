package handlers

import (
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/Facets-cloud/kube-dash/internal/k8s"
	"github.com/Facets-cloud/kube-dash/internal/storage"
	"github.com/Facets-cloud/kube-dash/pkg/logger"

	"github.com/gin-gonic/gin"
	authorizationv1 "k8s.io/api/authorization/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/client-go/dynamic"
	"k8s.io/client-go/kubernetes"
	"k8s.io/client-go/tools/clientcmd"
	"k8s.io/client-go/tools/clientcmd/api"
)

// ResourcesHandler provides methods for handling Kubernetes resource operations
type ResourcesHandler struct {
	store         *storage.KubeConfigStore
	clientFactory *k8s.ClientFactory
	logger        *logger.Logger
	helmHandler   HelmDeleter
}

// HelmDeleter interface for helm deletion operations
type HelmDeleter interface {
	DeleteHelmReleases(c *gin.Context)
}

// NewResourcesHandler creates a new resources handler
func NewResourcesHandler(store *storage.KubeConfigStore, clientFactory *k8s.ClientFactory, log *logger.Logger, helmHandler HelmDeleter) *ResourcesHandler {
	return &ResourcesHandler{
		store:         store,
		clientFactory: clientFactory,
		logger:        log,
		helmHandler:   helmHandler,
	}
}

// getClientAndConfig gets the Kubernetes client and config for the given config ID and cluster
func (h *ResourcesHandler) getClientAndConfig(c *gin.Context) (*kubernetes.Clientset, *api.Config, error) {
	configID := c.Query("config")
	cluster := c.Query("cluster")

	if configID == "" {
		return nil, nil, fmt.Errorf("config parameter is required")
	}

	config, err := h.store.GetKubeConfig(configID)
	if err != nil {
		return nil, nil, fmt.Errorf("config not found: %w", err)
	}

	client, err := h.clientFactory.GetClientForConfig(config, cluster)
	if err != nil {
		return nil, nil, fmt.Errorf("failed to get Kubernetes client: %w", err)
	}

	return client, config, nil
}

// getDynamicClient gets the dynamic client for custom resources
func (h *ResourcesHandler) getDynamicClient(c *gin.Context) (dynamic.Interface, error) {
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

// DeleteResourcesRequest represents a delete request body
type DeleteResourcesRequest []struct {
	Name      string `json:"name"`
	Namespace string `json:"namespace,omitempty"`
}

// DeleteResourcesResponse represents the response containing failures
type DeleteResourcesResponse struct {
	Failures []struct {
		Name      string `json:"name"`
		Message   string `json:"message"`
		Namespace string `json:"namespace,omitempty"`
	} `json:"failures"`
}

// resourceMapping maps resource kinds (as used in API routes) to GroupVersionResource and scope
var resourceMapping = map[string]struct {
	GVR        schema.GroupVersionResource
	Namespaced bool
}{
	// Core v1
	"pods":                   {schema.GroupVersionResource{Group: "", Version: "v1", Resource: "pods"}, true},
	"services":               {schema.GroupVersionResource{Group: "", Version: "v1", Resource: "services"}, true},
	"endpoints":              {schema.GroupVersionResource{Group: "", Version: "v1", Resource: "endpoints"}, true},
	"configmaps":             {schema.GroupVersionResource{Group: "", Version: "v1", Resource: "configmaps"}, true},
	"secrets":                {schema.GroupVersionResource{Group: "", Version: "v1", Resource: "secrets"}, true},
	"namespaces":             {schema.GroupVersionResource{Group: "", Version: "v1", Resource: "namespaces"}, false},
	"nodes":                  {schema.GroupVersionResource{Group: "", Version: "v1", Resource: "nodes"}, false},
	"persistentvolumes":      {schema.GroupVersionResource{Group: "", Version: "v1", Resource: "persistentvolumes"}, false},
	"persistentvolumeclaims": {schema.GroupVersionResource{Group: "", Version: "v1", Resource: "persistentvolumeclaims"}, true},
	"limitranges":            {schema.GroupVersionResource{Group: "", Version: "v1", Resource: "limitranges"}, true},
	"resourcequotas":         {schema.GroupVersionResource{Group: "", Version: "v1", Resource: "resourcequotas"}, true},

	// Networking v1
	"ingresses": {schema.GroupVersionResource{Group: "networking.k8s.io", Version: "v1", Resource: "ingresses"}, true},

	// Apps v1
	"deployments":  {schema.GroupVersionResource{Group: "apps", Version: "v1", Resource: "deployments"}, true},
	"daemonsets":   {schema.GroupVersionResource{Group: "apps", Version: "v1", Resource: "daemonsets"}, true},
	"statefulsets": {schema.GroupVersionResource{Group: "apps", Version: "v1", Resource: "statefulsets"}, true},
	"replicasets":  {schema.GroupVersionResource{Group: "apps", Version: "v1", Resource: "replicasets"}, true},

	// Batch v1
	"jobs":     {schema.GroupVersionResource{Group: "batch", Version: "v1", Resource: "jobs"}, true},
	"cronjobs": {schema.GroupVersionResource{Group: "batch", Version: "v1", Resource: "cronjobs"}, true},

	// Autoscaling (prefer v2 when available)
	"horizontalpodautoscalers": {schema.GroupVersionResource{Group: "autoscaling", Version: "v2", Resource: "horizontalpodautoscalers"}, true},

	// Policy / Scheduling / Node / Storage
	"poddisruptionbudgets": {schema.GroupVersionResource{Group: "policy", Version: "v1", Resource: "poddisruptionbudgets"}, true},
	"priorityclasses":      {schema.GroupVersionResource{Group: "scheduling.k8s.io", Version: "v1", Resource: "priorityclasses"}, false},
	"runtimeclasses":       {schema.GroupVersionResource{Group: "node.k8s.io", Version: "v1", Resource: "runtimeclasses"}, false},
	"storageclasses":       {schema.GroupVersionResource{Group: "storage.k8s.io", Version: "v1", Resource: "storageclasses"}, false},

	// APIExtensions v1
	"customresourcedefinitions": {schema.GroupVersionResource{Group: "apiextensions.k8s.io", Version: "v1", Resource: "customresourcedefinitions"}, false},

	// RBAC
	"serviceaccounts":     {schema.GroupVersionResource{Group: "", Version: "v1", Resource: "serviceaccounts"}, true},
	"roles":               {schema.GroupVersionResource{Group: "rbac.authorization.k8s.io", Version: "v1", Resource: "roles"}, true},
	"rolebindings":        {schema.GroupVersionResource{Group: "rbac.authorization.k8s.io", Version: "v1", Resource: "rolebindings"}, true},
	"clusterroles":        {schema.GroupVersionResource{Group: "rbac.authorization.k8s.io", Version: "v1", Resource: "clusterroles"}, false},
	"clusterrolebindings": {schema.GroupVersionResource{Group: "rbac.authorization.k8s.io", Version: "v1", Resource: "clusterrolebindings"}, false},

	// Helm releases (custom handling)
	"helmreleases": {schema.GroupVersionResource{Group: "helm.sh", Version: "v3", Resource: "releases"}, true},
}

// BulkDeleteResourcesRequest represents a bulk delete request body for 5+ items
type BulkDeleteResourcesRequest struct {
	Items []struct {
		Name      string `json:"name"`
		Namespace string `json:"namespace,omitempty"`
	} `json:"items"`
	BatchSize int `json:"batchSize,omitempty"` // Optional batch size for processing
}

// BulkDeleteResourcesResponse represents the response for bulk operations
type BulkDeleteResourcesResponse struct {
	Total     int `json:"total"`
	Processed int `json:"processed"`
	Succeeded int `json:"succeeded"`
	Failed    int `json:"failed"`
	Failures  []struct {
		Name      string `json:"name"`
		Message   string `json:"message"`
		Namespace string `json:"namespace,omitempty"`
	} `json:"failures"`
	Duration string `json:"duration"`
}

// BulkDeleteResources handles optimized bulk deletion for 5+ items
func (h *ResourcesHandler) BulkDeleteResources(c *gin.Context) {
	startTime := time.Now()
	resourceKind := c.Param("resourcekind")

	// Handle Helm releases specially
	if resourceKind == "helmreleases" {
		if h.helmHandler != nil {
			h.helmHandler.DeleteHelmReleases(c)
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "helm handler not available"})
		return
	}

	// Parse request body
	var req BulkDeleteResourcesRequest
	if err := c.BindJSON(&req); err != nil {
		h.logger.WithError(err).Error("Failed to parse bulk delete request body")
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request body"})
		return
	}

	if len(req.Items) == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "no resources provided"})
		return
	}

	// Enforce minimum threshold for bulk endpoint
	if len(req.Items) < 5 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "bulk endpoint requires at least 5 items, use regular delete endpoint for smaller batches"})
		return
	}

	h.logger.WithFields(map[string]interface{}{
		"resource_kind": resourceKind,
		"item_count":    len(req.Items),
		"batch_size":    req.BatchSize,
	}).Info("Starting bulk delete operation")

	// Handle custom resources via explicit GVR parameters
	var gvr schema.GroupVersionResource
	var namespaced bool
	if resourceKind == "customresources" {
		group := c.Query("group")
		version := c.Query("version")
		resource := c.Query("resource")
		if group == "" || version == "" || resource == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "group, version and resource query params are required for customresources"})
			return
		}
		gvr = schema.GroupVersionResource{Group: group, Version: version, Resource: resource}
		// Determine scope based on presence of namespace in items
		namespaced = false
		for _, item := range req.Items {
			if item.Namespace != "" {
				namespaced = true
				break
			}
		}
	} else {
		mapping, ok := resourceMapping[resourceKind]
		if !ok {
			c.JSON(http.StatusBadRequest, gin.H{"error": fmt.Sprintf("unsupported resource kind: %s", resourceKind)})
			return
		}
		gvr = mapping.GVR
		namespaced = mapping.Namespaced
	}

	dynamicClient, err := h.getDynamicClient(c)
	if err != nil {
		h.logger.WithError(err).Error("Failed to get dynamic client for bulk delete")
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Determine delete options
	var deleteOptions metav1.DeleteOptions
	{
		forceParam := c.DefaultQuery("force", "false")
		gracePeriodParam := c.Query("gracePeriodSeconds")

		if resourceKind == "pods" && (strings.EqualFold(forceParam, "true") || forceParam == "1") {
			gp := int64(0)
			deleteOptions.GracePeriodSeconds = &gp
		} else if gracePeriodParam != "" {
			if gp, err := strconv.ParseInt(gracePeriodParam, 10, 64); err == nil {
				deleteOptions.GracePeriodSeconds = &gp
			}
		}
	}

	// Set default batch size if not provided
	batchSize := req.BatchSize
	if batchSize <= 0 {
		batchSize = 10 // Default batch size for bulk operations
	}

	// Initialize response
	resp := BulkDeleteResourcesResponse{
		Total:     len(req.Items),
		Processed: 0,
		Succeeded: 0,
		Failed:    0,
		Failures:  []struct {
			Name      string `json:"name"`
			Message   string `json:"message"`
			Namespace string `json:"namespace,omitempty"`
		}{},
	}

	// Process deletions in batches with progress logging
	for i := 0; i < len(req.Items); i += batchSize {
		end := i + batchSize
		if end > len(req.Items) {
			end = len(req.Items)
		}

		batch := req.Items[i:end]
		h.logger.WithFields(map[string]interface{}{
			"batch_start": i + 1,
			"batch_end":   end,
			"batch_size":  len(batch),
			"total":       len(req.Items),
		}).Info("Processing bulk delete batch")

		// Process each item in the current batch
		for _, item := range batch {
			var delErr error
			if namespaced {
				if item.Namespace == "" {
					delErr = fmt.Errorf("namespace is required for namespaced resource %s", resourceKind)
				} else {
					delErr = dynamicClient.Resource(gvr).Namespace(item.Namespace).Delete(c.Request.Context(), item.Name, deleteOptions)
				}
			} else {
				delErr = dynamicClient.Resource(gvr).Delete(c.Request.Context(), item.Name, deleteOptions)
			}

			resp.Processed++

			if delErr != nil {
				resp.Failed++
				h.logger.WithError(delErr).WithFields(map[string]interface{}{
					"resource":    resourceKind,
					"name":        item.Name,
					"namespace":   item.Namespace,
					"group":       gvr.Group,
					"version":     gvr.Version,
					"gvrResource": gvr.Resource,
					"batch_progress": fmt.Sprintf("%d/%d", resp.Processed, resp.Total),
				}).Error("Failed to delete resource in bulk operation")

				resp.Failures = append(resp.Failures, struct {
					Name      string `json:"name"`
					Message   string `json:"message"`
					Namespace string `json:"namespace,omitempty"`
				}{Name: item.Name, Message: delErr.Error(), Namespace: item.Namespace})
			} else {
				resp.Succeeded++
			}
		}

		// Add small delay between batches to avoid overwhelming the API server
		if end < len(req.Items) {
			time.Sleep(100 * time.Millisecond)
		}
	}

	resp.Duration = time.Since(startTime).String()

	h.logger.WithFields(map[string]interface{}{
		"resource_kind": resourceKind,
		"total":         resp.Total,
		"succeeded":     resp.Succeeded,
		"failed":        resp.Failed,
		"duration":      resp.Duration,
	}).Info("Completed bulk delete operation")

	// Return success with detailed statistics
	c.JSON(http.StatusOK, resp)
}

// DeleteResources handles bulk deletion for various Kubernetes resources
func (h *ResourcesHandler) DeleteResources(c *gin.Context) {
	resourceKind := c.Param("resourcekind")

	// Handle Helm releases specially
	if resourceKind == "helmreleases" {
		if h.helmHandler != nil {
			h.helmHandler.DeleteHelmReleases(c)
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "helm handler not available"})
		return
	}

	// Parse request body
	var req DeleteResourcesRequest
	if err := c.BindJSON(&req); err != nil {
		h.logger.WithError(err).Error("Failed to parse delete request body")
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request body"})
		return
	}

	if len(req) == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "no resources provided"})
		return
	}

	// Handle custom resources via explicit GVR parameters
	var gvr schema.GroupVersionResource
	var namespaced bool
	if resourceKind == "customresources" {
		group := c.Query("group")
		version := c.Query("version")
		resource := c.Query("resource")
		if group == "" || version == "" || resource == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "group, version and resource query params are required for customresources"})
			return
		}
		gvr = schema.GroupVersionResource{Group: group, Version: version, Resource: resource}
		// Determine scope based on presence of namespace in items; mixed scopes are not supported
		namespaced = false
		for _, item := range req {
			if item.Namespace != "" {
				namespaced = true
				break
			}
		}
	} else {
		mapping, ok := resourceMapping[resourceKind]
		if !ok {
			c.JSON(http.StatusBadRequest, gin.H{"error": fmt.Sprintf("unsupported resource kind: %s", resourceKind)})
			return
		}
		gvr = mapping.GVR
		namespaced = mapping.Namespaced
	}

	dynamicClient, err := h.getDynamicClient(c)
	if err != nil {
		h.logger.WithError(err).Error("Failed to get dynamic client for delete")
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Determine delete options (support force delete for pods and optional gracePeriodSeconds)
	var deleteOptions metav1.DeleteOptions
	{
		forceParam := c.DefaultQuery("force", "false")
		gracePeriodParam := c.Query("gracePeriodSeconds")

		if resourceKind == "pods" && (strings.EqualFold(forceParam, "true") || forceParam == "1") {
			gp := int64(0)
			deleteOptions.GracePeriodSeconds = &gp
		} else if gracePeriodParam != "" {
			if gp, err := strconv.ParseInt(gracePeriodParam, 10, 64); err == nil {
				deleteOptions.GracePeriodSeconds = &gp
			}
		}
	}

	// Process deletions and collect failures
	resp := DeleteResourcesResponse{Failures: []struct {
		Name      string `json:"name"`
		Message   string `json:"message"`
		Namespace string `json:"namespace,omitempty"`
	}{}}

	for _, item := range req {
		var delErr error
		if namespaced {
			if item.Namespace == "" {
				// If namespaced resource but namespace not provided, record failure
				delErr = fmt.Errorf("namespace is required for namespaced resource %s", resourceKind)
			} else {
				delErr = dynamicClient.Resource(gvr).Namespace(item.Namespace).Delete(c.Request.Context(), item.Name, deleteOptions)
			}
		} else {
			delErr = dynamicClient.Resource(gvr).Delete(c.Request.Context(), item.Name, deleteOptions)
		}

		if delErr != nil {
			h.logger.WithError(delErr).WithFields(map[string]interface{}{
				"resource":    resourceKind,
				"name":        item.Name,
				"namespace":   item.Namespace,
				"group":       gvr.Group,
				"version":     gvr.Version,
				"gvrResource": gvr.Resource,
			}).Error("Failed to delete resource")

			resp.Failures = append(resp.Failures, struct {
				Name      string `json:"name"`
				Message   string `json:"message"`
				Namespace string `json:"namespace,omitempty"`
			}{Name: item.Name, Message: delErr.Error(), Namespace: item.Namespace})
		}
	}

	// Always return 200 with summary of failures for frontend to handle partial successes
	c.JSON(http.StatusOK, resp)
}

// CheckPermission checks whether the current user can perform a verb on a resource (optionally in a namespace)
func (h *ResourcesHandler) CheckPermission(c *gin.Context) {
	client, _, err := h.getClientAndConfig(c)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	resourceKind := c.Query("resourcekind")
	verb := c.DefaultQuery("verb", "delete")
	namespace := c.Query("namespace")
	subresource := c.Query("subresource")

	// Handle Helm releases specially - they are not standard Kubernetes resources
	if resourceKind == "helmreleases" {
		// For Helm releases, if we can access the cluster (which we already verified above),
		// we assume the user has permission to manage Helm releases
		c.JSON(http.StatusOK, gin.H{
			"allowed":   true,
			"reason":    "Helm releases permissions are managed through cluster access",
			"group":     "helm.sh",
			"resource":  "releases",
			"verb":      verb,
			"namespace": namespace,
		})
		return
	}

	var gvr schema.GroupVersionResource
	if resourceKind == "customresources" {
		group := c.Query("group")
		resource := c.Query("resource")
		if group == "" || resource == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "group and resource are required for customresources permission check"})
			return
		}
		gvr = schema.GroupVersionResource{Group: group, Resource: resource}
	} else {
		mapping, ok := resourceMapping[resourceKind]
		if !ok {
			c.JSON(http.StatusBadRequest, gin.H{"error": fmt.Sprintf("unsupported resource kind: %s", resourceKind)})
			return
		}
		gvr = mapping.GVR
	}

	accessReview := &authorizationv1.SelfSubjectAccessReview{
		Spec: authorizationv1.SelfSubjectAccessReviewSpec{
			ResourceAttributes: &authorizationv1.ResourceAttributes{
				Group:     gvr.Group,
				Resource:  gvr.Resource,
				Verb:      verb,
				Namespace: namespace,
				Subresource: func() string {
					if subresource != "" {
						return subresource
					}
					return ""
				}(),
			},
		},
	}

	result, err := client.AuthorizationV1().SelfSubjectAccessReviews().Create(c.Request.Context(), accessReview, metav1.CreateOptions{})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": fmt.Sprintf("failed to check permissions: %v", err)})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"allowed":   result.Status.Allowed,
		"reason":    result.Status.Reason,
		"group":     gvr.Group,
		"resource":  gvr.Resource,
		"verb":      verb,
		"namespace": namespace,
	})
}

// CheckYamlEditPermission checks if the user has permissions to edit YAML for a specific resource
func (h *ResourcesHandler) CheckYamlEditPermission(c *gin.Context) {
	client, _, err := h.getClientAndConfig(c)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	resourceKind := c.Query("resourcekind")
	namespace := c.Query("namespace")
	resourceName := c.Query("resourcename")

	var gvr schema.GroupVersionResource
	if resourceKind == "customresources" {
		group := c.Query("group")
		resource := c.Query("resource")
		if group == "" || resource == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "group and resource are required for customresources permission check"})
			return
		}
		gvr = schema.GroupVersionResource{Group: group, Resource: resource}
	} else {
		mapping, ok := resourceMapping[resourceKind]
		if !ok {
			c.JSON(http.StatusBadRequest, gin.H{"error": fmt.Sprintf("unsupported resource kind: %s", resourceKind)})
			return
		}
		gvr = mapping.GVR
	}

	// Check for both update and patch permissions (required for YAML editing)
	verbs := []string{"update", "patch"}
	permissions := make(map[string]bool)

	for _, verb := range verbs {
		accessReview := &authorizationv1.SelfSubjectAccessReview{
			Spec: authorizationv1.SelfSubjectAccessReviewSpec{
				ResourceAttributes: &authorizationv1.ResourceAttributes{
					Group:     gvr.Group,
					Resource:  gvr.Resource,
					Verb:      verb,
					Namespace: namespace,
					Name:      resourceName,
				},
			},
		}

		result, err := client.AuthorizationV1().SelfSubjectAccessReviews().Create(c.Request.Context(), accessReview, metav1.CreateOptions{})
		if err != nil {
			h.logger.WithError(err).Errorf("Failed to check %s permission for YAML editing", verb)
			c.JSON(http.StatusInternalServerError, gin.H{"error": fmt.Sprintf("failed to check %s permissions: %v", verb, err)})
			return
		}

		permissions[verb] = result.Status.Allowed
	}

	// User needs both update and patch permissions to edit YAML
	canEdit := permissions["update"] && permissions["patch"]

	c.JSON(http.StatusOK, gin.H{
		"allowed":     canEdit,
		"permissions": permissions,
		"reason": func() string {
			if canEdit {
				return "User has required permissions for YAML editing"
			}
			reasons := []string{}
			if !permissions["update"] {
				reasons = append(reasons, "update permission denied")
			}
			if !permissions["patch"] {
				reasons = append(reasons, "patch permission denied")
			}
			return strings.Join(reasons, ", ")
		}(),
		"group":     gvr.Group,
		"resource":  gvr.Resource,
		"namespace": namespace,
		"name":      resourceName,
	})
}

// sendSSEResponse sends a Server-Sent Events response with real-time updates
func (h *ResourcesHandler) sendSSEResponse(c *gin.Context, data interface{}) {
	c.Header("Content-Type", "text/event-stream")
	c.Header("Cache-Control", "no-cache")
	c.Header("Connection", "keep-alive")
	c.Header("Access-Control-Allow-Origin", "*")
	c.Header("Access-Control-Allow-Headers", "Cache-Control")

	// Send initial data
	jsonData, err := json.Marshal(data)
	if err != nil {
		h.logger.WithError(err).Error("Failed to marshal SSE data")
		return
	}

	// Send data directly without event wrapper
	c.Data(http.StatusOK, "text/event-stream", []byte("data: "+string(jsonData)+"\n\n"))
	c.Writer.Flush()

	// Set up periodic updates (every 10 seconds for real-time updates)
	ticker := time.NewTicker(10 * time.Second)
	defer ticker.Stop()

	// Keep connection alive with periodic updates
	for {
		select {
		case <-c.Request.Context().Done():
			h.logger.Info("SSE connection closed by client")
			return
		case <-ticker.C:
			// Send a keep-alive comment to prevent connection timeout
			c.Data(http.StatusOK, "text/event-stream", []byte(": keep-alive\n\n"))
			c.Writer.Flush()
		}
	}
}

// sendSSEResponseWithUpdates sends a Server-Sent Events response with periodic data updates
func (h *ResourcesHandler) sendSSEResponseWithUpdates(c *gin.Context, data interface{}, updateFunc func() (interface{}, error)) {
	// Set proper headers for SSE
	c.Header("Content-Type", "text/event-stream")
	c.Header("Cache-Control", "no-cache, no-store, must-revalidate")
	c.Header("Connection", "keep-alive")
	c.Header("Access-Control-Allow-Origin", "*")
	c.Header("Access-Control-Allow-Headers", "Cache-Control")
	c.Header("X-Accel-Buffering", "no") // Disable nginx buffering if present

	// Send initial data
	jsonData, err := json.Marshal(data)
	if err != nil {
		h.logger.WithError(err).Error("Failed to marshal SSE data")
		return
	}

	// Send data directly without event wrapper
	c.Data(http.StatusOK, "text/event-stream", []byte("data: "+string(jsonData)+"\n\n"))
	c.Writer.Flush()

	// Set up periodic updates (every 10 seconds for real-time updates)
	ticker := time.NewTicker(10 * time.Second)
	defer ticker.Stop()

	// Keep connection alive with periodic updates
	for {
		select {
		case <-c.Request.Context().Done():
			h.logger.Info("SSE connection closed by client")
			return
		case <-ticker.C:
			// Fetch fresh data and send update
			if updateFunc != nil {
				freshData, err := updateFunc()
				if err != nil {
					h.logger.WithError(err).Error("Failed to fetch fresh data for SSE update")
					// Send keep-alive
					c.Data(http.StatusOK, "text/event-stream", []byte(": keep-alive\n\n"))
					c.Writer.Flush()
					continue
				}

				jsonData, err := json.Marshal(freshData)
				if err != nil {
					h.logger.WithError(err).Error("Failed to marshal fresh SSE data")
					// Send keep-alive
					c.Data(http.StatusOK, "text/event-stream", []byte(": keep-alive\n\n"))
					c.Writer.Flush()
					continue
				}

				// Send data directly without event wrapper
				c.Data(http.StatusOK, "text/event-stream", []byte("data: "+string(jsonData)+"\n\n"))
				c.Writer.Flush()
			} else {
				// Send a keep-alive
				c.Data(http.StatusOK, "text/event-stream", []byte(": keep-alive\n\n"))
				c.Writer.Flush()
			}
		}
	}
}

// sendSSEError sends a Server-Sent Events error response
func (h *ResourcesHandler) sendSSEError(c *gin.Context, statusCode int, message string) {
	c.Header("Content-Type", "text/event-stream")
	c.Header("Cache-Control", "no-cache")
	c.Header("Connection", "keep-alive")
	c.Header("Access-Control-Allow-Origin", "*")
	c.Header("Access-Control-Allow-Headers", "Cache-Control")

	errorData := gin.H{"error": message}
	jsonData, err := json.Marshal(errorData)
	if err != nil {
		h.logger.WithError(err).Error("Failed to marshal SSE error data")
		return
	}

	c.SSEvent("error", string(jsonData))
	c.Writer.Flush()
}
