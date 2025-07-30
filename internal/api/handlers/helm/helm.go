package helm

import (
	"context"
	"fmt"
	"net/http"
	"sync"
	"time"

	"kubewall-backend/internal/api/types"
	"kubewall-backend/internal/api/utils"
	"kubewall-backend/internal/k8s"
	"kubewall-backend/internal/storage"
	"kubewall-backend/pkg/logger"

	"github.com/gin-gonic/gin"
	"gopkg.in/yaml.v2"
	"helm.sh/helm/v3/pkg/action"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/client-go/tools/clientcmd/api"

	appsv1 "k8s.io/api/apps/v1"
	batchv1 "k8s.io/api/batch/v1"
	corev1 "k8s.io/api/core/v1"
	networkingv1 "k8s.io/api/networking/v1"
)

// CacheEntry represents a cached item with expiration
type CacheEntry struct {
	Data      interface{}
	ExpiresAt time.Time
}

// HelmHandler provides methods for handling Helm operations
type HelmHandler struct {
	store         *storage.KubeConfigStore
	clientFactory *k8s.ClientFactory
	helmFactory   *k8s.HelmClientFactory
	logger        *logger.Logger
	yamlHandler   *utils.YAMLHandler
	sseHandler    *utils.SSEHandler

	// Cache for Helm operations
	cache    map[string]CacheEntry
	cacheMux sync.RWMutex
	cacheTTL time.Duration
}

// NewHelmHandler creates a new Helm handler
func NewHelmHandler(store *storage.KubeConfigStore, clientFactory *k8s.ClientFactory, helmFactory *k8s.HelmClientFactory, log *logger.Logger) *HelmHandler {
	handler := &HelmHandler{
		store:         store,
		clientFactory: clientFactory,
		helmFactory:   helmFactory,
		logger:        log,
		yamlHandler:   utils.NewYAMLHandler(log),
		sseHandler:    utils.NewSSEHandler(log),
		cache:         make(map[string]CacheEntry),
		cacheTTL:      120 * time.Second, // Increased to 2 minutes for better performance
	}

	// Start background cache cleanup
	go handler.startCacheCleanup()

	return handler
}

// startCacheCleanup runs periodic cache cleanup
func (h *HelmHandler) startCacheCleanup() {
	ticker := time.NewTicker(5 * time.Minute)
	defer ticker.Stop()

	for range ticker.C {
		h.clearExpiredCache()
	}
}

// getCacheKey generates a cache key for the given parameters
func (h *HelmHandler) getCacheKey(operation string, configID, cluster, namespace string) string {
	return fmt.Sprintf("%s:%s:%s:%s", operation, configID, cluster, namespace)
}

// getFromCache retrieves data from cache if it exists and is not expired
func (h *HelmHandler) getFromCache(key string) (interface{}, bool) {
	h.cacheMux.RLock()
	defer h.cacheMux.RUnlock()

	if entry, exists := h.cache[key]; exists && time.Now().Before(entry.ExpiresAt) {
		return entry.Data, true
	}
	return nil, false
}

// setCache stores data in cache with TTL
func (h *HelmHandler) setCache(key string, data interface{}, ttl time.Duration) {
	h.cacheMux.Lock()
	defer h.cacheMux.Unlock()

	h.cache[key] = CacheEntry{
		Data:      data,
		ExpiresAt: time.Now().Add(ttl),
	}
}

// clearExpiredCache removes expired cache entries
func (h *HelmHandler) clearExpiredCache() {
	h.cacheMux.Lock()
	defer h.cacheMux.Unlock()

	now := time.Now()
	for key, entry := range h.cache {
		if now.After(entry.ExpiresAt) {
			delete(h.cache, key)
		}
	}
}

// refreshCacheInBackground refreshes cache data in background without blocking
func (h *HelmHandler) refreshCacheInBackground(key string, fetchFunc func() (interface{}, error), ttl time.Duration) {
	go func() {
		defer func() {
			if r := recover(); r != nil {
				h.logger.Error("Panic in background cache refresh", "error", r, "key", key)
			}
		}()

		data, err := fetchFunc()
		if err != nil {
			h.logger.Error("Background cache refresh failed", "error", err, "key", key)
			return
		}

		h.setCache(key, data, ttl)
		h.logger.Info("Background cache refresh completed", "key", key)
	}()
}

// getClientAndConfig gets the Kubernetes client and config for the given config ID and cluster
func (h *HelmHandler) getClientAndConfig(c *gin.Context) (*api.Config, error) {
	configID := c.Query("config")

	if configID == "" {
		return nil, fmt.Errorf("config parameter is required")
	}

	config, err := h.store.GetKubeConfig(configID)
	if err != nil {
		return nil, fmt.Errorf("config not found: %w", err)
	}

	return config, nil
}

// GetHelmReleasesSSE returns Helm releases via Server-Sent Events
func (h *HelmHandler) GetHelmReleasesSSE(c *gin.Context) {
	config, err := h.getClientAndConfig(c)
	if err != nil {
		h.sseHandler.SendSSEError(c, http.StatusBadRequest, err.Error())
		return
	}

	cluster := c.Query("cluster")
	namespace := c.Query("namespace")
	configID := c.Query("config")

	// Check cache first
	cacheKey := h.getCacheKey("helmreleases", configID, cluster, namespace)
	if cachedData, found := h.getFromCache(cacheKey); found {
		h.logger.Info("Returning cached Helm releases data", "cluster", cluster)

		// Check if this is an SSE request
		acceptHeader := c.GetHeader("Accept")
		if acceptHeader == "text/event-stream" {
			// For SSE, use cached data and refresh in background
			h.refreshCacheInBackground(cacheKey, func() (interface{}, error) {
				return h.fetchHelmReleasesOptimized(config, cluster, namespace, configID)
			}, h.cacheTTL)

			// Send SSE response with cached data and background refresh
			h.sseHandler.SendSSEResponseWithUpdates(c, cachedData, func() (interface{}, error) {
				// Return cached data immediately, background refresh will update cache
				return cachedData, nil
			})
			return
		}

		// For non-SSE requests, return cached data
		c.JSON(http.StatusOK, cachedData)
		return
	}

	// Function to fetch and transform Helm releases data (optimized)
	fetchHelmReleases := func() (interface{}, error) {
		return h.fetchHelmReleasesOptimized(config, cluster, namespace, configID)
	}

	// Get initial data
	initialData, err := fetchHelmReleases()
	if err != nil {
		h.logger.Error("Failed to get initial Helm releases data", "error", err, "cluster", cluster)
		h.sseHandler.SendSSEError(c, http.StatusInternalServerError, err.Error())
		return
	}

	// Cache the result
	h.setCache(cacheKey, initialData, h.cacheTTL)

	// Check if this is an SSE request (EventSource expects SSE format)
	acceptHeader := c.GetHeader("Accept")
	if acceptHeader == "text/event-stream" {
		// Send SSE response with periodic updates using background refresh
		h.sseHandler.SendSSEResponseWithUpdates(c, initialData, func() (interface{}, error) {
			// Check if we have fresh cached data
			if freshData, found := h.getFromCache(cacheKey); found {
				return freshData, nil
			}
			// Fallback to fetching if cache is empty
			return fetchHelmReleases()
		})
		return
	}

	// For non-SSE requests, return JSON
	c.JSON(http.StatusOK, initialData)
}

// fetchHelmReleasesOptimized fetches Helm releases with optimized performance
func (h *HelmHandler) fetchHelmReleasesOptimized(config *api.Config, cluster, namespace, configID string) (interface{}, error) {
	// Create a context with timeout for Helm operations
	ctx, cancel := context.WithTimeout(context.Background(), 60*time.Second) // Reduced timeout
	defer cancel()

	// Get Helm action configuration
	actionConfig, err := h.helmFactory.GetHelmClientForConfig(config, cluster)
	if err != nil {
		return nil, fmt.Errorf("failed to get Helm client: %v", err)
	}

	// Create Helm list client with optimized settings
	client := action.NewList(actionConfig)

	// Set options for better performance
	if namespace != "" && namespace != "all" {
		client.AllNamespaces = false
	} else {
		client.AllNamespaces = true
	}

	// Only get deployed releases for better performance
	client.Deployed = true
	client.Failed = false
	client.Pending = false
	client.Uninstalled = false
	client.Uninstalling = false
	client.Superseded = false

	// Run the list command with context
	results, err := client.Run()
	if err != nil {
		return nil, fmt.Errorf("failed to list Helm releases: %v", err)
	}

	// Convert to our response format
	releases := []types.HelmRelease{}

	for _, rel := range results {
		// Check if context is cancelled
		select {
		case <-ctx.Done():
			return nil, fmt.Errorf("operation timed out")
		default:
		}

		// Filter by namespace if specified
		if namespace != "" && namespace != "all" && rel.Namespace != namespace {
			continue
		}

		release := types.HelmRelease{
			Name:        rel.Name,
			Namespace:   rel.Namespace,
			Status:      string(rel.Info.Status),
			Revision:    rel.Version,
			Updated:     rel.Info.LastDeployed.Time,
			Chart:       rel.Chart.Metadata.Name,
			AppVersion:  rel.Chart.Metadata.AppVersion,
			Version:     rel.Chart.Metadata.Version,
			Description: rel.Info.Description,
			Notes:       "", // Skip notes for list view to improve performance
		}

		releases = append(releases, release)
	}

	// Cache the result
	cacheKey := h.getCacheKey("helmreleases", configID, cluster, namespace)
	h.setCache(cacheKey, releases, h.cacheTTL)

	return releases, nil
}

// GetHelmReleaseDetails returns detailed information about a specific Helm release
func (h *HelmHandler) GetHelmReleaseDetails(c *gin.Context) {
	config, err := h.getClientAndConfig(c)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	cluster := c.Query("cluster")
	releaseName := c.Param("name")
	namespace := c.Query("namespace")
	configID := c.Query("config")

	// Check cache first for release details
	cacheKey := h.getCacheKey("helmreleasedetails", configID, cluster, releaseName)
	if cachedData, found := h.getFromCache(cacheKey); found {
		h.logger.Info("Returning cached Helm release details", "release", releaseName)

		// Check if this is an SSE request
		acceptHeader := c.GetHeader("Accept")
		if acceptHeader == "text/event-stream" {
			// For SSE, use cached data and refresh in background
			h.refreshCacheInBackground(cacheKey, func() (interface{}, error) {
				return h.fetchHelmReleaseDetailsOptimized(config, cluster, releaseName, namespace, configID)
			}, 5*time.Minute) // 5 minutes TTL for details

			// Send SSE response with cached data and background refresh
			h.sseHandler.SendSSEResponseWithUpdates(c, cachedData, func() (interface{}, error) {
				// Return cached data immediately, background refresh will update cache
				return cachedData, nil
			})
			return
		}

		// For non-SSE requests, return cached data
		c.JSON(http.StatusOK, cachedData)
		return
	}

	// Function to fetch Helm release details (optimized)
	fetchHelmReleaseDetails := func() (interface{}, error) {
		return h.fetchHelmReleaseDetailsOptimized(config, cluster, releaseName, namespace, configID)
	}

	// Get initial data
	initialData, err := fetchHelmReleaseDetails()
	if err != nil {
		h.logger.Error("Failed to get Helm release details", "error", err, "release", releaseName)
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	// Cache the result with longer TTL for details
	h.setCache(cacheKey, initialData, 5*time.Minute) // 5 minutes TTL for details

	// Check if this is an SSE request (EventSource expects SSE format)
	acceptHeader := c.GetHeader("Accept")
	if acceptHeader == "text/event-stream" {
		// Send SSE response with periodic updates using background refresh
		h.sseHandler.SendSSEResponseWithUpdates(c, initialData, func() (interface{}, error) {
			// Check if we have fresh cached data
			if freshData, found := h.getFromCache(cacheKey); found {
				return freshData, nil
			}
			// Fallback to fetching if cache is empty
			return fetchHelmReleaseDetails()
		})
		return
	}

	// For non-SSE requests, return JSON
	c.JSON(http.StatusOK, initialData)
}

// fetchHelmReleaseDetailsOptimized fetches Helm release details with optimized performance
func (h *HelmHandler) fetchHelmReleaseDetailsOptimized(config *api.Config, cluster, releaseName, namespace, configID string) (interface{}, error) {
	// Create a context with timeout for Helm operations
	ctx, cancel := context.WithTimeout(context.Background(), 90*time.Second) // Reduced timeout
	defer cancel()

	// Get Helm action configuration
	actionConfig, err := h.helmFactory.GetHelmClientForConfig(config, cluster)
	if err != nil {
		return nil, fmt.Errorf("failed to get Helm client: %v", err)
	}

	// Get release info first (this is usually faster)
	listClient := action.NewList(actionConfig)
	listClient.AllNamespaces = true
	releases, err := listClient.Run()
	if err != nil {
		return nil, fmt.Errorf("failed to get release info: %v", err)
	}

	var releaseInfo *types.HelmRelease
	for _, rel := range releases {
		if rel.Name == releaseName && (namespace == "" || rel.Namespace == namespace) {
			releaseInfo = &types.HelmRelease{
				Name:        rel.Name,
				Namespace:   rel.Namespace,
				Status:      string(rel.Info.Status),
				Revision:    rel.Version,
				Updated:     rel.Info.LastDeployed.Time,
				Chart:       rel.Chart.Metadata.Name,
				AppVersion:  rel.Chart.Metadata.AppVersion,
				Version:     rel.Chart.Metadata.Version,
				Description: rel.Info.Description,
				Notes:       rel.Info.Notes,
			}
			break
		}
	}

	if releaseInfo == nil {
		return nil, fmt.Errorf("release not found")
	}

	// Initialize response with basic info
	response := types.HelmReleaseDetails{
		Release:   *releaseInfo,
		History:   []types.HelmReleaseHistory{},
		Values:    "",
		Templates: "",
		Manifests: "",
	}

	// Use goroutines to fetch expensive operations concurrently
	var wg sync.WaitGroup
	var valuesErr, historyErr error
	var values interface{}
	var history []types.HelmReleaseHistory

	// Fetch values concurrently
	wg.Add(1)
	go func() {
		defer wg.Done()
		valuesClient := action.NewGetValues(actionConfig)
		values, valuesErr = valuesClient.Run(releaseName)
	}()

	// Fetch history concurrently
	wg.Add(1)
	go func() {
		defer wg.Done()
		historyClient := action.NewHistory(actionConfig)
		helmHistory, err := historyClient.Run(releaseName)
		if err != nil {
			historyErr = err
			return
		}

		// Convert history to our format
		for _, hist := range helmHistory {
			historyItem := types.HelmReleaseHistory{
				Revision:    hist.Version,
				Updated:     hist.Info.LastDeployed.Time,
				Status:      string(hist.Info.Status),
				Chart:       hist.Chart.Metadata.Name,
				AppVersion:  hist.Chart.Metadata.AppVersion,
				Description: hist.Info.Description,
				IsLatest:    hist.Version == releaseInfo.Revision,
			}
			history = append(history, historyItem)
		}
	}()

	// Wait for concurrent operations to complete
	wg.Wait()

	// Process values result
	if valuesErr == nil && values != nil {
		valuesYAML, err := yaml.Marshal(values)
		if err != nil {
			h.logger.Warn("Failed to marshal values to YAML", "error", err, "release", releaseName)
			response.Values = fmt.Sprintf("%v", values)
		} else {
			response.Values = string(valuesYAML)
		}
	}

	// Process history result
	if historyErr == nil {
		response.History = history
	}

	// Get deployments for this release (this is usually fast)
	k8sClient, err := h.clientFactory.GetClientForConfig(config, cluster)
	if err == nil {
		deployments, err := k8sClient.AppsV1().Deployments(releaseInfo.Namespace).List(ctx, metav1.ListOptions{
			LabelSelector: fmt.Sprintf("app.kubernetes.io/instance=%s", releaseName),
		})
		if err == nil {
			for _, deployment := range deployments.Items {
				response.Release.Deployments = append(response.Release.Deployments, deployment.Name)
			}
		}
	}

	return response, nil
}

// GetHelmReleaseHistory returns the history of a specific Helm release
func (h *HelmHandler) GetHelmReleaseHistory(c *gin.Context) {
	config, err := h.getClientAndConfig(c)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	cluster := c.Query("cluster")
	releaseName := c.Param("name")

	// Create a context with timeout for Helm operations - increased for slow Helm operations
	ctx, cancel := context.WithTimeout(c.Request.Context(), 120*time.Second)
	defer cancel()

	// Function to fetch Helm release history
	fetchHelmReleaseHistory := func() (interface{}, error) {
		// Get Helm action configuration
		actionConfig, err := h.helmFactory.GetHelmClientForConfig(config, cluster)
		if err != nil {
			return nil, fmt.Errorf("failed to get Helm client: %v", err)
		}

		select {
		case <-ctx.Done():
			return nil, fmt.Errorf("operation timed out")
		default:
			historyClient := action.NewHistory(actionConfig)
			history, err := historyClient.Run(releaseName)
			if err != nil {
				return nil, fmt.Errorf("failed to get release history: %v", err)
			}

			// Get current release info to determine latest revision
			listClient := action.NewList(actionConfig)
			listClient.AllNamespaces = true
			releases, err := listClient.Run()
			if err != nil {
				return nil, fmt.Errorf("failed to get release info: %v", err)
			}

			var currentRevision int
			for _, rel := range releases {
				if rel.Name == releaseName {
					currentRevision = rel.Version
					break
				}
			}

			// Convert to response format
			historyResponse := []types.HelmReleaseHistoryResponse{}
			for _, hist := range history {
				historyItem := types.HelmReleaseHistoryResponse{
					Revision:    hist.Version,
					Updated:     types.TimeFormat(hist.Info.LastDeployed.Time),
					Status:      string(hist.Info.Status),
					Chart:       hist.Chart.Metadata.Name,
					AppVersion:  hist.Chart.Metadata.AppVersion,
					Description: hist.Info.Description,
					IsLatest:    hist.Version == currentRevision,
				}
				historyResponse = append(historyResponse, historyItem)
			}

			return historyResponse, nil
		}
	}

	// Get initial data
	initialData, err := fetchHelmReleaseHistory()
	if err != nil {
		h.logger.Error("Failed to get Helm release history", "error", err, "release", releaseName)
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	// Check if this is an SSE request (EventSource expects SSE format)
	acceptHeader := c.GetHeader("Accept")
	if acceptHeader == "text/event-stream" {
		// Send SSE response with periodic updates
		h.sseHandler.SendSSEResponseWithUpdates(c, initialData, fetchHelmReleaseHistory)
		return
	}

	// For non-SSE requests, return JSON
	c.JSON(http.StatusOK, initialData)
}

// GetHelmReleaseResources returns all Kubernetes resources created by a specific Helm release
func (h *HelmHandler) GetHelmReleaseResources(c *gin.Context) {
	config, err := h.getClientAndConfig(c)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	cluster := c.Query("cluster")
	releaseName := c.Param("name")
	namespace := c.Query("namespace")
	configID := c.Query("config")

	// Check cache first for release resources
	cacheKey := h.getCacheKey("helmreleaseresources", configID, cluster, releaseName)
	if cachedData, found := h.getFromCache(cacheKey); found {
		h.logger.Info("Returning cached Helm release resources", "release", releaseName)

		// Check if this is an SSE request
		acceptHeader := c.GetHeader("Accept")
		if acceptHeader == "text/event-stream" {
			// For SSE, we still need to provide updates, but use cached data initially
			h.sseHandler.SendSSEResponseWithUpdates(c, cachedData, func() (interface{}, error) {
				return h.fetchHelmReleaseResourcesOptimized(config, cluster, releaseName, namespace, configID)
			})
			return
		}

		// For non-SSE requests, return cached data
		c.JSON(http.StatusOK, cachedData)
		return
	}

	// Function to fetch Helm release resources (optimized)
	fetchHelmReleaseResources := func() (interface{}, error) {
		return h.fetchHelmReleaseResourcesOptimized(config, cluster, releaseName, namespace, configID)
	}

	// Get initial data
	initialData, err := fetchHelmReleaseResources()
	if err != nil {
		h.logger.Error("Failed to get Helm release resources", "error", err, "release", releaseName)
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	// Cache the result with longer TTL for resources
	h.setCache(cacheKey, initialData, 2*time.Minute) // 2 minutes TTL for resources

	// Check if this is an SSE request
	acceptHeader := c.GetHeader("Accept")
	if acceptHeader == "text/event-stream" {
		// Send SSE response with periodic updates
		h.sseHandler.SendSSEResponseWithUpdates(c, initialData, fetchHelmReleaseResources)
		return
	}

	// For non-SSE requests, return JSON
	c.JSON(http.StatusOK, initialData)
}

// fetchHelmReleaseResourcesOptimized fetches Helm release resources with parallel processing
func (h *HelmHandler) fetchHelmReleaseResourcesOptimized(config *api.Config, cluster, releaseName, namespace, configID string) (interface{}, error) {
	// Create a context with timeout for Helm operations
	ctx, cancel := context.WithTimeout(context.Background(), 45*time.Second) // Increased timeout for parallel operations
	defer cancel()

	// Get Helm action configuration
	actionConfig, err := h.helmFactory.GetHelmClientForConfig(config, cluster)
	if err != nil {
		return nil, fmt.Errorf("failed to get Helm client: %v", err)
	}

	// Get Kubernetes client
	k8sClient, err := h.clientFactory.GetClientForConfig(config, cluster)
	if err != nil {
		return nil, fmt.Errorf("failed to get Kubernetes client: %v", err)
	}

	// Use provided namespace or try to get from release
	releaseNamespace := namespace
	if releaseNamespace == "" {
		// Only query all releases if namespace is not provided
		listClient := action.NewList(actionConfig)
		listClient.AllNamespaces = true
		releases, err := listClient.Run()
		if err != nil {
			return nil, fmt.Errorf("failed to get release info: %v", err)
		}

		for _, rel := range releases {
			if rel.Name == releaseName {
				releaseNamespace = rel.Namespace
				break
			}
		}

		if releaseNamespace == "" {
			return nil, fmt.Errorf("release not found")
		}
	}

	// Initialize response
	response := types.HelmReleaseResourcesResponse{
		Resources: []types.HelmReleaseResource{},
		Summary: types.ResourceSummary{
			ByType:   make(map[string]int),
			ByStatus: make(map[string]int),
		},
	}

	// Common label selector for Helm resources
	labelSelector := fmt.Sprintf("app.kubernetes.io/instance=%s", releaseName)

	// Define resource types to query - prioritized by frequency of use
	resourceTypes := []struct {
		kind      string
		apiGroup  string
		version   string
		namespace string
		priority  int // Lower number = higher priority
	}{
		{"Deployment", "apps", "v1", releaseNamespace, 1},
		{"Service", "", "v1", releaseNamespace, 1},
		{"ConfigMap", "", "v1", releaseNamespace, 2},
		{"Secret", "", "v1", releaseNamespace, 2},
		{"PersistentVolumeClaim", "", "v1", releaseNamespace, 3},
		{"ServiceAccount", "", "v1", releaseNamespace, 3},
		{"StatefulSet", "apps", "v1", releaseNamespace, 4},
		{"DaemonSet", "apps", "v1", releaseNamespace, 4},
		{"ReplicaSet", "apps", "v1", releaseNamespace, 5},
		{"Ingress", "networking.k8s.io", "v1", releaseNamespace, 5},
		{"Role", "rbac.authorization.k8s.io", "v1", releaseNamespace, 6},
		{"RoleBinding", "rbac.authorization.k8s.io", "v1", releaseNamespace, 6},
		{"Job", "batch", "v1", releaseNamespace, 7},
		{"CronJob", "batch", "v1", releaseNamespace, 7},
		{"HorizontalPodAutoscaler", "autoscaling", "v2", releaseNamespace, 8},
		{"ClusterRole", "rbac.authorization.k8s.io", "v1", "", 9},
		{"ClusterRoleBinding", "rbac.authorization.k8s.io", "v1", "", 9},
		{"ResourceQuota", "", "v1", releaseNamespace, 10},
		{"PodDisruptionBudget", "policy", "v1", releaseNamespace, 10},
		{"PriorityClass", "scheduling.k8s.io", "v1", "", 11},
	}

	// Use channels to collect results from parallel goroutines
	type resourceResult struct {
		resources []types.HelmReleaseResource
		err       error
		kind      string
	}

	resultChan := make(chan resourceResult, len(resourceTypes))
	var wg sync.WaitGroup

	// Start parallel goroutines for each resource type
	for _, resourceType := range resourceTypes {
		wg.Add(1)
		go func(rt struct {
			kind      string
			apiGroup  string
			version   string
			namespace string
			priority  int
		}) {
			defer wg.Done()

			// Create a context with shorter timeout for individual resource queries
			resourceCtx, resourceCancel := context.WithTimeout(ctx, 15*time.Second)
			defer resourceCancel()

			var resources []types.HelmReleaseResource
			var err error

			// Query resources based on type
			switch rt.kind {
			case "Deployment":
				deployments, err := k8sClient.AppsV1().Deployments(rt.namespace).List(resourceCtx, metav1.ListOptions{
					LabelSelector: labelSelector,
				})
				if err == nil {
					for _, deployment := range deployments.Items {
						resource := types.HelmReleaseResource{
							Name:       deployment.Name,
							Kind:       "Deployment",
							Namespace:  deployment.Namespace,
							Status:     getDeploymentStatus(deployment),
							Age:        getAge(deployment.CreationTimestamp.Time),
							Created:    deployment.CreationTimestamp.Time.Format(time.RFC3339),
							Labels:     deployment.Labels,
							APIVersion: "apps/v1",
						}
						resources = append(resources, resource)
					}
				}

			case "Service":
				services, err := k8sClient.CoreV1().Services(rt.namespace).List(resourceCtx, metav1.ListOptions{
					LabelSelector: labelSelector,
				})
				if err == nil {
					for _, service := range services.Items {
						resource := types.HelmReleaseResource{
							Name:       service.Name,
							Kind:       "Service",
							Namespace:  service.Namespace,
							Status:     getServiceStatus(service),
							Age:        getAge(service.CreationTimestamp.Time),
							Created:    service.CreationTimestamp.Time.Format(time.RFC3339),
							Labels:     service.Labels,
							APIVersion: "v1",
						}
						resources = append(resources, resource)
					}
				}

			case "ConfigMap":
				configMaps, err := k8sClient.CoreV1().ConfigMaps(rt.namespace).List(resourceCtx, metav1.ListOptions{
					LabelSelector: labelSelector,
				})
				if err == nil {
					for _, configMap := range configMaps.Items {
						resource := types.HelmReleaseResource{
							Name:       configMap.Name,
							Kind:       "ConfigMap",
							Namespace:  configMap.Namespace,
							Status:     "Active",
							Age:        getAge(configMap.CreationTimestamp.Time),
							Created:    configMap.CreationTimestamp.Time.Format(time.RFC3339),
							Labels:     configMap.Labels,
							APIVersion: "v1",
						}
						resources = append(resources, resource)
					}
				}

			case "Secret":
				secrets, err := k8sClient.CoreV1().Secrets(rt.namespace).List(resourceCtx, metav1.ListOptions{
					LabelSelector: labelSelector,
				})
				if err == nil {
					for _, secret := range secrets.Items {
						resource := types.HelmReleaseResource{
							Name:       secret.Name,
							Kind:       "Secret",
							Namespace:  secret.Namespace,
							Status:     "Active",
							Age:        getAge(secret.CreationTimestamp.Time),
							Created:    secret.CreationTimestamp.Time.Format(time.RFC3339),
							Labels:     secret.Labels,
							APIVersion: "v1",
						}
						resources = append(resources, resource)
					}
				}

			case "PersistentVolumeClaim":
				pvcs, err := k8sClient.CoreV1().PersistentVolumeClaims(rt.namespace).List(resourceCtx, metav1.ListOptions{
					LabelSelector: labelSelector,
				})
				if err == nil {
					for _, pvc := range pvcs.Items {
						resource := types.HelmReleaseResource{
							Name:       pvc.Name,
							Kind:       "PersistentVolumeClaim",
							Namespace:  pvc.Namespace,
							Status:     string(pvc.Status.Phase),
							Age:        getAge(pvc.CreationTimestamp.Time),
							Created:    pvc.CreationTimestamp.Time.Format(time.RFC3339),
							Labels:     pvc.Labels,
							APIVersion: "v1",
						}
						resources = append(resources, resource)
					}
				}

			case "ServiceAccount":
				serviceAccounts, err := k8sClient.CoreV1().ServiceAccounts(rt.namespace).List(resourceCtx, metav1.ListOptions{
					LabelSelector: labelSelector,
				})
				if err == nil {
					for _, sa := range serviceAccounts.Items {
						resource := types.HelmReleaseResource{
							Name:       sa.Name,
							Kind:       "ServiceAccount",
							Namespace:  sa.Namespace,
							Status:     "Active",
							Age:        getAge(sa.CreationTimestamp.Time),
							Created:    sa.CreationTimestamp.Time.Format(time.RFC3339),
							Labels:     sa.Labels,
							APIVersion: "v1",
						}
						resources = append(resources, resource)
					}
				}

			case "StatefulSet":
				statefulSets, err := k8sClient.AppsV1().StatefulSets(rt.namespace).List(resourceCtx, metav1.ListOptions{
					LabelSelector: labelSelector,
				})
				if err == nil {
					for _, sts := range statefulSets.Items {
						resource := types.HelmReleaseResource{
							Name:       sts.Name,
							Kind:       "StatefulSet",
							Namespace:  sts.Namespace,
							Status:     getStatefulSetStatus(sts),
							Age:        getAge(sts.CreationTimestamp.Time),
							Created:    sts.CreationTimestamp.Time.Format(time.RFC3339),
							Labels:     sts.Labels,
							APIVersion: "apps/v1",
						}
						resources = append(resources, resource)
					}
				}

			case "DaemonSet":
				daemonSets, err := k8sClient.AppsV1().DaemonSets(rt.namespace).List(resourceCtx, metav1.ListOptions{
					LabelSelector: labelSelector,
				})
				if err == nil {
					for _, ds := range daemonSets.Items {
						resource := types.HelmReleaseResource{
							Name:       ds.Name,
							Kind:       "DaemonSet",
							Namespace:  ds.Namespace,
							Status:     getDaemonSetStatus(ds),
							Age:        getAge(ds.CreationTimestamp.Time),
							Created:    ds.CreationTimestamp.Time.Format(time.RFC3339),
							Labels:     ds.Labels,
							APIVersion: "apps/v1",
						}
						resources = append(resources, resource)
					}
				}

			case "ReplicaSet":
				replicaSets, err := k8sClient.AppsV1().ReplicaSets(rt.namespace).List(resourceCtx, metav1.ListOptions{
					LabelSelector: labelSelector,
				})
				if err == nil {
					for _, rs := range replicaSets.Items {
						resource := types.HelmReleaseResource{
							Name:       rs.Name,
							Kind:       "ReplicaSet",
							Namespace:  rs.Namespace,
							Status:     getReplicaSetStatus(rs),
							Age:        getAge(rs.CreationTimestamp.Time),
							Created:    rs.CreationTimestamp.Time.Format(time.RFC3339),
							Labels:     rs.Labels,
							APIVersion: "apps/v1",
						}
						resources = append(resources, resource)
					}
				}

			case "Ingress":
				ingresses, err := k8sClient.NetworkingV1().Ingresses(rt.namespace).List(resourceCtx, metav1.ListOptions{
					LabelSelector: labelSelector,
				})
				if err == nil {
					for _, ingress := range ingresses.Items {
						resource := types.HelmReleaseResource{
							Name:       ingress.Name,
							Kind:       "Ingress",
							Namespace:  ingress.Namespace,
							Status:     getIngressStatus(ingress),
							Age:        getAge(ingress.CreationTimestamp.Time),
							Created:    ingress.CreationTimestamp.Time.Format(time.RFC3339),
							Labels:     ingress.Labels,
							APIVersion: "networking.k8s.io/v1",
						}
						resources = append(resources, resource)
					}
				}

			case "Job":
				jobs, err := k8sClient.BatchV1().Jobs(rt.namespace).List(resourceCtx, metav1.ListOptions{
					LabelSelector: labelSelector,
				})
				if err == nil {
					for _, job := range jobs.Items {
						resource := types.HelmReleaseResource{
							Name:       job.Name,
							Kind:       "Job",
							Namespace:  job.Namespace,
							Status:     getJobStatus(job),
							Age:        getAge(job.CreationTimestamp.Time),
							Created:    job.CreationTimestamp.Time.Format(time.RFC3339),
							Labels:     job.Labels,
							APIVersion: "batch/v1",
						}
						resources = append(resources, resource)
					}
				}

			case "CronJob":
				cronJobs, err := k8sClient.BatchV1().CronJobs(rt.namespace).List(resourceCtx, metav1.ListOptions{
					LabelSelector: labelSelector,
				})
				if err == nil {
					for _, cronJob := range cronJobs.Items {
						resource := types.HelmReleaseResource{
							Name:       cronJob.Name,
							Kind:       "CronJob",
							Namespace:  cronJob.Namespace,
							Status:     getCronJobStatus(cronJob),
							Age:        getAge(cronJob.CreationTimestamp.Time),
							Created:    cronJob.CreationTimestamp.Time.Format(time.RFC3339),
							Labels:     cronJob.Labels,
							APIVersion: "batch/v1",
						}
						resources = append(resources, resource)
					}
				}

			case "HorizontalPodAutoscaler":
				hpas, err := k8sClient.AutoscalingV2().HorizontalPodAutoscalers(rt.namespace).List(resourceCtx, metav1.ListOptions{
					LabelSelector: labelSelector,
				})
				if err == nil {
					for _, hpa := range hpas.Items {
						resource := types.HelmReleaseResource{
							Name:       hpa.Name,
							Kind:       "HorizontalPodAutoscaler",
							Namespace:  hpa.Namespace,
							Status:     "Active",
							Age:        getAge(hpa.CreationTimestamp.Time),
							Created:    hpa.CreationTimestamp.Time.Format(time.RFC3339),
							Labels:     hpa.Labels,
							APIVersion: "autoscaling/v2",
						}
						resources = append(resources, resource)
					}
				}
			}

			// Send result to channel
			resultChan <- resourceResult{
				resources: resources,
				err:       err,
				kind:      rt.kind,
			}
		}(resourceType)
	}

	// Wait for all goroutines to complete
	go func() {
		wg.Wait()
		close(resultChan)
	}()

	// Collect results from all goroutines
	for result := range resultChan {
		if result.err != nil {
			h.logger.Warn("Failed to fetch resources", "kind", result.kind, "error", result.err)
			continue
		}
		response.Resources = append(response.Resources, result.resources...)
	}

	// Calculate summary
	response.Total = len(response.Resources)
	for _, resource := range response.Resources {
		response.Summary.ByType[resource.Kind]++
		response.Summary.ByStatus[resource.Status]++
	}

	return response, nil
}

// Helper functions for status determination
func getDeploymentStatus(deployment appsv1.Deployment) string {
	if deployment.Status.ReadyReplicas == deployment.Status.Replicas && deployment.Status.Replicas > 0 {
		return "Running"
	} else if deployment.Status.Replicas == 0 {
		return "Stopped"
	} else {
		return "Pending"
	}
}

func getServiceStatus(service corev1.Service) string {
	return "Active"
}

func getIngressStatus(ingress networkingv1.Ingress) string {
	if len(ingress.Status.LoadBalancer.Ingress) > 0 {
		return "Active"
	}
	return "Pending"
}

func getDaemonSetStatus(daemonSet appsv1.DaemonSet) string {
	if daemonSet.Status.NumberReady == daemonSet.Status.DesiredNumberScheduled {
		return "Running"
	} else if daemonSet.Status.DesiredNumberScheduled == 0 {
		return "Stopped"
	} else {
		return "Pending"
	}
}

func getStatefulSetStatus(statefulSet appsv1.StatefulSet) string {
	if statefulSet.Status.ReadyReplicas == statefulSet.Status.Replicas && statefulSet.Status.Replicas > 0 {
		return "Running"
	} else if statefulSet.Status.Replicas == 0 {
		return "Stopped"
	} else {
		return "Pending"
	}
}

func getReplicaSetStatus(replicaSet appsv1.ReplicaSet) string {
	if replicaSet.Status.ReadyReplicas == replicaSet.Status.Replicas && replicaSet.Status.Replicas > 0 {
		return "Running"
	} else if replicaSet.Status.Replicas == 0 {
		return "Stopped"
	} else {
		return "Pending"
	}
}

func getJobStatus(job batchv1.Job) string {
	if job.Status.Succeeded > 0 {
		return "Completed"
	} else if job.Status.Failed > 0 {
		return "Failed"
	} else {
		return "Running"
	}
}

func getCronJobStatus(cronJob batchv1.CronJob) string {
	return "Active"
}

func getAge(created time.Time) string {
	duration := time.Since(created)
	if duration < time.Minute {
		return fmt.Sprintf("%ds", int(duration.Seconds()))
	} else if duration < time.Hour {
		return fmt.Sprintf("%dm", int(duration.Minutes()))
	} else if duration < 24*time.Hour {
		return fmt.Sprintf("%dh", int(duration.Hours()))
	} else {
		return fmt.Sprintf("%dd", int(duration.Hours()/24))
	}
}
