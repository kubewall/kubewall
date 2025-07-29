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
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/client-go/kubernetes"
)

// ReplicaSetsHandler handles ReplicaSet-related operations
type ReplicaSetsHandler struct {
	store         *storage.KubeConfigStore
	clientFactory *k8s.ClientFactory
	logger        *logger.Logger
	eventsHandler *utils.EventsHandler
	yamlHandler   *utils.YAMLHandler
	sseHandler    *utils.SSEHandler
}

// NewReplicaSetsHandler creates a new ReplicaSets handler
func NewReplicaSetsHandler(store *storage.KubeConfigStore, clientFactory *k8s.ClientFactory, log *logger.Logger) *ReplicaSetsHandler {
	return &ReplicaSetsHandler{
		store:         store,
		clientFactory: clientFactory,
		logger:        log,
		eventsHandler: utils.NewEventsHandler(log),
		yamlHandler:   utils.NewYAMLHandler(log),
		sseHandler:    utils.NewSSEHandler(log),
	}
}

// getClientAndConfig gets the Kubernetes client and config for the given config ID and cluster
func (h *ReplicaSetsHandler) getClientAndConfig(c *gin.Context) (*kubernetes.Clientset, error) {
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

// GetReplicaSetsSSE returns replicasets as Server-Sent Events with real-time updates
func (h *ReplicaSetsHandler) GetReplicaSetsSSE(c *gin.Context) {
	client, err := h.getClientAndConfig(c)
	if err != nil {
		h.logger.WithError(err).Error("Failed to get client for replicasets SSE")
		h.sseHandler.SendSSEError(c, http.StatusBadRequest, err.Error())
		return
	}

	namespace := c.Query("namespace")

	// Function to fetch and transform replicasets data
	fetchReplicaSets := func() (interface{}, error) {
		replicaSetList, err := client.AppsV1().ReplicaSets(namespace).List(c.Request.Context(), metav1.ListOptions{})
		if err != nil {
			return nil, err
		}

		// Transform replicasets to frontend-expected format
		var response []types.ReplicaSetListResponse
		for _, replicaSet := range replicaSetList.Items {
			response = append(response, transformers.TransformReplicaSetToResponse(&replicaSet))
		}

		return response, nil
	}

	// Get initial data
	initialData, err := fetchReplicaSets()
	if err != nil {
		h.logger.WithError(err).Error("Failed to list replicasets for SSE")
		h.sseHandler.SendSSEError(c, http.StatusInternalServerError, err.Error())
		return
	}

	// Check if this is an SSE request (EventSource expects SSE format)
	acceptHeader := c.GetHeader("Accept")
	if acceptHeader == "text/event-stream" {
		// Send SSE response with periodic updates
		h.sseHandler.SendSSEResponseWithUpdates(c, initialData, fetchReplicaSets)
		return
	}

	// For non-SSE requests, return JSON
	c.JSON(http.StatusOK, initialData)
}

// GetReplicaSet returns a specific replicaset
func (h *ReplicaSetsHandler) GetReplicaSet(c *gin.Context) {
	client, err := h.getClientAndConfig(c)
	if err != nil {
		h.logger.WithError(err).Error("Failed to get client for replicaset")
		// For EventSource, send error as SSE
		if c.GetHeader("Accept") == "text/event-stream" {
			h.sseHandler.SendSSEError(c, http.StatusBadRequest, err.Error())
		} else {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		}
		return
	}

	namespace := c.Param("namespace")
	name := c.Param("name")

	replicaSet, err := client.AppsV1().ReplicaSets(namespace).Get(c.Request.Context(), name, metav1.GetOptions{})
	if err != nil {
		h.logger.WithError(err).WithField("replicaset", name).WithField("namespace", namespace).Error("Failed to get replicaset")
		// For EventSource, send error as SSE
		if c.GetHeader("Accept") == "text/event-stream" {
			h.sseHandler.SendSSEError(c, http.StatusNotFound, err.Error())
		} else {
			c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		}
		return
	}

	// Check if this is an SSE request (EventSource expects SSE format)
	acceptHeader := c.GetHeader("Accept")
	if acceptHeader == "text/event-stream" {
		h.sseHandler.SendSSEResponse(c, replicaSet)
		return
	}

	c.JSON(http.StatusOK, replicaSet)
}

// GetReplicaSetByName returns a specific replicaset by name
func (h *ReplicaSetsHandler) GetReplicaSetByName(c *gin.Context) {
	client, err := h.getClientAndConfig(c)
	if err != nil {
		h.logger.WithError(err).Error("Failed to get client for replicaset by name")
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	name := c.Param("name")
	namespace := c.Query("namespace")

	if namespace == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "namespace parameter is required"})
		return
	}

	replicaSet, err := client.AppsV1().ReplicaSets(namespace).Get(c.Request.Context(), name, metav1.GetOptions{})
	if err != nil {
		h.logger.WithError(err).WithField("replicaset", name).WithField("namespace", namespace).Error("Failed to get replicaset by name")
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, replicaSet)
}

// GetReplicaSetYAMLByName returns the YAML representation of a specific replicaset by name
func (h *ReplicaSetsHandler) GetReplicaSetYAMLByName(c *gin.Context) {
	client, err := h.getClientAndConfig(c)
	if err != nil {
		h.logger.WithError(err).Error("Failed to get client for replicaset YAML by name")
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	name := c.Param("name")
	namespace := c.Query("namespace")

	if namespace == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "namespace parameter is required"})
		return
	}

	replicaSet, err := client.AppsV1().ReplicaSets(namespace).Get(c.Request.Context(), name, metav1.GetOptions{})
	if err != nil {
		h.logger.WithError(err).WithField("replicaset", name).WithField("namespace", namespace).Error("Failed to get replicaset for YAML by name")
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	h.yamlHandler.SendYAMLResponse(c, replicaSet, name)
}

// GetReplicaSetYAML returns the YAML representation of a specific replicaset
func (h *ReplicaSetsHandler) GetReplicaSetYAML(c *gin.Context) {
	client, err := h.getClientAndConfig(c)
	if err != nil {
		h.logger.WithError(err).Error("Failed to get client for replicaset YAML")
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	namespace := c.Param("namespace")
	name := c.Param("name")

	replicaSet, err := client.AppsV1().ReplicaSets(namespace).Get(c.Request.Context(), name, metav1.GetOptions{})
	if err != nil {
		h.logger.WithError(err).WithField("replicaset", name).WithField("namespace", namespace).Error("Failed to get replicaset for YAML")
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	h.yamlHandler.SendYAMLResponse(c, replicaSet, name)
}

// GetReplicaSetEventsByName returns events for a specific replicaset by name
func (h *ReplicaSetsHandler) GetReplicaSetEventsByName(c *gin.Context) {
	client, err := h.getClientAndConfig(c)
	if err != nil {
		h.logger.WithError(err).Error("Failed to get client for replicaset events")
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	name := c.Param("name")
	namespace := c.Query("namespace")

	if namespace == "" {
		h.logger.WithField("replicaset", name).Error("Namespace is required for replicaset events lookup")
		c.JSON(http.StatusBadRequest, gin.H{"error": "namespace parameter is required"})
		return
	}

	h.eventsHandler.GetResourceEventsWithNamespace(c, client, "ReplicaSet", name, namespace, h.sseHandler.SendSSEResponse)
}

// GetReplicaSetEvents returns events for a specific replicaset
func (h *ReplicaSetsHandler) GetReplicaSetEvents(c *gin.Context) {
	client, err := h.getClientAndConfig(c)
	if err != nil {
		h.logger.WithError(err).Error("Failed to get client for replicaset events")
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	name := c.Param("name")
	h.eventsHandler.GetResourceEvents(c, client, "ReplicaSet", name, h.sseHandler.SendSSEResponse)
}

// GetReplicaSetPods returns pods for a specific replicaset
func (h *ReplicaSetsHandler) GetReplicaSetPods(c *gin.Context) {
	client, err := h.getClientAndConfig(c)
	if err != nil {
		h.logger.WithError(err).Error("Failed to get client for replicaset pods")
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	namespace := c.Param("namespace")
	name := c.Param("name")

	// Get the replicaset to get its selector
	replicaSet, err := client.AppsV1().ReplicaSets(namespace).Get(c.Request.Context(), name, metav1.GetOptions{})
	if err != nil {
		h.logger.WithError(err).WithField("replicaset", name).WithField("namespace", namespace).Error("Failed to get replicaset for pods")
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	// Create label selector from replicaset selector
	selector := ""
	if replicaSet.Spec.Selector != nil {
		selector = metav1.FormatLabelSelector(replicaSet.Spec.Selector)
	}

	// Get pods with the replicaset selector
	podList, err := client.CoreV1().Pods(namespace).List(c.Request.Context(), metav1.ListOptions{
		LabelSelector: selector,
	})
	if err != nil {
		h.logger.WithError(err).WithField("replicaset", name).WithField("namespace", namespace).Error("Failed to get replicaset pods")
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	// Transform pods to frontend-expected format
	configID := c.Query("config")
	clusterName := c.Query("cluster")
	var response []types.PodListResponse
	for _, pod := range podList.Items {
		response = append(response, transformers.TransformPodToResponse(&pod, configID, clusterName))
	}

	c.JSON(http.StatusOK, response)
}

// GetReplicaSetPodsByName returns pods for a specific replicaset by name
func (h *ReplicaSetsHandler) GetReplicaSetPodsByName(c *gin.Context) {
	client, err := h.getClientAndConfig(c)
	if err != nil {
		h.logger.WithError(err).Error("Failed to get client for replicaset pods by name")
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	name := c.Param("name")
	namespace := c.Query("namespace")

	if namespace == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "namespace parameter is required"})
		return
	}

	// Get the replicaset to get its selector
	replicaSet, err := client.AppsV1().ReplicaSets(namespace).Get(c.Request.Context(), name, metav1.GetOptions{})
	if err != nil {
		h.logger.WithError(err).WithField("replicaset", name).WithField("namespace", namespace).Error("Failed to get replicaset for pods by name")
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	// Create label selector from replicaset selector
	selector := ""
	if replicaSet.Spec.Selector != nil {
		selector = metav1.FormatLabelSelector(replicaSet.Spec.Selector)
	}

	// Get pods with the replicaset selector
	podList, err := client.CoreV1().Pods(namespace).List(c.Request.Context(), metav1.ListOptions{
		LabelSelector: selector,
	})
	if err != nil {
		h.logger.WithError(err).WithField("replicaset", name).WithField("namespace", namespace).Error("Failed to get replicaset pods by name")
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	// Transform pods to frontend-expected format
	configID := c.Query("config")
	clusterName := c.Query("cluster")
	var response []types.PodListResponse
	for _, pod := range podList.Items {
		response = append(response, transformers.TransformPodToResponse(&pod, configID, clusterName))
	}

	c.JSON(http.StatusOK, response)
}
