package access_control

import (
	"context"
	"fmt"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
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

// ClusterRolesHandler handles ClusterRole-related operations
type ClusterRolesHandler struct {
	store         *storage.KubeConfigStore
	clientFactory *k8s.ClientFactory
	logger        *logger.Logger
	sseHandler    *utils.SSEHandler
	yamlHandler   *utils.YAMLHandler
	eventsHandler *utils.EventsHandler
	tracingHelper *tracing.TracingHelper
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
		tracingHelper: tracing.GetTracingHelper(),
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
	fetchClusterRoles := func() (interface{}, error) {
		// Start child span for Kubernetes API call with timeout (cluster-scoped resource)
		ctxWithTimeout, cancel := context.WithTimeout(ctx, 30*time.Second)
		defer cancel()
		_, k8sSpan := h.tracingHelper.StartKubernetesAPISpan(ctxWithTimeout, "list", "clusterroles", "")
		defer k8sSpan.End()

		clusterRoleList, err := client.RbacV1().ClusterRoles().List(ctxWithTimeout, metav1.ListOptions{})
		if err != nil {
			h.tracingHelper.RecordError(k8sSpan, err, "Failed to list cluster roles")
			return nil, err
		}
		h.tracingHelper.RecordSuccess(k8sSpan, "Successfully listed cluster roles")
		h.tracingHelper.AddResourceAttributes(k8sSpan, "clusterroles", "clusterrole", len(clusterRoleList.Items))

		// Start child span for data transformation
		_, transformSpan := h.tracingHelper.StartDataProcessingSpan(ctxWithTimeout, "transform-clusterroles")
		defer transformSpan.End()

		// Transform cluster roles to frontend-expected format
		var response []types.ClusterRoleListResponse
		for _, clusterRole := range clusterRoleList.Items {
			response = append(response, transformers.TransformClusterRoleToResponse(&clusterRole))
		}
		h.tracingHelper.RecordSuccess(transformSpan, "Successfully transformed cluster roles")

		return response, nil
	}

	// Get initial data
	initialData, err := fetchClusterRoles()
	if err != nil {
		h.logger.WithError(err).Error("Failed to fetch cluster roles")
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	h.sseHandler.SendSSEResponseWithUpdates(c, initialData, fetchClusterRoles)
}

// GetClusterRole returns a specific cluster role
func (h *ClusterRolesHandler) GetClusterRole(c *gin.Context) {
	// Start child span for client setup
	ctx, clientSpan := h.tracingHelper.StartAuthSpan(c.Request.Context(), "get-client-config")
	defer clientSpan.End()

	client, err := h.getClientAndConfig(c)
	if err != nil {
		h.logger.WithError(err).Error("Failed to get client for cluster role")
		h.tracingHelper.RecordError(clientSpan, err, "Failed to get Kubernetes client")
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	h.tracingHelper.RecordSuccess(clientSpan, "Client setup completed")

	name := c.Param("name")

	// Start child span for Kubernetes API call (cluster-scoped resource)
	_, k8sSpan := h.tracingHelper.StartKubernetesAPISpan(ctx, "get", "clusterrole", "")
	defer k8sSpan.End()

	clusterRole, err := client.RbacV1().ClusterRoles().Get(ctx, name, metav1.GetOptions{})
	if err != nil {
		h.logger.WithError(err).WithField("clusterRole", name).Error("Failed to get cluster role")
		h.tracingHelper.RecordError(k8sSpan, err, "Failed to get cluster role")
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}
	h.tracingHelper.RecordSuccess(k8sSpan, "Successfully retrieved cluster role")
	h.tracingHelper.AddResourceAttributes(k8sSpan, "clusterrole", name, 1)

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
	// Start child span for client setup
	ctx, clientSpan := h.tracingHelper.StartAuthSpan(c.Request.Context(), "get-client-config")
	defer clientSpan.End()

	client, err := h.getClientAndConfig(c)
	if err != nil {
		h.logger.WithError(err).Error("Failed to get client for cluster role by name")
		h.tracingHelper.RecordError(clientSpan, err, "Failed to get Kubernetes client")
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	h.tracingHelper.RecordSuccess(clientSpan, "Client setup completed")

	name := c.Param("name")

	// Start child span for Kubernetes API call (cluster-scoped resource)
	_, k8sSpan := h.tracingHelper.StartKubernetesAPISpan(ctx, "get", "clusterrole", "")
	defer k8sSpan.End()

	clusterRole, err := client.RbacV1().ClusterRoles().Get(ctx, name, metav1.GetOptions{})
	if err != nil {
		h.logger.WithError(err).WithField("clusterRole", name).Error("Failed to get cluster role by name")
		h.tracingHelper.RecordError(k8sSpan, err, "Failed to get cluster role")
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}
	h.tracingHelper.RecordSuccess(k8sSpan, "Successfully retrieved cluster role")
	h.tracingHelper.AddResourceAttributes(k8sSpan, "clusterrole", name, 1)

	c.JSON(http.StatusOK, clusterRole)
}

// GetClusterRoleYAMLByName returns YAML representation of a cluster role by name
func (h *ClusterRolesHandler) GetClusterRoleYAMLByName(c *gin.Context) {
	// Start child span for client setup
	ctx, clientSpan := h.tracingHelper.StartAuthSpan(c.Request.Context(), "get-client-config")
	defer clientSpan.End()

	client, err := h.getClientAndConfig(c)
	if err != nil {
		h.logger.WithError(err).Error("Failed to get client for cluster role YAML by name")
		h.tracingHelper.RecordError(clientSpan, err, "Failed to get Kubernetes client")
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	h.tracingHelper.RecordSuccess(clientSpan, "Client setup completed")

	name := c.Param("name")

	// Start child span for Kubernetes API call (cluster-scoped resource)
	_, k8sSpan := h.tracingHelper.StartKubernetesAPISpan(ctx, "get", "clusterrole", "")
	defer k8sSpan.End()

	clusterRole, err := client.RbacV1().ClusterRoles().Get(ctx, name, metav1.GetOptions{})
	if err != nil {
		h.logger.WithError(err).WithField("clusterRole", name).Error("Failed to get cluster role YAML by name")
		h.tracingHelper.RecordError(k8sSpan, err, "Failed to get cluster role")
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}
	h.tracingHelper.RecordSuccess(k8sSpan, "Successfully retrieved cluster role")
	h.tracingHelper.AddResourceAttributes(k8sSpan, "clusterrole", name, 1)

	h.yamlHandler.SendYAMLResponse(c, clusterRole, name)
}

// GetClusterRoleYAML returns YAML representation of a cluster role
func (h *ClusterRolesHandler) GetClusterRoleYAML(c *gin.Context) {
	// Start child span for client setup
	ctx, clientSpan := h.tracingHelper.StartAuthSpan(c.Request.Context(), "get-client-config")
	defer clientSpan.End()

	client, err := h.getClientAndConfig(c)
	if err != nil {
		h.logger.WithError(err).Error("Failed to get client for cluster role YAML")
		h.tracingHelper.RecordError(clientSpan, err, "Failed to get Kubernetes client")
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	h.tracingHelper.RecordSuccess(clientSpan, "Client setup completed")

	name := c.Param("name")

	// Start child span for Kubernetes API call (cluster-scoped resource)
	_, k8sSpan := h.tracingHelper.StartKubernetesAPISpan(ctx, "get", "clusterrole", "")
	defer k8sSpan.End()

	clusterRole, err := client.RbacV1().ClusterRoles().Get(ctx, name, metav1.GetOptions{})
	if err != nil {
		h.logger.WithError(err).WithField("clusterRole", name).Error("Failed to get cluster role YAML")
		h.tracingHelper.RecordError(k8sSpan, err, "Failed to get cluster role")
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}
	h.tracingHelper.RecordSuccess(k8sSpan, "Successfully retrieved cluster role")
	h.tracingHelper.AddResourceAttributes(k8sSpan, "clusterrole", name, 1)

	h.yamlHandler.SendYAMLResponse(c, clusterRole, name)
}

// GetClusterRoleEventsByName returns events for a specific cluster role by name
func (h *ClusterRolesHandler) GetClusterRoleEventsByName(c *gin.Context) {
	name := c.Param("name")

	// Start child span for client setup
	ctx, clientSpan := h.tracingHelper.StartAuthSpan(c.Request.Context(), "get-client-config")
	defer clientSpan.End()

	client, err := h.getClientAndConfig(c)
	if err != nil {
		h.logger.WithError(err).Error("Failed to get client for cluster role events by name")
		h.tracingHelper.RecordError(clientSpan, err, "Failed to get Kubernetes client")
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	h.tracingHelper.RecordSuccess(clientSpan, "Client setup completed")

	// Start child span for Kubernetes API call (cluster-scoped resource)
	_, k8sSpan := h.tracingHelper.StartKubernetesAPISpan(ctx, "list", "events", "")
	defer k8sSpan.End()

	h.eventsHandler.GetResourceEvents(c, client, "ClusterRole", name, h.sseHandler.SendSSEResponse)
}

// GetClusterRoleEvents returns events for a specific cluster role
func (h *ClusterRolesHandler) GetClusterRoleEvents(c *gin.Context) {
	name := c.Param("name")

	// Start child span for client setup
	ctx, clientSpan := h.tracingHelper.StartAuthSpan(c.Request.Context(), "get-client-config")
	defer clientSpan.End()

	client, err := h.getClientAndConfig(c)
	if err != nil {
		h.logger.WithError(err).Error("Failed to get client for cluster role events")
		h.tracingHelper.RecordError(clientSpan, err, "Failed to get Kubernetes client")
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	h.tracingHelper.RecordSuccess(clientSpan, "Client setup completed")

	// Start child span for Kubernetes API call (cluster-scoped resource)
	_, k8sSpan := h.tracingHelper.StartKubernetesAPISpan(ctx, "list", "events", "")
	defer k8sSpan.End()

	h.eventsHandler.GetResourceEvents(c, client, "ClusterRole", name, h.sseHandler.SendSSEResponse)
}
