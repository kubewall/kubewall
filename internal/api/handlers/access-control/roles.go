package access_control

import (
	"context"
	"fmt"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	rbacV1 "k8s.io/api/rbac/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/client-go/kubernetes"

	"github.com/Facets-cloud/kube-dash/internal/api/transformers"
	"github.com/Facets-cloud/kube-dash/internal/api/types"
	"github.com/Facets-cloud/kube-dash/internal/api/utils"
	"github.com/Facets-cloud/kube-dash/internal/k8s"
	"github.com/Facets-cloud/kube-dash/internal/storage"
	"github.com/Facets-cloud/kube-dash/internal/tracing"
	"github.com/Facets-cloud/kube-dash/pkg/logger"
)

// RolesHandler handles Role-related operations
type RolesHandler struct {
	store         *storage.KubeConfigStore
	clientFactory *k8s.ClientFactory
	logger        *logger.Logger
	sseHandler    *utils.SSEHandler
	yamlHandler   *utils.YAMLHandler
	eventsHandler *utils.EventsHandler
	tracingHelper *tracing.TracingHelper
}

// NewRolesHandler creates a new RolesHandler
func NewRolesHandler(store *storage.KubeConfigStore, clientFactory *k8s.ClientFactory, log *logger.Logger) *RolesHandler {
	return &RolesHandler{
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
func (h *RolesHandler) getClientAndConfig(c *gin.Context) (*kubernetes.Clientset, error) {
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

// GetRolesSSE returns roles as Server-Sent Events with real-time updates
func (h *RolesHandler) GetRolesSSE(c *gin.Context) {
	// Start child span for client setup
	ctx, clientSpan := h.tracingHelper.StartAuthSpan(c.Request.Context(), "get-client-config")
	defer clientSpan.End()

	client, err := h.getClientAndConfig(c)
	if err != nil {
		h.tracingHelper.RecordError(clientSpan, err, "Failed to get Kubernetes client")
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	h.tracingHelper.RecordSuccess(clientSpan, "Client setup completed")

	// Define the fetch function for periodic updates
	fetchRoles := func() (interface{}, error) {
		namespace := c.Query("namespace")
		// Start child span for Kubernetes API call with timeout
		ctxWithTimeout, cancel := context.WithTimeout(ctx, 30*time.Second)
		defer cancel()
		_, k8sSpan := h.tracingHelper.StartKubernetesAPISpan(ctxWithTimeout, "list", "roles", namespace)
		defer k8sSpan.End()

		var roleList *rbacV1.RoleList
		if namespace != "" {
			roleList, err = client.RbacV1().Roles(namespace).List(ctxWithTimeout, metav1.ListOptions{})
		} else {
			roleList, err = client.RbacV1().Roles("").List(ctxWithTimeout, metav1.ListOptions{})
		}

		if err != nil {
			h.tracingHelper.RecordError(k8sSpan, err, "Failed to list roles")
			return nil, err
		}
		h.tracingHelper.RecordSuccess(k8sSpan, "Successfully listed roles")
		h.tracingHelper.AddResourceAttributes(k8sSpan, "roles", "role", len(roleList.Items))

		// Start child span for data transformation
		_, transformSpan := h.tracingHelper.StartDataProcessingSpan(ctxWithTimeout, "transform-roles")
		defer transformSpan.End()

		// Transform roles to frontend-expected format
		var response []types.RoleListResponse
		for _, role := range roleList.Items {
			response = append(response, transformers.TransformRoleToResponse(&role))
		}
		h.tracingHelper.RecordSuccess(transformSpan, "Successfully transformed roles")

		return response, nil
	}

	// Get initial data
	initialData, err := fetchRoles()
	if err != nil {
		h.logger.WithError(err).Error("Failed to fetch roles")
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	h.sseHandler.SendSSEResponseWithUpdates(c, initialData, fetchRoles)
}

// GetRole returns a specific role
func (h *RolesHandler) GetRole(c *gin.Context) {
	// Start child span for client setup
	ctx, clientSpan := h.tracingHelper.StartAuthSpan(c.Request.Context(), "get-client-config")
	defer clientSpan.End()

	client, err := h.getClientAndConfig(c)
	if err != nil {
		h.logger.WithError(err).Error("Failed to get client for role")
		h.tracingHelper.RecordError(clientSpan, err, "Failed to get Kubernetes client")
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	h.tracingHelper.RecordSuccess(clientSpan, "Client setup completed")

	name := c.Param("name")
	namespace := c.Param("namespace")

	// Start child span for Kubernetes API call
	_, k8sSpan := h.tracingHelper.StartKubernetesAPISpan(ctx, "get", "role", namespace)
	defer k8sSpan.End()

	role, err := client.RbacV1().Roles(namespace).Get(ctx, name, metav1.GetOptions{})
	if err != nil {
		h.logger.WithError(err).WithField("role", name).Error("Failed to get role")
		h.tracingHelper.RecordError(k8sSpan, err, "Failed to get role")
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}
	h.tracingHelper.RecordSuccess(k8sSpan, "Successfully retrieved role")
	h.tracingHelper.AddResourceAttributes(k8sSpan, "role", name, 1)

	// Check if this is an SSE request (EventSource expects SSE format)
	acceptHeader := c.GetHeader("Accept")
	if acceptHeader == "text/event-stream" {
		h.sseHandler.SendSSEResponse(c, role)
		return
	}

	c.JSON(http.StatusOK, role)
}

// GetRoleByName returns a specific role by name
func (h *RolesHandler) GetRoleByName(c *gin.Context) {
	name := c.Param("name")
	namespace := c.Query("namespace")

	if namespace == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "namespace is required"})
		return
	}

	// Start child span for client setup
	ctx, clientSpan := h.tracingHelper.StartAuthSpan(c.Request.Context(), "get-client-config")
	defer clientSpan.End()

	client, err := h.getClientAndConfig(c)
	if err != nil {
		h.logger.WithError(err).Error("Failed to get client for role by name")
		h.tracingHelper.RecordError(clientSpan, err, "Failed to get Kubernetes client")
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	h.tracingHelper.RecordSuccess(clientSpan, "Client setup completed")

	// Start child span for Kubernetes API call
	_, k8sSpan := h.tracingHelper.StartKubernetesAPISpan(ctx, "get", "role", namespace)
	defer k8sSpan.End()

	role, err := client.RbacV1().Roles(namespace).Get(ctx, name, metav1.GetOptions{})
	if err != nil {
		h.logger.WithError(err).WithField("role", name).Error("Failed to get role by name")
		h.tracingHelper.RecordError(k8sSpan, err, "Failed to get role")
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}
	h.tracingHelper.RecordSuccess(k8sSpan, "Successfully retrieved role")
	h.tracingHelper.AddResourceAttributes(k8sSpan, "role", name, 1)

	c.JSON(http.StatusOK, role)
}

// GetRoleYAMLByName returns YAML representation of a role by name
func (h *RolesHandler) GetRoleYAMLByName(c *gin.Context) {
	name := c.Param("name")
	namespace := c.Query("namespace")

	if namespace == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "namespace is required"})
		return
	}

	// Start child span for client setup
	ctx, clientSpan := h.tracingHelper.StartAuthSpan(c.Request.Context(), "get-client-config")
	defer clientSpan.End()

	client, err := h.getClientAndConfig(c)
	if err != nil {
		h.logger.WithError(err).Error("Failed to get client for role YAML by name")
		h.tracingHelper.RecordError(clientSpan, err, "Failed to get Kubernetes client")
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	h.tracingHelper.RecordSuccess(clientSpan, "Client setup completed")

	// Start child span for Kubernetes API call
	_, k8sSpan := h.tracingHelper.StartKubernetesAPISpan(ctx, "get", "role", namespace)
	defer k8sSpan.End()

	role, err := client.RbacV1().Roles(namespace).Get(ctx, name, metav1.GetOptions{})
	if err != nil {
		h.logger.WithError(err).WithField("role", name).Error("Failed to get role YAML by name")
		h.tracingHelper.RecordError(k8sSpan, err, "Failed to get role")
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}
	h.tracingHelper.RecordSuccess(k8sSpan, "Successfully retrieved role")
	h.tracingHelper.AddResourceAttributes(k8sSpan, "role", name, 1)

	h.yamlHandler.SendYAMLResponse(c, role, name)
}

// GetRoleYAML returns YAML representation of a role
func (h *RolesHandler) GetRoleYAML(c *gin.Context) {
	// Start child span for client setup
	ctx, clientSpan := h.tracingHelper.StartAuthSpan(c.Request.Context(), "get-client-config")
	defer clientSpan.End()

	client, err := h.getClientAndConfig(c)
	if err != nil {
		h.logger.WithError(err).Error("Failed to get client for role YAML")
		h.tracingHelper.RecordError(clientSpan, err, "Failed to get Kubernetes client")
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	h.tracingHelper.RecordSuccess(clientSpan, "Client setup completed")

	name := c.Param("name")
	namespace := c.Param("namespace")

	// Start child span for Kubernetes API call
	_, k8sSpan := h.tracingHelper.StartKubernetesAPISpan(ctx, "get", "role", namespace)
	defer k8sSpan.End()

	role, err := client.RbacV1().Roles(namespace).Get(ctx, name, metav1.GetOptions{})
	if err != nil {
		h.logger.WithError(err).WithField("role", name).Error("Failed to get role YAML")
		h.tracingHelper.RecordError(k8sSpan, err, "Failed to get role")
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}
	h.tracingHelper.RecordSuccess(k8sSpan, "Successfully retrieved role")
	h.tracingHelper.AddResourceAttributes(k8sSpan, "role", name, 1)

	h.yamlHandler.SendYAMLResponse(c, role, name)
}

// GetRoleEventsByName returns events for a specific role by name
func (h *RolesHandler) GetRoleEventsByName(c *gin.Context) {
	name := c.Param("name")
	namespace := c.Query("namespace")

	if namespace == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "namespace is required"})
		return
	}

	// Start child span for client setup
	ctx, clientSpan := h.tracingHelper.StartAuthSpan(c.Request.Context(), "get-client-config")
	defer clientSpan.End()

	client, err := h.getClientAndConfig(c)
	if err != nil {
		h.logger.WithError(err).Error("Failed to get client for role events by name")
		h.tracingHelper.RecordError(clientSpan, err, "Failed to get Kubernetes client")
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	h.tracingHelper.RecordSuccess(clientSpan, "Client setup completed")

	// Start child span for Kubernetes API call
	_, k8sSpan := h.tracingHelper.StartKubernetesAPISpan(ctx, "list", "events", namespace)
	defer k8sSpan.End()

	h.eventsHandler.GetResourceEventsWithNamespace(c, client, "Role", name, namespace, h.sseHandler.SendSSEResponse)
}

// GetRoleEvents returns events for a specific role
func (h *RolesHandler) GetRoleEvents(c *gin.Context) {
	name := c.Param("name")
	namespace := c.Param("namespace")

	// Start child span for client setup
	ctx, clientSpan := h.tracingHelper.StartAuthSpan(c.Request.Context(), "get-client-config")
	defer clientSpan.End()

	client, err := h.getClientAndConfig(c)
	if err != nil {
		h.logger.WithError(err).Error("Failed to get client for role events")
		h.tracingHelper.RecordError(clientSpan, err, "Failed to get Kubernetes client")
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	h.tracingHelper.RecordSuccess(clientSpan, "Client setup completed")

	// Start child span for Kubernetes API call
	_, k8sSpan := h.tracingHelper.StartKubernetesAPISpan(ctx, "list", "events", namespace)
	defer k8sSpan.End()

	h.eventsHandler.GetResourceEventsWithNamespace(c, client, "Role", name, namespace, h.sseHandler.SendSSEResponse)
}
