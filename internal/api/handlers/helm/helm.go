package helm

import (
	"context"
	"fmt"
	"net/http"
	"time"

	"kubewall-backend/internal/api/types"
	"kubewall-backend/internal/api/utils"
	"kubewall-backend/internal/k8s"
	"kubewall-backend/internal/storage"
	"kubewall-backend/pkg/logger"

	"github.com/gin-gonic/gin"
	"helm.sh/helm/v3/pkg/action"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/client-go/tools/clientcmd/api"
)

// HelmHandler provides methods for handling Helm operations
type HelmHandler struct {
	store         *storage.KubeConfigStore
	clientFactory *k8s.ClientFactory
	helmFactory   *k8s.HelmClientFactory
	logger        *logger.Logger
	yamlHandler   *utils.YAMLHandler
	sseHandler    *utils.SSEHandler
}

// NewHelmHandler creates a new Helm handler
func NewHelmHandler(store *storage.KubeConfigStore, clientFactory *k8s.ClientFactory, helmFactory *k8s.HelmClientFactory, log *logger.Logger) *HelmHandler {
	return &HelmHandler{
		store:         store,
		clientFactory: clientFactory,
		helmFactory:   helmFactory,
		logger:        log,
		yamlHandler:   utils.NewYAMLHandler(log),
		sseHandler:    utils.NewSSEHandler(log),
	}
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

	// Function to fetch and transform Helm releases data
	fetchHelmReleases := func() (interface{}, error) {
		// Create a context with timeout for Helm operations
		ctx, cancel := context.WithTimeout(c.Request.Context(), 30*time.Second)
		defer cancel()

		// Get Helm action configuration
		actionConfig, err := h.helmFactory.GetHelmClientForConfig(config, cluster)
		if err != nil {
			return nil, fmt.Errorf("failed to get Helm client: %v", err)
		}

		// Create Helm list client
		client := action.NewList(actionConfig)

		// Set options
		if namespace != "" && namespace != "all" {
			client.AllNamespaces = false
			// Note: Helm SDK doesn't have a direct Namespace field, we'll filter results
		} else {
			client.AllNamespaces = true
		}

		// Get all releases (not just deployed)
		client.Deployed = false
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
				Notes:       rel.Info.Notes,
			}

			releases = append(releases, release)
		}

		return releases, nil
	}

	// Get initial data
	initialData, err := fetchHelmReleases()
	if err != nil {
		h.sseHandler.SendSSEError(c, http.StatusInternalServerError, err.Error())
		return
	}

	// Check if this is an SSE request (EventSource expects SSE format)
	acceptHeader := c.GetHeader("Accept")
	if acceptHeader == "text/event-stream" {
		// Send SSE response with periodic updates
		h.sseHandler.SendSSEResponseWithUpdates(c, initialData, fetchHelmReleases)
		return
	}

	// For non-SSE requests, return JSON
	c.JSON(http.StatusOK, initialData)
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

	// Create a context with timeout for Helm operations
	ctx, cancel := context.WithTimeout(c.Request.Context(), 30*time.Second)
	defer cancel()

	// Get Helm action configuration
	actionConfig, err := h.helmFactory.GetHelmClientForConfig(config, cluster)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": fmt.Sprintf("failed to get Helm client: %v", err)})
		return
	}

	// Get release values
	valuesClient := action.NewGetValues(actionConfig)
	values, err := valuesClient.Run(releaseName)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": fmt.Sprintf("failed to get release values: %v", err)})
		return
	}

	// Get release manifest
	// Note: Helm SDK doesn't have a direct GetManifest action, we'll get it from the release info
	manifest := ""

	// Get release history
	historyClient := action.NewHistory(actionConfig)
	history, err := historyClient.Run(releaseName)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": fmt.Sprintf("failed to get release history: %v", err)})
		return
	}

	// Get release info
	listClient := action.NewList(actionConfig)
	listClient.AllNamespaces = true
	releases, err := listClient.Run()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": fmt.Sprintf("failed to get release info: %v", err)})
		return
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
		c.JSON(http.StatusNotFound, gin.H{"error": "release not found"})
		return
	}

	// Convert history to our format
	historyItems := []types.HelmReleaseHistory{}
	for _, hist := range history {
		historyItem := types.HelmReleaseHistory{
			Revision:    hist.Version,
			Updated:     hist.Info.LastDeployed.Time,
			Status:      string(hist.Info.Status),
			Chart:       hist.Chart.Metadata.Name,
			AppVersion:  hist.Chart.Metadata.AppVersion,
			Description: hist.Info.Description,
			IsLatest:    hist.Version == releaseInfo.Revision,
		}
		historyItems = append(historyItems, historyItem)
	}

	// Get deployments for this release
	k8sClient, err := h.clientFactory.GetClientForConfig(config, cluster)
	if err == nil {
		deployments, err := k8sClient.AppsV1().Deployments(releaseInfo.Namespace).List(ctx, metav1.ListOptions{
			LabelSelector: fmt.Sprintf("app.kubernetes.io/instance=%s", releaseName),
		})
		if err == nil {
			for _, deployment := range deployments.Items {
				releaseInfo.Deployments = append(releaseInfo.Deployments, deployment.Name)
			}
		}
	}

	// Convert values to YAML string
	valuesYAML := ""
	if values != nil {
		// Convert values to YAML string (you might want to use a YAML library here)
		valuesYAML = fmt.Sprintf("%v", values)
	}

	response := types.HelmReleaseDetails{
		Release:   *releaseInfo,
		History:   historyItems,
		Values:    valuesYAML,
		Templates: "", // Helm templates are not directly accessible via SDK
		Manifests: manifest,
	}

	c.JSON(http.StatusOK, response)
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

	// Get Helm action configuration
	actionConfig, err := h.helmFactory.GetHelmClientForConfig(config, cluster)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": fmt.Sprintf("failed to get Helm client: %v", err)})
		return
	}

	// Get release history
	historyClient := action.NewHistory(actionConfig)
	history, err := historyClient.Run(releaseName)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": fmt.Sprintf("failed to get release history: %v", err)})
		return
	}

	// Get current release info to determine latest revision
	listClient := action.NewList(actionConfig)
	listClient.AllNamespaces = true
	releases, err := listClient.Run()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": fmt.Sprintf("failed to get release info: %v", err)})
		return
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

	c.JSON(http.StatusOK, historyResponse)
}
