package handlers

import (
	"encoding/json"
	"fmt"
	"net/http"
	"time"

	"github.com/Facets-cloud/kube-dash/internal/k8s"
	"github.com/Facets-cloud/kube-dash/internal/storage"
	"github.com/Facets-cloud/kube-dash/pkg/logger"

	"github.com/gin-gonic/gin"
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
}

// NewResourcesHandler creates a new resources handler
func NewResourcesHandler(store *storage.KubeConfigStore, clientFactory *k8s.ClientFactory, log *logger.Logger) *ResourcesHandler {
	return &ResourcesHandler{
		store:         store,
		clientFactory: clientFactory,
		logger:        log,
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
