package workloads

import (
	"fmt"
	"net/http"

	"kubewall-backend/internal/api/transformers"
	"kubewall-backend/internal/api/types"
	"kubewall-backend/internal/api/utils"
	"kubewall-backend/internal/k8s"
	"kubewall-backend/internal/storage"
	"kubewall-backend/pkg/logger"

	"github.com/gin-gonic/gin"
	appsV1 "k8s.io/api/apps/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/client-go/kubernetes"
)

// DeploymentsHandler handles all deployment-related operations
type DeploymentsHandler struct {
	store         *storage.KubeConfigStore
	clientFactory *k8s.ClientFactory
	logger        *logger.Logger
	sseHandler    *utils.SSEHandler
	yamlHandler   *utils.YAMLHandler
	eventsHandler *utils.EventsHandler
}

// NewDeploymentsHandler creates a new deployments handler
func NewDeploymentsHandler(store *storage.KubeConfigStore, clientFactory *k8s.ClientFactory, log *logger.Logger) *DeploymentsHandler {
	return &DeploymentsHandler{
		store:         store,
		clientFactory: clientFactory,
		logger:        log,
		sseHandler:    utils.NewSSEHandler(log),
		yamlHandler:   utils.NewYAMLHandler(log),
		eventsHandler: utils.NewEventsHandler(log),
	}
}

// getClientAndConfig gets the Kubernetes client and config for the given config ID and cluster
func (h *DeploymentsHandler) getClientAndConfig(c *gin.Context) (*kubernetes.Clientset, error) {
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

// GetDeployments returns all deployments
func (h *DeploymentsHandler) GetDeployments(c *gin.Context) {
	client, err := h.getClientAndConfig(c)
	if err != nil {
		h.logger.WithError(err).Error("Failed to get client for deployments")
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	namespace := c.Query("namespace")
	var deployments interface{}
	var err2 error

	if namespace != "" {
		deployments, err2 = client.AppsV1().Deployments(namespace).List(c.Request.Context(), metav1.ListOptions{})
	} else {
		deployments, err2 = client.AppsV1().Deployments("").List(c.Request.Context(), metav1.ListOptions{})
	}

	if err2 != nil {
		h.logger.WithError(err2).Error("Failed to list deployments")
		c.JSON(http.StatusInternalServerError, gin.H{"error": err2.Error()})
		return
	}

	c.JSON(http.StatusOK, deployments)
}

// GetDeploymentsSSE returns deployments as Server-Sent Events with real-time updates
func (h *DeploymentsHandler) GetDeploymentsSSE(c *gin.Context) {
	client, err := h.getClientAndConfig(c)
	if err != nil {
		h.logger.WithError(err).Error("Failed to get client for deployments SSE")
		h.sseHandler.SendSSEError(c, http.StatusBadRequest, err.Error())
		return
	}

	namespace := c.Query("namespace")

	// Function to fetch and transform deployments data
	fetchDeployments := func() (interface{}, error) {
		var deploymentList *appsV1.DeploymentList
		var err2 error

		if namespace != "" {
			deploymentList, err2 = client.AppsV1().Deployments(namespace).List(c.Request.Context(), metav1.ListOptions{})
		} else {
			deploymentList, err2 = client.AppsV1().Deployments("").List(c.Request.Context(), metav1.ListOptions{})
		}

		if err2 != nil {
			return nil, err2
		}

		// Transform deployments to the expected format
		var transformedDeployments []types.DeploymentListResponse
		for _, deployment := range deploymentList.Items {
			transformedDeployments = append(transformedDeployments, transformers.TransformDeploymentToResponse(&deployment))
		}

		return transformedDeployments, nil
	}

	// Get initial data
	initialData, err := fetchDeployments()
	if err != nil {
		h.logger.WithError(err).Error("Failed to list deployments for SSE")
		h.sseHandler.SendSSEError(c, http.StatusInternalServerError, err.Error())
		return
	}

	// Check if this is an SSE request (EventSource expects SSE format)
	acceptHeader := c.GetHeader("Accept")
	if acceptHeader == "text/event-stream" {
		// Send SSE response with periodic updates
		h.sseHandler.SendSSEResponseWithUpdates(c, initialData, fetchDeployments)
		return
	}

	// For non-SSE requests, return JSON
	c.JSON(http.StatusOK, initialData)
}

// GetDeployment returns a specific deployment
func (h *DeploymentsHandler) GetDeployment(c *gin.Context) {
	client, err := h.getClientAndConfig(c)
	if err != nil {
		h.logger.WithError(err).Error("Failed to get client for deployment")
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	name := c.Param("name")
	namespace := c.Param("namespace")

	deployment, err := client.AppsV1().Deployments(namespace).Get(c.Request.Context(), name, metav1.GetOptions{})
	if err != nil {
		h.logger.WithError(err).WithField("deployment", name).WithField("namespace", namespace).Error("Failed to get deployment")
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	// Always send SSE format for detail endpoints since they're used by EventSource
	h.sseHandler.SendSSEResponse(c, deployment)
}

// GetDeploymentByName returns a specific deployment by name using namespace from query parameters
func (h *DeploymentsHandler) GetDeploymentByName(c *gin.Context) {
	client, err := h.getClientAndConfig(c)
	if err != nil {
		h.logger.WithError(err).Error("Failed to get client for deployment")
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	name := c.Param("name")
	namespace := c.Query("namespace")

	if namespace == "" {
		h.logger.WithField("deployment", name).Error("Namespace is required for deployment lookup")
		c.JSON(http.StatusBadRequest, gin.H{"error": "namespace parameter is required"})
		return
	}

	deployment, err := client.AppsV1().Deployments(namespace).Get(c.Request.Context(), name, metav1.GetOptions{})
	if err != nil {
		h.logger.WithError(err).WithField("deployment", name).WithField("namespace", namespace).Error("Failed to get deployment")
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	// Always send SSE format for detail endpoints since they're used by EventSource
	h.sseHandler.SendSSEResponse(c, deployment)
}

// GetDeploymentYAMLByName returns the YAML representation of a specific deployment by name
func (h *DeploymentsHandler) GetDeploymentYAMLByName(c *gin.Context) {
	client, err := h.getClientAndConfig(c)
	if err != nil {
		h.logger.WithError(err).Error("Failed to get client for deployment YAML")
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	name := c.Param("name")
	namespace := c.Query("namespace")

	if namespace == "" {
		h.logger.WithField("deployment", name).Error("Namespace is required for deployment YAML lookup")
		c.JSON(http.StatusBadRequest, gin.H{"error": "namespace parameter is required"})
		return
	}

	deployment, err := client.AppsV1().Deployments(namespace).Get(c.Request.Context(), name, metav1.GetOptions{})
	if err != nil {
		h.logger.WithError(err).WithField("deployment", name).WithField("namespace", namespace).Error("Failed to get deployment for YAML")
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	h.yamlHandler.SendYAMLResponse(c, deployment, name)
}

// GetDeploymentYAML returns the YAML representation of a specific deployment
func (h *DeploymentsHandler) GetDeploymentYAML(c *gin.Context) {
	client, err := h.getClientAndConfig(c)
	if err != nil {
		h.logger.WithError(err).Error("Failed to get client for deployment YAML")
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	name := c.Param("name")
	namespace := c.Param("namespace")

	deployment, err := client.AppsV1().Deployments(namespace).Get(c.Request.Context(), name, metav1.GetOptions{})
	if err != nil {
		h.logger.WithError(err).WithField("deployment", name).WithField("namespace", namespace).Error("Failed to get deployment for YAML")
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	h.yamlHandler.SendYAMLResponse(c, deployment, name)
}

// GetDeploymentEventsByName returns events for a specific deployment by name
func (h *DeploymentsHandler) GetDeploymentEventsByName(c *gin.Context) {
	client, err := h.getClientAndConfig(c)
	if err != nil {
		h.logger.WithError(err).Error("Failed to get client for deployment events")
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	name := c.Param("name")
	namespace := c.Query("namespace")

	if namespace == "" {
		h.logger.WithField("deployment", name).Error("Namespace is required for deployment events lookup")
		c.JSON(http.StatusBadRequest, gin.H{"error": "namespace parameter is required"})
		return
	}

	h.eventsHandler.GetResourceEventsWithNamespace(c, client, "Deployment", name, namespace, h.sseHandler.SendSSEResponse)
}

// GetDeploymentEvents returns events for a specific deployment
func (h *DeploymentsHandler) GetDeploymentEvents(c *gin.Context) {
	client, err := h.getClientAndConfig(c)
	if err != nil {
		h.logger.WithError(err).Error("Failed to get client for deployment events")
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	name := c.Param("name")
	h.eventsHandler.GetResourceEvents(c, client, "Deployment", name, h.sseHandler.SendSSEResponse)
}

// GetDeploymentPods returns pods for a specific deployment
func (h *DeploymentsHandler) GetDeploymentPods(c *gin.Context) {
	client, err := h.getClientAndConfig(c)
	if err != nil {
		h.logger.WithError(err).Error("Failed to get client for deployment pods")
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	name := c.Param("name")
	namespace := c.Param("namespace")

	// Get the deployment to get its selector
	deployment, err := client.AppsV1().Deployments(namespace).Get(c.Request.Context(), name, metav1.GetOptions{})
	if err != nil {
		h.logger.WithError(err).WithField("deployment", name).WithField("namespace", namespace).Error("Failed to get deployment")
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	// Get pods using the deployment's selector
	selector := metav1.FormatLabelSelector(deployment.Spec.Selector)
	pods, err := client.CoreV1().Pods(namespace).List(c.Request.Context(), metav1.ListOptions{
		LabelSelector: selector,
	})
	if err != nil {
		h.logger.WithError(err).WithField("deployment", name).WithField("namespace", namespace).Error("Failed to get deployment pods")
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	// Always send SSE format for detail endpoints since they're used by EventSource
	h.sseHandler.SendSSEResponse(c, pods)
}

// GetDeploymentPodsByName returns pods for a specific deployment by name using namespace from query parameters
func (h *DeploymentsHandler) GetDeploymentPodsByName(c *gin.Context) {
	client, err := h.getClientAndConfig(c)
	if err != nil {
		h.logger.WithError(err).Error("Failed to get client for deployment pods")
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	name := c.Param("name")
	namespace := c.Query("namespace")

	if namespace == "" {
		h.logger.WithField("deployment", name).Error("Namespace is required for deployment pods lookup")
		c.JSON(http.StatusBadRequest, gin.H{"error": "namespace parameter is required"})
		return
	}

	// Get the deployment to get its selector
	deployment, err := client.AppsV1().Deployments(namespace).Get(c.Request.Context(), name, metav1.GetOptions{})
	if err != nil {
		h.logger.WithError(err).WithField("deployment", name).WithField("namespace", namespace).Error("Failed to get deployment")
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	// Get pods using the deployment's selector
	selector := metav1.FormatLabelSelector(deployment.Spec.Selector)
	pods, err := client.CoreV1().Pods(namespace).List(c.Request.Context(), metav1.ListOptions{
		LabelSelector: selector,
	})
	if err != nil {
		h.logger.WithError(err).WithField("deployment", name).WithField("namespace", namespace).Error("Failed to get deployment pods")
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	// Always send SSE format for detail endpoints since they're used by EventSource
	h.sseHandler.SendSSEResponse(c, pods)
}
