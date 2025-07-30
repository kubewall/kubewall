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
	"gopkg.in/yaml.v2"
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
		// Create a context with timeout for Helm operations - increased for slow Helm operations
		ctx, cancel := context.WithTimeout(c.Request.Context(), 120*time.Second)
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
		h.logger.Error("Failed to get initial Helm releases data", "error", err, "cluster", cluster)
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
	ctx, cancel := context.WithTimeout(c.Request.Context(), 180*time.Second)
	defer cancel()

	// Get Helm action configuration
	actionConfig, err := h.helmFactory.GetHelmClientForConfig(config, cluster)
	if err != nil {
		h.logger.Error("Failed to get Helm client", "error", err, "cluster", cluster)
		c.JSON(http.StatusInternalServerError, gin.H{"error": fmt.Sprintf("failed to get Helm client: %v", err)})
		return
	}

	// Function to fetch Helm release details
	fetchHelmReleaseDetails := func() (interface{}, error) {
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

		// Get release values (with timeout check)
		select {
		case <-ctx.Done():
			return nil, fmt.Errorf("operation timed out")
		default:
			valuesClient := action.NewGetValues(actionConfig)
			values, err := valuesClient.Run(releaseName)
			if err != nil {
				h.logger.Warn("Failed to get release values", "error", err, "release", releaseName)
				// Don't fail the entire request, just skip values
			} else if values != nil {
				// Convert values to proper YAML string
				h.logger.Info("Converting Helm values to YAML", "release", releaseName, "valuesType", fmt.Sprintf("%T", values))
				valuesYAML, err := yaml.Marshal(values)
				if err != nil {
					h.logger.Warn("Failed to marshal values to YAML", "error", err, "release", releaseName)
					// Fallback to string representation
					valuesYAML := fmt.Sprintf("%v", values)
					response.Values = valuesYAML
				} else {
					response.Values = string(valuesYAML)
					h.logger.Info("Successfully converted values to YAML", "release", releaseName, "yamlLength", len(response.Values))
				}
			}
		}

		// Get release history (with timeout check)
		select {
		case <-ctx.Done():
			return nil, fmt.Errorf("operation timed out")
		default:
			historyClient := action.NewHistory(actionConfig)
			history, err := historyClient.Run(releaseName)
			if err != nil {
				h.logger.Warn("Failed to get release history", "error", err, "release", releaseName)
				// Don't fail the entire request, just skip history
			} else {
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
				response.History = historyItems
			}
		}

		// Get deployments for this release (with timeout check)
		select {
		case <-ctx.Done():
			return nil, fmt.Errorf("operation timed out")
		default:
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
		}

		return response, nil
	}

	// Get initial data
	initialData, err := fetchHelmReleaseDetails()
	if err != nil {
		h.logger.Error("Failed to get Helm release details", "error", err, "release", releaseName)
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	// Check if this is an SSE request (EventSource expects SSE format)
	acceptHeader := c.GetHeader("Accept")
	if acceptHeader == "text/event-stream" {
		// Send SSE response with periodic updates
		h.sseHandler.SendSSEResponseWithUpdates(c, initialData, fetchHelmReleaseDetails)
		return
	}

	// For non-SSE requests, return JSON
	c.JSON(http.StatusOK, initialData)
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

		// Get release history with timeout check
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
