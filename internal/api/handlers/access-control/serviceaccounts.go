package access_control

import (
	"fmt"
	"net/http"

	"github.com/gin-gonic/gin"
	v1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/client-go/kubernetes"

	"github.com/Facets-cloud/kube-dash/internal/api/transformers"
	"github.com/Facets-cloud/kube-dash/internal/api/types"
	"github.com/Facets-cloud/kube-dash/internal/api/utils"
	"github.com/Facets-cloud/kube-dash/internal/k8s"
	"github.com/Facets-cloud/kube-dash/internal/storage"
	"github.com/Facets-cloud/kube-dash/pkg/logger"
)

// ServiceAccountsHandler handles ServiceAccount-related operations
type ServiceAccountsHandler struct {
	store         *storage.KubeConfigStore
	clientFactory *k8s.ClientFactory
	logger        *logger.Logger
	sseHandler    *utils.SSEHandler
	yamlHandler   *utils.YAMLHandler
	eventsHandler *utils.EventsHandler
}

// NewServiceAccountsHandler creates a new ServiceAccountsHandler
func NewServiceAccountsHandler(store *storage.KubeConfigStore, clientFactory *k8s.ClientFactory, log *logger.Logger) *ServiceAccountsHandler {
	return &ServiceAccountsHandler{
		store:         store,
		clientFactory: clientFactory,
		logger:        log,
		sseHandler:    utils.NewSSEHandler(log),
		yamlHandler:   utils.NewYAMLHandler(log),
		eventsHandler: utils.NewEventsHandler(log),
	}
}

// getClientAndConfig gets the Kubernetes client and config for the given config ID and cluster
func (h *ServiceAccountsHandler) getClientAndConfig(c *gin.Context) (*kubernetes.Clientset, error) {
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

// GetServiceAccountsSSE returns service accounts as Server-Sent Events with real-time updates
func (h *ServiceAccountsHandler) GetServiceAccountsSSE(c *gin.Context) {
	client, err := h.getClientAndConfig(c)
	if err != nil {
		h.logger.WithError(err).Error("Failed to get client for service accounts SSE")
		h.sseHandler.SendSSEError(c, http.StatusBadRequest, err.Error())
		return
	}

	// Function to fetch and transform service accounts data
	fetchServiceAccounts := func() (interface{}, error) {
		namespace := c.Query("namespace")
		var serviceAccountList *v1.ServiceAccountList
		var err error

		if namespace != "" {
			serviceAccountList, err = client.CoreV1().ServiceAccounts(namespace).List(c.Request.Context(), metav1.ListOptions{})
		} else {
			serviceAccountList, err = client.CoreV1().ServiceAccounts("").List(c.Request.Context(), metav1.ListOptions{})
		}

		if err != nil {
			return nil, err
		}

		// Transform service accounts to frontend-expected format
		var response []types.ServiceAccountListResponse
		for _, serviceAccount := range serviceAccountList.Items {
			response = append(response, transformers.TransformServiceAccountToResponse(&serviceAccount))
		}

		return response, nil
	}

	// Get initial data
	initialData, err := fetchServiceAccounts()
	if err != nil {
		h.logger.WithError(err).Error("Failed to list service accounts for SSE")
		// Check if this is a permission error
		if utils.IsPermissionError(err) {
			h.sseHandler.SendSSEPermissionError(c, err)
		} else {
			h.sseHandler.SendSSEError(c, http.StatusInternalServerError, err.Error())
		}
		return
	}

	// Check if this is an SSE request (EventSource expects SSE format)
	acceptHeader := c.GetHeader("Accept")
	if acceptHeader == "text/event-stream" {
		// Send SSE response with periodic updates
		h.sseHandler.SendSSEResponseWithUpdates(c, initialData, fetchServiceAccounts)
		return
	}

	// For non-SSE requests, return JSON
	c.JSON(http.StatusOK, initialData)
}

// GetServiceAccount returns a specific service account
func (h *ServiceAccountsHandler) GetServiceAccount(c *gin.Context) {
	client, err := h.getClientAndConfig(c)
	if err != nil {
		h.logger.WithError(err).Error("Failed to get client for service account")
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	name := c.Param("name")
	namespace := c.Param("namespace")
	serviceAccount, err := client.CoreV1().ServiceAccounts(namespace).Get(c.Request.Context(), name, metav1.GetOptions{})
	if err != nil {
		h.logger.WithError(err).WithField("serviceAccount", name).Error("Failed to get service account")
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	// Check if this is an SSE request (EventSource expects SSE format)
	acceptHeader := c.GetHeader("Accept")
	if acceptHeader == "text/event-stream" {
		h.sseHandler.SendSSEResponse(c, serviceAccount)
		return
	}

	c.JSON(http.StatusOK, serviceAccount)
}

// GetServiceAccountByName returns a specific service account by name
func (h *ServiceAccountsHandler) GetServiceAccountByName(c *gin.Context) {
	client, err := h.getClientAndConfig(c)
	if err != nil {
		h.logger.WithError(err).Error("Failed to get client for service account by name")
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	name := c.Param("name")
	namespace := c.Query("namespace")

	if namespace == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "namespace is required"})
		return
	}

	serviceAccount, err := client.CoreV1().ServiceAccounts(namespace).Get(c.Request.Context(), name, metav1.GetOptions{})
	if err != nil {
		h.logger.WithError(err).WithField("serviceAccount", name).Error("Failed to get service account by name")
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, serviceAccount)
}

// GetServiceAccountYAMLByName returns YAML representation of a service account by name
func (h *ServiceAccountsHandler) GetServiceAccountYAMLByName(c *gin.Context) {
	client, err := h.getClientAndConfig(c)
	if err != nil {
		h.logger.WithError(err).Error("Failed to get client for service account YAML by name")
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	name := c.Param("name")
	namespace := c.Query("namespace")

	if namespace == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "namespace is required"})
		return
	}

	serviceAccount, err := client.CoreV1().ServiceAccounts(namespace).Get(c.Request.Context(), name, metav1.GetOptions{})
	if err != nil {
		h.logger.WithError(err).WithField("serviceAccount", name).Error("Failed to get service account YAML by name")
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	h.yamlHandler.SendYAMLResponse(c, serviceAccount, name)
}

// GetServiceAccountYAML returns YAML representation of a service account
func (h *ServiceAccountsHandler) GetServiceAccountYAML(c *gin.Context) {
	client, err := h.getClientAndConfig(c)
	if err != nil {
		h.logger.WithError(err).Error("Failed to get client for service account YAML")
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	name := c.Param("name")
	namespace := c.Param("namespace")
	serviceAccount, err := client.CoreV1().ServiceAccounts(namespace).Get(c.Request.Context(), name, metav1.GetOptions{})
	if err != nil {
		h.logger.WithError(err).WithField("serviceAccount", name).Error("Failed to get service account YAML")
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	h.yamlHandler.SendYAMLResponse(c, serviceAccount, name)
}

// GetServiceAccountEventsByName returns events for a specific service account by name
func (h *ServiceAccountsHandler) GetServiceAccountEventsByName(c *gin.Context) {
	client, err := h.getClientAndConfig(c)
	if err != nil {
		h.logger.WithError(err).Error("Failed to get client for service account events by name")
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	name := c.Param("name")
	namespace := c.Query("namespace")

	if namespace == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "namespace is required"})
		return
	}

	h.eventsHandler.GetResourceEventsWithNamespace(c, client, "ServiceAccount", name, namespace, h.sseHandler.SendSSEResponse)
}

// GetServiceAccountEvents returns events for a specific service account
func (h *ServiceAccountsHandler) GetServiceAccountEvents(c *gin.Context) {
	client, err := h.getClientAndConfig(c)
	if err != nil {
		h.logger.WithError(err).Error("Failed to get client for service account events")
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	name := c.Param("name")
	h.eventsHandler.GetResourceEvents(c, client, "ServiceAccount", name, h.sseHandler.SendSSEResponse)
}
