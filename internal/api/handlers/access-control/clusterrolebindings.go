package access_control

import (
	"fmt"
	"net/http"

	"github.com/gin-gonic/gin"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/client-go/kubernetes"

	"kubewall-backend/internal/api/transformers"
	"kubewall-backend/internal/api/types"
	"kubewall-backend/internal/api/utils"
	"kubewall-backend/internal/k8s"
	"kubewall-backend/internal/storage"
	"kubewall-backend/pkg/logger"
)

// ClusterRoleBindingsHandler handles ClusterRoleBinding-related operations
type ClusterRoleBindingsHandler struct {
	store         *storage.KubeConfigStore
	clientFactory *k8s.ClientFactory
	logger        *logger.Logger
	sseHandler    *utils.SSEHandler
	yamlHandler   *utils.YAMLHandler
	eventsHandler *utils.EventsHandler
}

// NewClusterRoleBindingsHandler creates a new ClusterRoleBindingsHandler
func NewClusterRoleBindingsHandler(store *storage.KubeConfigStore, clientFactory *k8s.ClientFactory, log *logger.Logger) *ClusterRoleBindingsHandler {
	return &ClusterRoleBindingsHandler{
		store:         store,
		clientFactory: clientFactory,
		logger:        log,
		sseHandler:    utils.NewSSEHandler(log),
		yamlHandler:   utils.NewYAMLHandler(log),
		eventsHandler: utils.NewEventsHandler(log),
	}
}

// getClientAndConfig gets the Kubernetes client and config for the given config ID and cluster
func (h *ClusterRoleBindingsHandler) getClientAndConfig(c *gin.Context) (*kubernetes.Clientset, error) {
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

// GetClusterRoleBindingsSSE returns cluster role bindings as Server-Sent Events with real-time updates
func (h *ClusterRoleBindingsHandler) GetClusterRoleBindingsSSE(c *gin.Context) {
	client, err := h.getClientAndConfig(c)
	if err != nil {
		h.logger.WithError(err).Error("Failed to get client for cluster role bindings SSE")
		h.sseHandler.SendSSEError(c, http.StatusBadRequest, err.Error())
		return
	}

	// Function to fetch and transform cluster role bindings data
	fetchClusterRoleBindings := func() (interface{}, error) {
		clusterRoleBindingList, err := client.RbacV1().ClusterRoleBindings().List(c.Request.Context(), metav1.ListOptions{})
		if err != nil {
			return nil, err
		}

		// Transform cluster role bindings to frontend-expected format
		var response []types.ClusterRoleBindingListResponse
		for _, clusterRoleBinding := range clusterRoleBindingList.Items {
			response = append(response, transformers.TransformClusterRoleBindingToResponse(&clusterRoleBinding))
		}

		return response, nil
	}

	// Get initial data
	initialData, err := fetchClusterRoleBindings()
	if err != nil {
		h.logger.WithError(err).Error("Failed to list cluster role bindings for SSE")
		h.sseHandler.SendSSEError(c, http.StatusInternalServerError, err.Error())
		return
	}

	// Send SSE response with periodic updates
	h.sseHandler.SendSSEResponseWithUpdates(c, initialData, fetchClusterRoleBindings)
}

// GetClusterRoleBinding returns a specific cluster role binding
func (h *ClusterRoleBindingsHandler) GetClusterRoleBinding(c *gin.Context) {
	client, err := h.getClientAndConfig(c)
	if err != nil {
		h.logger.WithError(err).Error("Failed to get client for cluster role binding")
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	name := c.Param("name")
	clusterRoleBinding, err := client.RbacV1().ClusterRoleBindings().Get(c.Request.Context(), name, metav1.GetOptions{})
	if err != nil {
		h.logger.WithError(err).WithField("clusterRoleBinding", name).Error("Failed to get cluster role binding")
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	// Check if this is an SSE request (EventSource expects SSE format)
	acceptHeader := c.GetHeader("Accept")
	if acceptHeader == "text/event-stream" {
		h.sseHandler.SendSSEResponse(c, clusterRoleBinding)
		return
	}

	c.JSON(http.StatusOK, clusterRoleBinding)
}

// GetClusterRoleBindingByName returns a specific cluster role binding by name
func (h *ClusterRoleBindingsHandler) GetClusterRoleBindingByName(c *gin.Context) {
	client, err := h.getClientAndConfig(c)
	if err != nil {
		h.logger.WithError(err).Error("Failed to get client for cluster role binding by name")
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	name := c.Param("name")
	clusterRoleBinding, err := client.RbacV1().ClusterRoleBindings().Get(c.Request.Context(), name, metav1.GetOptions{})
	if err != nil {
		h.logger.WithError(err).WithField("clusterRoleBinding", name).Error("Failed to get cluster role binding by name")
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, clusterRoleBinding)
}

// GetClusterRoleBindingYAMLByName returns YAML representation of a cluster role binding by name
func (h *ClusterRoleBindingsHandler) GetClusterRoleBindingYAMLByName(c *gin.Context) {
	client, err := h.getClientAndConfig(c)
	if err != nil {
		h.logger.WithError(err).Error("Failed to get client for cluster role binding YAML by name")
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	name := c.Param("name")
	clusterRoleBinding, err := client.RbacV1().ClusterRoleBindings().Get(c.Request.Context(), name, metav1.GetOptions{})
	if err != nil {
		h.logger.WithError(err).WithField("clusterRoleBinding", name).Error("Failed to get cluster role binding YAML by name")
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	h.yamlHandler.SendYAMLResponse(c, clusterRoleBinding, name)
}

// GetClusterRoleBindingYAML returns YAML representation of a cluster role binding
func (h *ClusterRoleBindingsHandler) GetClusterRoleBindingYAML(c *gin.Context) {
	client, err := h.getClientAndConfig(c)
	if err != nil {
		h.logger.WithError(err).Error("Failed to get client for cluster role binding YAML")
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	name := c.Param("name")
	clusterRoleBinding, err := client.RbacV1().ClusterRoleBindings().Get(c.Request.Context(), name, metav1.GetOptions{})
	if err != nil {
		h.logger.WithError(err).WithField("clusterRoleBinding", name).Error("Failed to get cluster role binding YAML")
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	h.yamlHandler.SendYAMLResponse(c, clusterRoleBinding, name)
}

// GetClusterRoleBindingEventsByName returns events for a specific cluster role binding by name
func (h *ClusterRoleBindingsHandler) GetClusterRoleBindingEventsByName(c *gin.Context) {
	client, err := h.getClientAndConfig(c)
	if err != nil {
		h.logger.WithError(err).Error("Failed to get client for cluster role binding events by name")
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	name := c.Param("name")
	h.eventsHandler.GetResourceEvents(c, client, "ClusterRoleBinding", name, h.sseHandler.SendSSEResponse)
}

// GetClusterRoleBindingEvents returns events for a specific cluster role binding
func (h *ClusterRoleBindingsHandler) GetClusterRoleBindingEvents(c *gin.Context) {
	client, err := h.getClientAndConfig(c)
	if err != nil {
		h.logger.WithError(err).Error("Failed to get client for cluster role binding events")
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	name := c.Param("name")
	h.eventsHandler.GetResourceEvents(c, client, "ClusterRoleBinding", name, h.sseHandler.SendSSEResponse)
}
