package access_control

import (
	"fmt"
	"net/http"

	"github.com/gin-gonic/gin"
	rbacV1 "k8s.io/api/rbac/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/client-go/kubernetes"

	"kubewall-backend/internal/api/transformers"
	"kubewall-backend/internal/api/types"
	"kubewall-backend/internal/api/utils"
	"kubewall-backend/internal/k8s"
	"kubewall-backend/internal/storage"
	"kubewall-backend/pkg/logger"
)

// RoleBindingsHandler handles RoleBinding-related operations
type RoleBindingsHandler struct {
	store         *storage.KubeConfigStore
	clientFactory *k8s.ClientFactory
	logger        *logger.Logger
	sseHandler    *utils.SSEHandler
	yamlHandler   *utils.YAMLHandler
	eventsHandler *utils.EventsHandler
}

// NewRoleBindingsHandler creates a new RoleBindingsHandler
func NewRoleBindingsHandler(store *storage.KubeConfigStore, clientFactory *k8s.ClientFactory, log *logger.Logger) *RoleBindingsHandler {
	return &RoleBindingsHandler{
		store:         store,
		clientFactory: clientFactory,
		logger:        log,
		sseHandler:    utils.NewSSEHandler(log),
		yamlHandler:   utils.NewYAMLHandler(log),
		eventsHandler: utils.NewEventsHandler(log),
	}
}

// getClientAndConfig gets the Kubernetes client and config for the given config ID and cluster
func (h *RoleBindingsHandler) getClientAndConfig(c *gin.Context) (*kubernetes.Clientset, error) {
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

// GetRoleBindingsSSE returns role bindings as Server-Sent Events with real-time updates
func (h *RoleBindingsHandler) GetRoleBindingsSSE(c *gin.Context) {
	client, err := h.getClientAndConfig(c)
	if err != nil {
		h.logger.WithError(err).Error("Failed to get client for role bindings SSE")
		h.sseHandler.SendSSEError(c, http.StatusBadRequest, err.Error())
		return
	}

	// Function to fetch and transform role bindings data
	fetchRoleBindings := func() (interface{}, error) {
		namespace := c.Query("namespace")
		var roleBindingList *rbacV1.RoleBindingList
		var err error

		if namespace != "" {
			roleBindingList, err = client.RbacV1().RoleBindings(namespace).List(c.Request.Context(), metav1.ListOptions{})
		} else {
			roleBindingList, err = client.RbacV1().RoleBindings("").List(c.Request.Context(), metav1.ListOptions{})
		}

		if err != nil {
			return nil, err
		}

		// Transform role bindings to frontend-expected format
		var response []types.RoleBindingListResponse
		for _, roleBinding := range roleBindingList.Items {
			response = append(response, transformers.TransformRoleBindingToResponse(&roleBinding))
		}

		return response, nil
	}

	// Get initial data
	initialData, err := fetchRoleBindings()
	if err != nil {
		h.logger.WithError(err).Error("Failed to list role bindings for SSE")
		h.sseHandler.SendSSEError(c, http.StatusInternalServerError, err.Error())
		return
	}

	// Send SSE response with periodic updates
	h.sseHandler.SendSSEResponseWithUpdates(c, initialData, fetchRoleBindings)
}

// GetRoleBinding returns a specific role binding
func (h *RoleBindingsHandler) GetRoleBinding(c *gin.Context) {
	client, err := h.getClientAndConfig(c)
	if err != nil {
		h.logger.WithError(err).Error("Failed to get client for role binding")
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	name := c.Param("name")
	namespace := c.Param("namespace")
	roleBinding, err := client.RbacV1().RoleBindings(namespace).Get(c.Request.Context(), name, metav1.GetOptions{})
	if err != nil {
		h.logger.WithError(err).WithField("roleBinding", name).Error("Failed to get role binding")
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	// Check if this is an SSE request (EventSource expects SSE format)
	acceptHeader := c.GetHeader("Accept")
	if acceptHeader == "text/event-stream" {
		h.sseHandler.SendSSEResponse(c, roleBinding)
		return
	}

	c.JSON(http.StatusOK, roleBinding)
}

// GetRoleBindingByName returns a specific role binding by name
func (h *RoleBindingsHandler) GetRoleBindingByName(c *gin.Context) {
	client, err := h.getClientAndConfig(c)
	if err != nil {
		h.logger.WithError(err).Error("Failed to get client for role binding by name")
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	name := c.Param("name")
	namespace := c.Query("namespace")

	if namespace == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "namespace is required"})
		return
	}

	roleBinding, err := client.RbacV1().RoleBindings(namespace).Get(c.Request.Context(), name, metav1.GetOptions{})
	if err != nil {
		h.logger.WithError(err).WithField("roleBinding", name).Error("Failed to get role binding by name")
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, roleBinding)
}

// GetRoleBindingYAMLByName returns YAML representation of a role binding by name
func (h *RoleBindingsHandler) GetRoleBindingYAMLByName(c *gin.Context) {
	client, err := h.getClientAndConfig(c)
	if err != nil {
		h.logger.WithError(err).Error("Failed to get client for role binding YAML by name")
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	name := c.Param("name")
	namespace := c.Query("namespace")

	if namespace == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "namespace is required"})
		return
	}

	roleBinding, err := client.RbacV1().RoleBindings(namespace).Get(c.Request.Context(), name, metav1.GetOptions{})
	if err != nil {
		h.logger.WithError(err).WithField("roleBinding", name).Error("Failed to get role binding YAML by name")
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	h.yamlHandler.SendYAMLResponse(c, roleBinding, name)
}

// GetRoleBindingYAML returns YAML representation of a role binding
func (h *RoleBindingsHandler) GetRoleBindingYAML(c *gin.Context) {
	client, err := h.getClientAndConfig(c)
	if err != nil {
		h.logger.WithError(err).Error("Failed to get client for role binding YAML")
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	name := c.Param("name")
	namespace := c.Param("namespace")
	roleBinding, err := client.RbacV1().RoleBindings(namespace).Get(c.Request.Context(), name, metav1.GetOptions{})
	if err != nil {
		h.logger.WithError(err).WithField("roleBinding", name).Error("Failed to get role binding YAML")
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	h.yamlHandler.SendYAMLResponse(c, roleBinding, name)
}

// GetRoleBindingEventsByName returns events for a specific role binding by name
func (h *RoleBindingsHandler) GetRoleBindingEventsByName(c *gin.Context) {
	client, err := h.getClientAndConfig(c)
	if err != nil {
		h.logger.WithError(err).Error("Failed to get client for role binding events by name")
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	name := c.Param("name")
	namespace := c.Query("namespace")

	if namespace == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "namespace is required"})
		return
	}

	h.eventsHandler.GetResourceEventsWithNamespace(c, client, "RoleBinding", name, namespace, h.sseHandler.SendSSEResponse)
}

// GetRoleBindingEvents returns events for a specific role binding
func (h *RoleBindingsHandler) GetRoleBindingEvents(c *gin.Context) {
	client, err := h.getClientAndConfig(c)
	if err != nil {
		h.logger.WithError(err).Error("Failed to get client for role binding events")
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	name := c.Param("name")
	h.eventsHandler.GetResourceEvents(c, client, "RoleBinding", name, h.sseHandler.SendSSEResponse)
}
