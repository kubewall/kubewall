package helm

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"strings"
	"sync"
	"time"

	"github.com/Facets-cloud/kube-dash/internal/api/types"
	"github.com/Facets-cloud/kube-dash/internal/api/utils"
	"github.com/Facets-cloud/kube-dash/internal/k8s"
	"github.com/Facets-cloud/kube-dash/internal/storage"
	"github.com/Facets-cloud/kube-dash/internal/tracing"
	"github.com/Facets-cloud/kube-dash/pkg/logger"

	"github.com/gin-gonic/gin"
	"gopkg.in/yaml.v2"
	"helm.sh/helm/v3/pkg/action"
	"helm.sh/helm/v3/pkg/chart/loader"
	"helm.sh/helm/v3/pkg/cli"
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
	tracingHelper *tracing.TracingHelper

	// Cache for Helm operations
	cache    map[string]CacheEntry
	cacheMux sync.RWMutex
	cacheTTL time.Duration

	// Artifact Hub package ID -> repository path mapping (e.g., helm/<repo>/<chart>)
	pkgIDRepoPath map[string]string
	pkgMux        sync.RWMutex

	// Cache for quick chart name -> repo path resolution to avoid repeated AH searches
	chartNameRepoPath map[string]string
	chartNameMux      sync.RWMutex
}

// NewHelmHandler creates a new Helm handler
func NewHelmHandler(store *storage.KubeConfigStore, clientFactory *k8s.ClientFactory, helmFactory *k8s.HelmClientFactory, log *logger.Logger) *HelmHandler {
	handler := &HelmHandler{
		store:             store,
		clientFactory:     clientFactory,
		helmFactory:       helmFactory,
		logger:            log,
		yamlHandler:       utils.NewYAMLHandler(log),
		sseHandler:        utils.NewSSEHandler(log),
		tracingHelper:     tracing.GetTracingHelper(),
		cache:             make(map[string]CacheEntry),
		cacheTTL:          120 * time.Second, // Increased to 2 minutes for better performance
		pkgIDRepoPath:     make(map[string]string),
		chartNameRepoPath: make(map[string]string),
	}

	// Start background cache cleanup
	go handler.startCacheCleanup()

	return handler
}

// setPackageRepoPath stores a mapping of Artifact Hub package ID to repository path
func (h *HelmHandler) setPackageRepoPath(packageID, repo, chart string) {
	if packageID == "" || repo == "" || chart == "" {
		return
	}
	repoPath := fmt.Sprintf("helm/%s/%s", repo, chart)
	h.pkgMux.Lock()
	h.pkgIDRepoPath[packageID] = repoPath
	h.pkgMux.Unlock()
}

// packageIDToRepoPath returns repository path for a given Artifact Hub package ID
func (h *HelmHandler) packageIDToRepoPath(packageID string) (string, bool) {
	h.pkgMux.RLock()
	defer h.pkgMux.RUnlock()
	repoPath, ok := h.pkgIDRepoPath[packageID]
	return repoPath, ok
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
	// Create main span for the operation
	ctx, span := h.tracingHelper.StartAuthSpan(c.Request.Context(), "helm.get_releases_sse")
	defer span.End()

	config, err := h.getClientAndConfig(c)
	if err != nil {
		h.tracingHelper.RecordError(span, err, "GetHelmReleasesSSE failed")
		h.sseHandler.SendSSEError(c, http.StatusBadRequest, err.Error())
		return
	}

	cluster := c.Query("cluster")
	namespace := c.Query("namespace")
	configID := c.Query("config")

	// Add resource attributes
	h.tracingHelper.AddResourceAttributes(span, cluster, "helm_cluster", 1)

	// Create child span for cache operations
	_, cacheSpan := h.tracingHelper.StartDataProcessingSpan(ctx, "helm.check_cache")
	// Check cache first
	cacheKey := h.getCacheKey("helmreleases", configID, cluster, namespace)
	if cachedData, found := h.getFromCache(cacheKey); found {
		h.logger.Info("Returning cached Helm releases data", "cluster", cluster)
		h.tracingHelper.RecordSuccess(cacheSpan, "Cache hit - returning cached data")
		cacheSpan.End()

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
			h.tracingHelper.RecordSuccess(span, "GetHelmReleasesSSE completed successfully (SSE with cache)")
			return
		}

		// For non-SSE requests, return cached data
		c.JSON(http.StatusOK, cachedData)
		h.tracingHelper.RecordSuccess(span, "GetHelmReleasesSSE completed successfully (cached)")
		return
	}
	h.tracingHelper.RecordSuccess(cacheSpan, "Cache miss - proceeding to fetch data")
	cacheSpan.End()

	// Create child span for data fetching
	_, dataSpan := h.tracingHelper.StartDataProcessingSpan(ctx, "helm.fetch_releases")
	// Function to fetch and transform Helm releases data (optimized)
	fetchHelmReleases := func() (interface{}, error) {
		return h.fetchHelmReleasesOptimized(config, cluster, namespace, configID)
	}

	// Get initial data
	initialData, err := fetchHelmReleases()
	if err != nil {
		h.logger.Error("Failed to get initial Helm releases data", "error", err, "cluster", cluster)
		h.tracingHelper.RecordError(dataSpan, err, "Failed to fetch Helm releases")
		dataSpan.End()
		h.tracingHelper.RecordError(span, err, "GetHelmReleasesSSE failed")

		// Check if this is a permission error
		if utils.IsPermissionError(err) {
			h.sseHandler.SendSSEPermissionError(c, err)
		} else {
			h.sseHandler.SendSSEError(c, http.StatusInternalServerError, err.Error())
		}
		return
	}

	// Cache the result
	h.setCache(cacheKey, initialData, h.cacheTTL)
	h.tracingHelper.RecordSuccess(dataSpan, "Successfully fetched Helm releases")
	dataSpan.End()

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
		h.tracingHelper.RecordSuccess(span, "GetHelmReleasesSSE completed successfully (SSE)")
		return
	}

	// For non-SSE requests, return JSON
	c.JSON(http.StatusOK, initialData)
	h.tracingHelper.RecordSuccess(span, "GetHelmReleasesSSE completed successfully (JSON)")
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
	// Start main span for Helm release details operation
	ctx, span := h.tracingHelper.StartAuthSpan(c.Request.Context(), "helm.get_release_details")
	defer span.End()

	// Child span for client acquisition
	clientCtx, clientSpan := h.tracingHelper.StartAuthSpan(ctx, "helm.client_acquisition")
	config, err := h.getClientAndConfig(c)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		h.tracingHelper.RecordError(clientSpan, err, "Failed to get client and config")
		clientSpan.End()
		h.tracingHelper.RecordError(span, err, "GetHelmReleaseDetails failed")
		return
	}
	h.tracingHelper.RecordSuccess(clientSpan, "Client configuration acquired")
	clientSpan.End()

	cluster := c.Query("cluster")
	releaseName := c.Param("name")
	namespace := c.Query("namespace")
	configID := c.Query("config")

	// Add resource attributes
	h.tracingHelper.AddResourceAttributes(span, releaseName, "helm_release", 1)

	// Child span for cache operations
	cacheCtx, cacheSpan := h.tracingHelper.StartDataProcessingSpan(clientCtx, "helm.cache_check")
	// Check cache first for release details
	cacheKey := h.getCacheKey("helmreleasedetails", configID, cluster, releaseName)
	if cachedData, found := h.getFromCache(cacheKey); found {
		h.logger.Info("Returning cached Helm release details", "release", releaseName)
		h.tracingHelper.RecordSuccess(cacheSpan, "Cache hit - returning cached data")
		cacheSpan.End()

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
			h.tracingHelper.RecordSuccess(span, "Helm release details SSE operation completed")
			return
		}

		// For non-SSE requests, return cached data
		c.JSON(http.StatusOK, cachedData)
		h.tracingHelper.RecordSuccess(span, "Helm release details operation completed (cached)")
		return
	}
	h.tracingHelper.RecordSuccess(cacheSpan, "Cache miss - proceeding to fetch data")
	cacheSpan.End()

	// Child span for data fetching
	_, dataSpan := h.tracingHelper.StartKubernetesAPISpan(cacheCtx, "fetch_release_details", "helm", namespace)
	// Function to fetch Helm release details (optimized)
	fetchHelmReleaseDetails := func() (interface{}, error) {
		return h.fetchHelmReleaseDetailsOptimized(config, cluster, releaseName, namespace, configID)
	}

	// Get initial data
	initialData, err := fetchHelmReleaseDetails()
	if err != nil {
		h.logger.Error("Failed to get Helm release details", "error", err, "release", releaseName)
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		h.tracingHelper.RecordError(dataSpan, err, "Failed to fetch Helm release details")
		dataSpan.End()
		h.tracingHelper.RecordError(span, err, "GetHelmReleaseDetails failed")
		return
	}
	h.tracingHelper.RecordSuccess(dataSpan, "Helm release details fetched successfully")
	dataSpan.End()

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
		h.tracingHelper.RecordSuccess(span, "Helm release details SSE operation completed")
		return
	}

	// For non-SSE requests, return JSON
	c.JSON(http.StatusOK, initialData)
	h.tracingHelper.RecordSuccess(span, "Helm release details operation completed")
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
	// Start main span for Helm release history operation
	ctx, span := h.tracingHelper.StartAuthSpan(c.Request.Context(), "helm.get_release_history")
	defer span.End()

	// Child span for client acquisition
	clientCtx, clientSpan := h.tracingHelper.StartAuthSpan(ctx, "helm.client_acquisition")
	config, err := h.getClientAndConfig(c)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		h.tracingHelper.RecordError(clientSpan, err, "Failed to get client and config")
		clientSpan.End()
		h.tracingHelper.RecordError(span, err, "GetHelmReleaseHistory failed")
		return
	}
	h.tracingHelper.RecordSuccess(clientSpan, "Client configuration acquired")
	clientSpan.End()

	cluster := c.Query("cluster")
	releaseName := c.Param("name")

	// Add resource attributes
	h.tracingHelper.AddResourceAttributes(span, releaseName, "helm_release", 1)

	// Create a context with timeout for Helm operations - increased for slow Helm operations
	timeoutCtx, cancel := context.WithTimeout(c.Request.Context(), 120*time.Second)
	defer cancel()

	// Function to fetch Helm release history
	fetchHelmReleaseHistory := func() (interface{}, error) {
		// Get Helm action configuration
		actionConfig, err := h.helmFactory.GetHelmClientForConfig(config, cluster)
		if err != nil {
			return nil, fmt.Errorf("failed to get Helm client: %v", err)
		}

		select {
		case <-timeoutCtx.Done():
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

	// Child span for data fetching
	_, dataSpan := h.tracingHelper.StartKubernetesAPISpan(clientCtx, "fetch_release_history", "helm", "")
	// Get initial data
	initialData, err := fetchHelmReleaseHistory()
	if err != nil {
		h.logger.Error("Failed to get Helm release history", "error", err, "release", releaseName)
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		h.tracingHelper.RecordError(dataSpan, err, "Failed to fetch Helm release history")
		dataSpan.End()
		h.tracingHelper.RecordError(span, err, "GetHelmReleaseHistory failed")
		return
	}
	h.tracingHelper.RecordSuccess(dataSpan, "Helm release history fetched successfully")
	dataSpan.End()

	// Check if this is an SSE request (EventSource expects SSE format)
	acceptHeader := c.GetHeader("Accept")
	if acceptHeader == "text/event-stream" {
		// Send SSE response with periodic updates
		h.sseHandler.SendSSEResponseWithUpdates(c, initialData, fetchHelmReleaseHistory)
		h.tracingHelper.RecordSuccess(span, "Helm release history SSE operation completed")
		return
	}

	// For non-SSE requests, return JSON
	c.JSON(http.StatusOK, initialData)
	h.tracingHelper.RecordSuccess(span, "Helm release history operation completed")
}

// GetHelmReleaseResources returns all Kubernetes resources created by a specific Helm release
func (h *HelmHandler) GetHelmReleaseResources(c *gin.Context) {
	// Start main span for Helm release resources operation
	ctx, span := h.tracingHelper.StartAuthSpan(c.Request.Context(), "helm.get_release_resources")
	defer span.End()

	// Child span for client acquisition
	clientCtx, clientSpan := h.tracingHelper.StartAuthSpan(ctx, "helm.client_acquisition")
	config, err := h.getClientAndConfig(c)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		h.tracingHelper.RecordError(clientSpan, err, "Failed to get client and config")
		clientSpan.End()
		h.tracingHelper.RecordError(span, err, "GetHelmReleaseResources failed")
		return
	}
	h.tracingHelper.RecordSuccess(clientSpan, "Client configuration acquired")
	clientSpan.End()

	cluster := c.Query("cluster")
	releaseName := c.Param("name")

	// Add resource attributes
	h.tracingHelper.AddResourceAttributes(span, releaseName, "helm_release", 1)
	namespace := c.Query("namespace")
	configID := c.Query("config")

	// Child span for cache check
	_, cacheSpan := h.tracingHelper.StartDataProcessingSpan(clientCtx, "helm.cache_check")
	// Check cache first for release resources
	cacheKey := h.getCacheKey("helmreleaseresources", configID, cluster, releaseName)
	if cachedData, found := h.getFromCache(cacheKey); found {
		h.logger.Info("Returning cached Helm release resources", "release", releaseName)
		h.tracingHelper.RecordSuccess(cacheSpan, "Cache hit for Helm release resources")
		cacheSpan.End()

		// Check if this is an SSE request
		acceptHeader := c.GetHeader("Accept")
		if acceptHeader == "text/event-stream" {
			// For SSE, we still need to provide updates, but use cached data initially
			h.sseHandler.SendSSEResponseWithUpdates(c, cachedData, func() (interface{}, error) {
				return h.fetchHelmReleaseResourcesOptimized(config, cluster, releaseName, namespace, configID)
			})
			h.tracingHelper.RecordSuccess(span, "Helm release resources SSE operation completed (cached)")
			return
		}

		// For non-SSE requests, return cached data
		c.JSON(http.StatusOK, cachedData)
		h.tracingHelper.RecordSuccess(span, "Helm release resources operation completed (cached)")
		return
	}
	h.tracingHelper.RecordSuccess(cacheSpan, "Cache miss for Helm release resources")
	cacheSpan.End()

	// Function to fetch Helm release resources (optimized)
	fetchHelmReleaseResources := func() (interface{}, error) {
		return h.fetchHelmReleaseResourcesOptimized(config, cluster, releaseName, namespace, configID)
	}

	// Child span for data fetching
	_, dataSpan := h.tracingHelper.StartKubernetesAPISpan(clientCtx, "fetch_release_resources", "helm", namespace)
	// Get initial data
	initialData, err := fetchHelmReleaseResources()
	if err != nil {
		h.logger.Error("Failed to get Helm release resources", "error", err, "release", releaseName)
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		h.tracingHelper.RecordError(dataSpan, err, "Failed to fetch Helm release resources")
		dataSpan.End()
		h.tracingHelper.RecordError(span, err, "GetHelmReleaseResources failed")
		return
	}
	h.tracingHelper.RecordSuccess(dataSpan, "Helm release resources fetched successfully")
	dataSpan.End()

	// Cache the result with longer TTL for resources
	h.setCache(cacheKey, initialData, 2*time.Minute) // 2 minutes TTL for resources

	// Check if this is an SSE request
	acceptHeader := c.GetHeader("Accept")
	if acceptHeader == "text/event-stream" {
		// Send SSE response with periodic updates
		h.sseHandler.SendSSEResponseWithUpdates(c, initialData, fetchHelmReleaseResources)
		h.tracingHelper.RecordSuccess(span, "Helm release resources SSE operation completed")
		return
	}

	// For non-SSE requests, return JSON
	c.JSON(http.StatusOK, initialData)
	h.tracingHelper.RecordSuccess(span, "Helm release resources operation completed")
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

// DeleteHelmReleases handles deletion of Helm releases
func (h *HelmHandler) DeleteHelmReleases(c *gin.Context) {
	// Create main span for the operation
	ctx, span := h.tracingHelper.StartAuthSpan(c.Request.Context(), "DeleteHelmReleases")
	defer span.End()

	// Parse request body
	var req []struct {
		Name      string `json:"name"`
		Namespace string `json:"namespace,omitempty"`
	}
	if err := c.BindJSON(&req); err != nil {
		h.logger.WithError(err).Error("Failed to parse delete request body")
		h.tracingHelper.RecordError(span, err, "DeleteHelmReleases failed")
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request body"})
		return
	}

	if len(req) == 0 {
		err := fmt.Errorf("no releases provided")
		h.tracingHelper.RecordError(span, err, "DeleteHelmReleases failed")
		c.JSON(http.StatusBadRequest, gin.H{"error": "no releases provided"})
		return
	}

	// Add resource attributes
	releaseNames := make([]string, len(req))
	for i, r := range req {
		releaseNames[i] = r.Name
	}
	h.tracingHelper.AddResourceAttributes(span, fmt.Sprintf("%d_releases", len(req)), "helm_releases", len(req))

	// Create child span for client setup
	_, clientSpan := h.tracingHelper.StartAuthSpan(c.Request.Context(), "SetupHelmClient")
	config, err := h.getClientAndConfig(c)
	if err != nil {
		h.tracingHelper.RecordError(clientSpan, err, "Failed to get client config")
		clientSpan.End()
		h.tracingHelper.RecordError(span, err, "DeleteHelmReleases failed")
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	cluster := c.Query("cluster")

	// Get Helm action configuration
	actionConfig, err := h.helmFactory.GetHelmClientForConfig(config, cluster)
	if err != nil {
		h.logger.WithError(err).Error("Failed to get Helm client for delete")
		h.tracingHelper.RecordError(clientSpan, err, "Failed to get Helm client")
		clientSpan.End()
		h.tracingHelper.RecordError(span, err, "DeleteHelmReleases failed")
		c.JSON(http.StatusBadRequest, gin.H{"error": fmt.Sprintf("failed to get Helm client: %v", err)})
		return
	}
	h.tracingHelper.RecordSuccess(clientSpan, "Helm client setup completed")
	clientSpan.End()

	// Create child span for deletion processing
	_, deleteSpan := h.tracingHelper.StartKubernetesAPISpan(ctx, "delete", "helm_releases", "")

	// Process deletions and collect failures
	type DeleteFailure struct {
		Name      string `json:"name"`
		Message   string `json:"message"`
		Namespace string `json:"namespace,omitempty"`
	}

	resp := struct {
		Failures []DeleteFailure `json:"failures"`
	}{
		Failures: []DeleteFailure{},
	}

	successCount := 0
	for _, item := range req {
		// Create uninstall client
		uninstallClient := action.NewUninstall(actionConfig)

		// Set options for uninstall
		uninstallClient.Wait = true
		uninstallClient.Timeout = 300 * time.Second // 5 minutes timeout

		// Perform the uninstall
		_, err := uninstallClient.Run(item.Name)
		if err != nil {
			h.logger.WithError(err).WithFields(map[string]interface{}{
				"release":   item.Name,
				"namespace": item.Namespace,
				"cluster":   cluster,
			}).Error("Failed to delete Helm release")

			resp.Failures = append(resp.Failures, DeleteFailure{
				Name:      item.Name,
				Message:   err.Error(),
				Namespace: item.Namespace,
			})
		} else {
			successCount++
			h.logger.Info("Successfully deleted Helm release", "release", item.Name, "cluster", cluster)

			// Clear cache for this release
			configID := c.Query("config")
			cacheKey := h.getCacheKey("helmreleases", configID, cluster, "")
			h.cacheMux.Lock()
			delete(h.cache, cacheKey)
			h.cacheMux.Unlock()
		}
	}

	// Record deletion results
	h.tracingHelper.AddResourceAttributes(deleteSpan, fmt.Sprintf("%d_deletions", len(req)), "helm_deletions", len(req))

	if len(resp.Failures) == 0 {
		h.tracingHelper.RecordSuccess(deleteSpan, "All releases deleted successfully")
	} else if successCount > 0 {
		h.tracingHelper.RecordSuccess(deleteSpan, fmt.Sprintf("Partial success: %d deleted, %d failed", successCount, len(resp.Failures)))
	} else {
		h.tracingHelper.RecordError(deleteSpan, fmt.Errorf("all deletions failed"), "All release deletions failed")
	}
	deleteSpan.End()

	// Always return 200 with summary of failures for frontend to handle partial successes
	c.JSON(http.StatusOK, resp)

	if len(resp.Failures) == 0 {
		h.tracingHelper.RecordSuccess(span, "DeleteHelmReleases completed successfully")
	} else {
		h.tracingHelper.RecordSuccess(span, "DeleteHelmReleases completed with partial success")
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

// RollbackHelmRelease handles rollback of a Helm release to a specific revision
func (h *HelmHandler) RollbackHelmRelease(c *gin.Context) {
	// Start main span for Helm rollback operation
	ctx, span := h.tracingHelper.StartAuthSpan(c.Request.Context(), "helm.rollback_release")
	defer span.End()

	releaseName := c.Param("name")
	if releaseName == "" {
		err := fmt.Errorf("release name is required")
		c.JSON(http.StatusBadRequest, gin.H{"error": "release name is required"})
		h.tracingHelper.RecordError(span, err, "RollbackHelmRelease failed")
		return
	}

	// Parse request body for revision
	var req struct {
		Revision int `json:"revision"`
	}
	if err := c.BindJSON(&req); err != nil {
		h.logger.WithError(err).Error("Failed to parse rollback request body")
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request body"})
		h.tracingHelper.RecordError(span, err, "RollbackHelmRelease failed")
		return
	}

	// Add resource attributes
	h.tracingHelper.AddResourceAttributes(span, releaseName, "helm_release", 1)

	// Child span for client acquisition
	clientCtx, clientSpan := h.tracingHelper.StartAuthSpan(ctx, "helm.client_acquisition")
	config, err := h.getClientAndConfig(c)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		h.tracingHelper.RecordError(clientSpan, err, "Failed to get client config")
		clientSpan.End()
		h.tracingHelper.RecordError(span, err, "UpgradeHelmChart failed")
		return
	}

	cluster := c.Query("cluster")

	// Get Helm action configuration
	actionConfig, err := h.helmFactory.GetHelmClientForConfig(config, cluster)
	if err != nil {
		h.logger.WithError(err).Error("Failed to get Helm client for rollback")
		c.JSON(http.StatusBadRequest, gin.H{"error": fmt.Sprintf("failed to get Helm client: %v", err)})
		h.tracingHelper.RecordError(clientSpan, err, "Failed to get Helm client")
		clientSpan.End()
		h.tracingHelper.RecordError(span, err, "RollbackHelmRelease failed")
		return
	}
	h.tracingHelper.RecordSuccess(clientSpan, "Client configuration acquired")
	clientSpan.End()

	// Child span for rollback execution
	_, rollbackSpan := h.tracingHelper.StartKubernetesAPISpan(clientCtx, "rollback", "helm_release", "")
	// Create rollback client
	rollbackClient := action.NewRollback(actionConfig)
	// Fire-and-forget: do not wait for resources to become ready
	rollbackClient.Wait = false
	rollbackClient.Timeout = 300 * time.Second // 5 minutes timeout
	rollbackClient.Version = req.Revision

	// Perform the rollback
	err = rollbackClient.Run(releaseName)
	if err != nil {
		h.logger.WithError(err).WithFields(map[string]interface{}{
			"release":  releaseName,
			"revision": req.Revision,
			"cluster":  cluster,
		}).Error("Failed to rollback Helm release")
		c.JSON(http.StatusInternalServerError, gin.H{"error": fmt.Sprintf("rollback failed: %v", err)})
		h.tracingHelper.RecordError(rollbackSpan, err, "Helm rollback failed")
		rollbackSpan.End()
		h.tracingHelper.RecordError(span, err, "RollbackHelmRelease failed")
		return
	}
	h.tracingHelper.RecordSuccess(rollbackSpan, "Helm release rollback executed successfully")
	rollbackSpan.End()

	h.logger.Info("Successfully rolled back Helm release", "release", releaseName, "revision", req.Revision, "cluster", cluster)

	// Clear cache for this release
	configID := c.Query("config")
	cacheKey := h.getCacheKey("helmreleases", configID, cluster, "")
	h.cacheMux.Lock()
	delete(h.cache, cacheKey)
	h.cacheMux.Unlock()

	c.JSON(http.StatusOK, gin.H{"message": "Release rolled back successfully"})
	h.tracingHelper.RecordSuccess(span, "Helm rollback operation completed")
}

// InstallHelmChart installs a Helm chart
func (h *HelmHandler) InstallHelmChart(c *gin.Context) {
	// Start main span for Helm install operation
	ctx, span := h.tracingHelper.StartAuthSpan(c.Request.Context(), "helm.install_chart")
	defer span.End()

	var installRequest struct {
		Name       string `json:"name" binding:"required"`
		Namespace  string `json:"namespace"`
		Chart      string `json:"chart" binding:"required"`
		Repository string `json:"repository"`
		Version    string `json:"version"`
		Values     string `json:"values"`
	}

	if err := c.ShouldBindJSON(&installRequest); err != nil {
		h.tracingHelper.RecordError(span, err, "InstallHelmChart failed")
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if installRequest.Namespace == "" {
		installRequest.Namespace = "default"
	}

	// Add resource attributes
	h.tracingHelper.AddResourceAttributes(span, installRequest.Name, "helm_release", 1)

	// Child span for client acquisition
	clientCtx, clientSpan := h.tracingHelper.StartAuthSpan(ctx, "helm.client_acquisition")
	// Implement Helm installation with basic repository+chart reference
	config, err := h.getClientAndConfig(c)
	if err != nil {
		h.tracingHelper.RecordError(clientSpan, err, "Failed to get client config")
		clientSpan.End()
		h.tracingHelper.RecordError(span, err, "InstallHelmChart failed")
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	cluster := c.Query("cluster")

	// Build Helm action config
	actionConfig, err := h.helmFactory.GetHelmClientForConfig(config, cluster)
	if err != nil {
		h.logger.Error("Failed to get Helm client for install", "error", err)
		h.tracingHelper.RecordError(clientSpan, err, "Failed to get Helm client")
		clientSpan.End()
		h.tracingHelper.RecordError(span, err, "InstallHelmChart failed")
		c.JSON(http.StatusBadRequest, gin.H{"error": fmt.Sprintf("failed to get Helm client: %v", err)})
		return
	}
	h.tracingHelper.RecordSuccess(clientSpan, "Helm client setup completed")
	clientSpan.End()

	// Child span for values parsing
	_, valuesSpan := h.tracingHelper.StartDataProcessingSpan(clientCtx, "helm.parse_values")
	// Parse custom values if provided
	var values map[string]interface{}
	if installRequest.Values != "" {
		if err := yaml.Unmarshal([]byte(installRequest.Values), &values); err != nil {
			h.logger.Error("Failed to parse custom values", "error", err)
			h.tracingHelper.RecordError(valuesSpan, err, "Failed to parse YAML values")
			valuesSpan.End()
			h.tracingHelper.RecordError(span, err, "InstallHelmChart failed")
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid YAML in custom values"})
			return
		}
	}
	h.tracingHelper.RecordSuccess(valuesSpan, "Values parsed successfully")
	valuesSpan.End()

	install := action.NewInstall(actionConfig)
	install.ReleaseName = installRequest.Name
	install.Namespace = installRequest.Namespace
	install.CreateNamespace = true
	// Fire-and-forget: do not wait for resources to become ready
	install.Wait = false
	if installRequest.Version != "" {
		install.Version = installRequest.Version
	}

	// Configure repo URL to avoid constructing incorrect direct URLs
	// Equivalent to: helm install <name> <chart> --repo <repoURL> --version <ver>
	if installRequest.Repository != "" {
		install.ChartPathOptions.RepoURL = installRequest.Repository
	}
	install.ChartPathOptions.Version = installRequest.Version
	chartRef := installRequest.Chart

	// Child span for chart loading
	chartCtx, chartSpan := h.tracingHelper.StartDataProcessingSpan(clientCtx, "helm.load_chart")
	h.tracingHelper.AddResourceAttributes(chartSpan, chartRef, "helm_chart", 1)
	// Load chart (supports: path, repo/chart, OCI not handled here)
	chartPath, err := install.LocateChart(chartRef, cli.New())
	if err != nil {
		h.logger.Error("Failed to locate chart", "chart", chartRef, "error", err)
		h.tracingHelper.RecordError(chartSpan, err, "Failed to locate chart")
		chartSpan.End()
		h.tracingHelper.RecordError(span, err, "InstallHelmChart failed")
		c.JSON(http.StatusBadRequest, gin.H{"error": fmt.Sprintf("failed to locate chart: %v", err)})
		return
	}
	ch, err := loader.Load(chartPath)
	if err != nil {
		h.logger.Error("Failed to load chart", "path", chartPath, "error", err)
		h.tracingHelper.RecordError(chartSpan, err, "Failed to load chart")
		chartSpan.End()
		h.tracingHelper.RecordError(span, err, "InstallHelmChart failed")
		c.JSON(http.StatusBadRequest, gin.H{"error": fmt.Sprintf("failed to load chart: %v", err)})
		return
	}
	h.tracingHelper.RecordSuccess(chartSpan, "Chart loaded successfully")
	chartSpan.End()

	// Parse values again into map for Helm
	vals := map[string]interface{}{}
	if installRequest.Values != "" {
		if err := yaml.Unmarshal([]byte(installRequest.Values), &vals); err != nil {
			err := fmt.Errorf("invalid YAML in custom values: %w", err)
			h.tracingHelper.RecordError(span, err, "InstallHelmChart failed")
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid YAML in custom values"})
			return
		}
	}

	// Child span for installation execution
	_, installSpan := h.tracingHelper.StartKubernetesAPISpan(chartCtx, "install", "helm_release", installRequest.Namespace)
	// Run install (do not block for readiness)
	rel, err := install.Run(ch, vals)
	if err != nil {
		// Improve error reporting for UI consumers
		msg := err.Error()
		h.logger.Error("Helm install failed", "release", installRequest.Name, "error", err)
		h.tracingHelper.RecordError(installSpan, err, "Helm installation failed")
		installSpan.End()
		h.tracingHelper.RecordError(span, err, "InstallHelmChart failed")
		c.JSON(http.StatusUnprocessableEntity, gin.H{
			"error":   "helm install failed",
			"details": msg,
		})
		return
	}

	// Clear releases cache
	configID := c.Query("config")
	cacheKey := h.getCacheKey("helmreleases", configID, cluster, "")
	h.cacheMux.Lock()
	delete(h.cache, cacheKey)
	h.cacheMux.Unlock()

	h.tracingHelper.AddResourceAttributes(installSpan, rel.Name, "helm_release", 1)
	h.tracingHelper.RecordSuccess(installSpan, "Helm installation completed successfully")
	installSpan.End()

	h.logger.Info("Helm install succeeded", "release", rel.Name, "namespace", rel.Namespace, "chart", rel.Chart.Metadata.Name, "version", rel.Chart.Metadata.Version)
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": fmt.Sprintf("Installed %s", rel.Name),
		"release": map[string]interface{}{
			"name":      rel.Name,
			"namespace": rel.Namespace,
			"chart":     rel.Chart.Metadata.Name,
			"version":   rel.Chart.Metadata.Version,
			"status":    rel.Info.Status,
		},
	})
	h.tracingHelper.RecordSuccess(span, "InstallHelmChart completed successfully")
}

// UpgradeHelmChart upgrades an existing Helm release
func (h *HelmHandler) UpgradeHelmChart(c *gin.Context) {
	// Start main span for Helm upgrade operation
	ctx, span := h.tracingHelper.StartAuthSpan(c.Request.Context(), "helm.upgrade_chart")
	defer span.End()

	var upgradeRequest struct {
		Name       string `json:"name" binding:"required"`
		Namespace  string `json:"namespace"`
		Chart      string `json:"chart" binding:"required"`
		Repository string `json:"repository"`
		Version    string `json:"version" binding:"required"`
		Values     string `json:"values"`
	}

	if err := c.ShouldBindJSON(&upgradeRequest); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		h.tracingHelper.RecordError(span, err, "UpgradeHelmChart failed")
		return
	}

	if upgradeRequest.Namespace == "" {
		upgradeRequest.Namespace = "default"
	}

	// Add resource attributes
	h.tracingHelper.AddResourceAttributes(span, upgradeRequest.Name, "helm_release", 1)

	// Child span for client acquisition
	clientCtx, clientSpan := h.tracingHelper.StartAuthSpan(ctx, "helm.client_acquisition")
	// Get client and config
	config, err := h.getClientAndConfig(c)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		h.tracingHelper.RecordError(clientSpan, err, "Failed to get client config")
		clientSpan.End()
		h.tracingHelper.RecordError(span, err, "UpgradeHelmChart failed")
		return
	}
	cluster := c.Query("cluster")

	// Build Helm action config
	actionConfig, err := h.helmFactory.GetHelmClientForConfig(config, cluster)
	if err != nil {
		h.logger.Error("Failed to get Helm client for upgrade", "error", err)
		c.JSON(http.StatusBadRequest, gin.H{"error": fmt.Sprintf("failed to get Helm client: %v", err)})
		h.tracingHelper.RecordError(clientSpan, err, "Failed to get Helm client")
		clientSpan.End()
		h.tracingHelper.RecordError(span, err, "UpgradeHelmChart failed")
		return
	}
	h.tracingHelper.RecordSuccess(clientSpan, "Client configuration acquired")
	clientSpan.End()

	// Child span for values parsing
	_, valuesSpan := h.tracingHelper.StartDataProcessingSpan(clientCtx, "helm.parse_values")
	// Parse custom values if provided
	var values map[string]interface{}
	if upgradeRequest.Values != "" {
		if err := yaml.Unmarshal([]byte(upgradeRequest.Values), &values); err != nil {
			h.logger.Error("Failed to parse custom values", "error", err)
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid YAML in custom values"})
			h.tracingHelper.RecordError(valuesSpan, err, "Failed to parse YAML values")
			valuesSpan.End()
			h.tracingHelper.RecordError(span, err, "UpgradeHelmChart failed")
			return
		}
	}
	h.tracingHelper.RecordSuccess(valuesSpan, "Values parsed successfully")
	valuesSpan.End()

	upgrade := action.NewUpgrade(actionConfig)
	upgrade.Namespace = upgradeRequest.Namespace
	// Fire-and-forget: do not wait for resources to become ready
	upgrade.Wait = false
	upgrade.Timeout = 300 * time.Second // 5 minutes timeout
	if upgradeRequest.Version != "" {
		upgrade.Version = upgradeRequest.Version
	}

	// Configure repo URL. If not provided, try resolving via Artifact Hub by chart name
	if upgradeRequest.Repository != "" {
		upgrade.ChartPathOptions.RepoURL = upgradeRequest.Repository
	} else {
		if repoURL, ok := h.resolveRepoURLFromChartName(upgradeRequest.Chart, c.Query("repository")); ok {
			upgrade.ChartPathOptions.RepoURL = repoURL
		}
	}
	upgrade.ChartPathOptions.Version = upgradeRequest.Version
	chartRef := upgradeRequest.Chart

	// Child span for chart loading
	_, chartSpan := h.tracingHelper.StartDataProcessingSpan(clientCtx, "helm.load_chart")
	// Load chart
	chartPath, err := upgrade.LocateChart(chartRef, cli.New())
	if err != nil {
		h.logger.Error("Failed to locate chart", "chart", chartRef, "error", err)
		c.JSON(http.StatusBadRequest, gin.H{"error": fmt.Sprintf("failed to locate chart: %v", err)})
		h.tracingHelper.RecordError(chartSpan, err, "Failed to locate chart")
		chartSpan.End()
		h.tracingHelper.RecordError(span, err, "UpgradeHelmChart failed")
		return
	}
	ch, err := loader.Load(chartPath)
	if err != nil {
		h.logger.Error("Failed to load chart", "path", chartPath, "error", err)
		c.JSON(http.StatusBadRequest, gin.H{"error": fmt.Sprintf("failed to load chart: %v", err)})
		h.tracingHelper.RecordError(chartSpan, err, "Failed to load chart")
		chartSpan.End()
		h.tracingHelper.RecordError(span, err, "UpgradeHelmChart failed")
		return
	}
	h.tracingHelper.RecordSuccess(chartSpan, "Chart loaded successfully")
	chartSpan.End()

	// Parse values again into map for Helm
	vals := map[string]interface{}{}
	if upgradeRequest.Values != "" {
		if err := yaml.Unmarshal([]byte(upgradeRequest.Values), &vals); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid YAML in custom values"})
			h.tracingHelper.RecordError(span, err, "UpgradeHelmChart failed")
			return
		}
	}

	// Child span for upgrade execution
	_, upgradeSpan := h.tracingHelper.StartKubernetesAPISpan(clientCtx, "upgrade", "helm_release", upgradeRequest.Namespace)
	// Run upgrade (do not block for readiness)
	rel, err := upgrade.Run(upgradeRequest.Name, ch, vals)
	if err != nil {
		// Improve error reporting for UI consumers
		msg := err.Error()
		h.logger.Error("Helm upgrade failed", "release", upgradeRequest.Name, "error", err)
		c.JSON(http.StatusUnprocessableEntity, gin.H{
			"error":   "helm upgrade failed",
			"details": msg,
		})
		h.tracingHelper.RecordError(upgradeSpan, err, "Helm upgrade failed")
		upgradeSpan.End()
		h.tracingHelper.RecordError(span, err, "UpgradeHelmChart failed")
		return
	}
	h.tracingHelper.RecordSuccess(upgradeSpan, "Helm upgrade executed successfully")
	upgradeSpan.End()

	// Clear releases cache
	configID := c.Query("config")
	cacheKey := h.getCacheKey("helmreleases", configID, cluster, "")
	h.cacheMux.Lock()
	delete(h.cache, cacheKey)
	h.cacheMux.Unlock()

	h.logger.Info("Helm upgrade succeeded", "release", rel.Name, "namespace", rel.Namespace, "chart", rel.Chart.Metadata.Name, "version", rel.Chart.Metadata.Version)
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": fmt.Sprintf("Upgraded %s to version %s", rel.Name, rel.Chart.Metadata.Version),
		"release": map[string]interface{}{
			"name":      rel.Name,
			"namespace": rel.Namespace,
			"chart":     rel.Chart.Metadata.Name,
			"version":   rel.Chart.Metadata.Version,
			"status":    rel.Info.Status,
		},
	})
	h.tracingHelper.RecordSuccess(span, "Helm upgrade operation completed")
}

// resolveRepoURLFromChartName searches Artifact Hub for a chart name and returns the
// repository URL suitable for Helm's ChartPathOptions.RepoURL. If repositoryFilter
// is provided, results are biased towards that repository name.
func (h *HelmHandler) resolveRepoURLFromChartName(chartName, repositoryFilter string) (string, bool) {
	chartName = strings.TrimSpace(chartName)
	if chartName == "" {
		return "", false
	}
	searchURL := fmt.Sprintf(
		"https://artifacthub.io/api/v1/packages/search?kind=0&ts_query_web=%s&limit=%d",
		url.QueryEscape(chartName), 25,
	)
	client := &http.Client{Timeout: 30 * time.Second}
	req, _ := http.NewRequest("GET", searchURL, nil)
	req.Header.Set("User-Agent", "kube-dash/1.0")
	resp, err := client.Do(req)
	if err != nil {
		h.logger.Warn("Artifact Hub search failed", "error", err, "chart", chartName)
		return "", false
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		h.logger.Warn("Artifact Hub search non-200", "status", resp.StatusCode, "chart", chartName)
		return "", false
	}
	var search ArtifactHubResponse
	if err := json.NewDecoder(resp.Body).Decode(&search); err != nil {
		h.logger.Warn("Failed to decode Artifact Hub search", "error", err)
		return "", false
	}
	for _, p := range search.Packages {
		if strings.EqualFold(p.Name, chartName) {
			if repositoryFilter == "" || strings.EqualFold(p.Repository.Name, repositoryFilter) || strings.EqualFold(p.Repository.DisplayName, repositoryFilter) || strings.EqualFold(p.Repository.Organization.Name, repositoryFilter) {
				return p.Repository.URL, true
			}
		}
	}
	// Fallback: first result
	if len(search.Packages) > 0 {
		return search.Packages[0].Repository.URL, search.Packages[0].Repository.URL != ""
	}
	return "", false
}
