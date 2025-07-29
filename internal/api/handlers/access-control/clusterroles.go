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

// ClusterRolesHandler handles ClusterRole-related operations
type ClusterRolesHandler struct {
	store         *storage.KubeConfigStore
	clientFactory *k8s.ClientFactory
	logger        *logger.Logger
	sseHandler    *utils.SSEHandler
	yamlHandler   *utils.YAMLHandler
	eventsHandler *utils.EventsHandler
}

// NewClusterRolesHandler creates a new ClusterRolesHandler
func NewClusterRolesHandler(store *storage.KubeConfigStore, clientFactory *k8s.ClientFactory, log *logger.Logger) *ClusterRolesHandler {
	return &ClusterRolesHandler{
		store:         store,
		clientFactory: clientFactory,
		logger:        log,
		sseHandler:    utils.NewSSEHandler(log),
		yamlHandler:   utils.NewYAMLHandler(log),
		eventsHandler: utils.NewEventsHandler(log),
	}
}

// getClientAndConfig gets the Kubernetes client and config for the given config ID and cluster
func (h *ClusterRolesHandler) getClientAndConfig(c *gin.Context) (*kubernetes.Clientset, error) {
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

// GetClusterRolesSSE returns cluster roles as Server-Sent Events with real-time updates
func (h *ClusterRolesHandler) GetClusterRolesSSE(c *gin.Context) {
	client, err := h.getClientAndConfig(c)
	if err != nil {
		h.logger.WithError(err).Error("Failed to get client for cluster roles SSE")
		h.sseHandler.SendSSEError(c, http.StatusBadRequest, err.Error())
		return
	}

	// Function to fetch and transform cluster roles data
	fetchClusterRoles := func() (interface{}, error) {
		clusterRoleList, err := client.RbacV1().ClusterRoles().List(c.Request.Context(), metav1.ListOptions{})
		if err != nil {
			return nil, err
		}

		// Transform cluster roles to frontend-expected format
		var response []types.ClusterRoleListResponse
		for _, clusterRole := range clusterRoleList.Items {
			response = append(response, transformers.TransformClusterRoleToResponse(&clusterRole))
		}

		return response, nil
	}

	// Get initial data
	initialData, err := fetchClusterRoles()
	if err != nil {
		h.logger.WithError(err).Error("Failed to list cluster roles for SSE")
		h.sseHandler.SendSSEError(c, http.StatusInternalServerError, err.Error())
		return
	}

	// Send SSE response with periodic updates
	h.sseHandler.SendSSEResponseWithUpdates(c, initialData, fetchClusterRoles)
}

// GetClusterRole returns a specific cluster role
func (h *ClusterRolesHandler) GetClusterRole(c *gin.Context) {
	client, err := h.getClientAndConfig(c)
	if err != nil {
		h.logger.WithError(err).Error("Failed to get client for cluster role")
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	name := c.Param("name")
	clusterRole, err := client.RbacV1().ClusterRoles().Get(c.Request.Context(), name, metav1.GetOptions{})
	if err != nil {
		h.logger.WithError(err).WithField("clusterRole", name).Error("Failed to get cluster role")
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	// Check if this is an SSE request (EventSource expects SSE format)
	acceptHeader := c.GetHeader("Accept")
	if acceptHeader == "text/event-stream" {
		h.sseHandler.SendSSEResponse(c, clusterRole)
		return
	}

	c.JSON(http.StatusOK, clusterRole)
}

// GetClusterRoleByName returns a specific cluster role by name
func (h *ClusterRolesHandler) GetClusterRoleByName(c *gin.Context) {
	client, err := h.getClientAndConfig(c)
	if err != nil {
		h.logger.WithError(err).Error("Failed to get client for cluster role by name")
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	name := c.Param("name")
	clusterRole, err := client.RbacV1().ClusterRoles().Get(c.Request.Context(), name, metav1.GetOptions{})
	if err != nil {
		h.logger.WithError(err).WithField("clusterRole", name).Error("Failed to get cluster role by name")
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, clusterRole)
}

// GetClusterRoleYAMLByName returns YAML representation of a cluster role by name
func (h *ClusterRolesHandler) GetClusterRoleYAMLByName(c *gin.Context) {
	client, err := h.getClientAndConfig(c)
	if err != nil {
		h.logger.WithError(err).Error("Failed to get client for cluster role YAML by name")
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	name := c.Param("name")
	clusterRole, err := client.RbacV1().ClusterRoles().Get(c.Request.Context(), name, metav1.GetOptions{})
	if err != nil {
		h.logger.WithError(err).WithField("clusterRole", name).Error("Failed to get cluster role YAML by name")
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	h.yamlHandler.SendYAMLResponse(c, clusterRole, name)
}

// GetClusterRoleYAML returns YAML representation of a cluster role
func (h *ClusterRolesHandler) GetClusterRoleYAML(c *gin.Context) {
	client, err := h.getClientAndConfig(c)
	if err != nil {
		h.logger.WithError(err).Error("Failed to get client for cluster role YAML")
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	name := c.Param("name")
	clusterRole, err := client.RbacV1().ClusterRoles().Get(c.Request.Context(), name, metav1.GetOptions{})
	if err != nil {
		h.logger.WithError(err).WithField("clusterRole", name).Error("Failed to get cluster role YAML")
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	h.yamlHandler.SendYAMLResponse(c, clusterRole, name)
}

// GetClusterRoleEventsByName returns events for a specific cluster role by name
func (h *ClusterRolesHandler) GetClusterRoleEventsByName(c *gin.Context) {
	client, err := h.getClientAndConfig(c)
	if err != nil {
		h.logger.WithError(err).Error("Failed to get client for cluster role events by name")
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	name := c.Param("name")
	h.eventsHandler.GetResourceEvents(c, client, "ClusterRole", name, h.sseHandler.SendSSEResponse)
}

// GetClusterRoleEvents returns events for a specific cluster role
func (h *ClusterRolesHandler) GetClusterRoleEvents(c *gin.Context) {
	client, err := h.getClientAndConfig(c)
	if err != nil {
		h.logger.WithError(err).Error("Failed to get client for cluster role events")
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	name := c.Param("name")
	h.eventsHandler.GetResourceEvents(c, client, "ClusterRole", name, h.sseHandler.SendSSEResponse)
}
