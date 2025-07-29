package workloads

import (
	"bufio"
	"encoding/json"
	"fmt"
	"net/http"
	"time"

	"kubewall-backend/internal/api/transformers"
	"kubewall-backend/internal/api/types"
	"kubewall-backend/internal/api/utils"
	"kubewall-backend/internal/k8s"
	"kubewall-backend/internal/storage"
	"kubewall-backend/pkg/logger"

	"github.com/gin-gonic/gin"
	v1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/client-go/kubernetes"
)

// PodsHandler handles all pod-related operations
type PodsHandler struct {
	store         *storage.KubeConfigStore
	clientFactory *k8s.ClientFactory
	logger        *logger.Logger
	sseHandler    *utils.SSEHandler
	yamlHandler   *utils.YAMLHandler
	eventsHandler *utils.EventsHandler
}

// NewPodsHandler creates a new pods handler
func NewPodsHandler(store *storage.KubeConfigStore, clientFactory *k8s.ClientFactory, log *logger.Logger) *PodsHandler {
	return &PodsHandler{
		store:         store,
		clientFactory: clientFactory,
		logger:        log,
		sseHandler:    utils.NewSSEHandler(log),
		yamlHandler:   utils.NewYAMLHandler(log),
		eventsHandler: utils.NewEventsHandler(log),
	}
}

// getClientAndConfig gets the Kubernetes client and config for the given config ID and cluster
func (h *PodsHandler) getClientAndConfig(c *gin.Context) (*kubernetes.Clientset, error) {
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

// GetPods returns all pods
func (h *PodsHandler) GetPods(c *gin.Context) {
	client, err := h.getClientAndConfig(c)
	if err != nil {
		h.logger.WithError(err).Error("Failed to get client for pods")
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	namespace := c.Query("namespace")
	var pods interface{}
	var err2 error

	if namespace != "" {
		pods, err2 = client.CoreV1().Pods(namespace).List(c.Request.Context(), metav1.ListOptions{})
	} else {
		pods, err2 = client.CoreV1().Pods("").List(c.Request.Context(), metav1.ListOptions{})
	}

	if err2 != nil {
		h.logger.WithError(err2).Error("Failed to list pods")
		c.JSON(http.StatusInternalServerError, gin.H{"error": err2.Error()})
		return
	}

	c.JSON(http.StatusOK, pods)
}

// GetPodsSSE returns pods as Server-Sent Events with real-time updates
func (h *PodsHandler) GetPodsSSE(c *gin.Context) {
	client, err := h.getClientAndConfig(c)
	if err != nil {
		h.logger.WithError(err).Error("Failed to get client for pods SSE")
		h.sseHandler.SendSSEError(c, http.StatusBadRequest, err.Error())
		return
	}

	namespace := c.Query("namespace")
	node := c.Query("node")
	owner := c.Query("owner")
	ownerName := c.Query("ownerName")
	configID := c.Query("config")
	cluster := c.Query("cluster")

	// Function to fetch and transform pods data
	fetchPods := func() (interface{}, error) {
		// Build list options with filters
		listOptions := metav1.ListOptions{}

		// If filtering by node, use field selector
		if node != "" {
			listOptions.FieldSelector = fmt.Sprintf("spec.nodeName=%s", node)
		}

		// If filtering by owner (deployment, daemonset, etc.), we need to get the owner first
		if owner != "" && ownerName != "" && namespace != "" {
			switch owner {
			case "deployment":
				deployment, err := client.AppsV1().Deployments(namespace).Get(c.Request.Context(), ownerName, metav1.GetOptions{})
				if err == nil {
					listOptions.LabelSelector = metav1.FormatLabelSelector(deployment.Spec.Selector)
				}
			case "daemonset":
				daemonSet, err := client.AppsV1().DaemonSets(namespace).Get(c.Request.Context(), ownerName, metav1.GetOptions{})
				if err == nil {
					listOptions.LabelSelector = metav1.FormatLabelSelector(daemonSet.Spec.Selector)
				}
			case "replicaset":
				replicaSet, err := client.AppsV1().ReplicaSets(namespace).Get(c.Request.Context(), ownerName, metav1.GetOptions{})
				if err == nil {
					listOptions.LabelSelector = metav1.FormatLabelSelector(replicaSet.Spec.Selector)
				}
			}
		}

		var podList *v1.PodList
		var err2 error

		if namespace != "" {
			podList, err2 = client.CoreV1().Pods(namespace).List(c.Request.Context(), listOptions)
		} else {
			podList, err2 = client.CoreV1().Pods("").List(c.Request.Context(), listOptions)
		}

		if err2 != nil {
			return nil, err2
		}

		// Transform pods to the expected format
		var transformedPods []types.PodListResponse
		for _, pod := range podList.Items {
			transformedPods = append(transformedPods, transformers.TransformPodToResponse(&pod, configID, cluster))
		}

		return transformedPods, nil
	}

	// Get initial data
	initialData, err := fetchPods()
	if err != nil {
		h.logger.WithError(err).Error("Failed to list pods for SSE")
		h.sseHandler.SendSSEError(c, http.StatusInternalServerError, err.Error())
		return
	}

	// Check if this is an SSE request (EventSource expects SSE format)
	acceptHeader := c.GetHeader("Accept")
	if acceptHeader == "text/event-stream" {
		// Send SSE response with periodic updates
		h.sseHandler.SendSSEResponseWithUpdates(c, initialData, fetchPods)
		return
	}

	// For non-SSE requests, return JSON
	c.JSON(http.StatusOK, initialData)
}

// GetPodByName returns a specific pod by name using namespace from query parameters
func (h *PodsHandler) GetPodByName(c *gin.Context) {
	client, err := h.getClientAndConfig(c)
	if err != nil {
		h.logger.WithError(err).Error("Failed to get client for pod")
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	name := c.Param("name")
	namespace := c.Query("namespace")

	if namespace == "" {
		h.logger.WithField("pod", name).Error("Namespace is required for pod lookup")
		c.JSON(http.StatusBadRequest, gin.H{"error": "namespace parameter is required"})
		return
	}

	pod, err := client.CoreV1().Pods(namespace).Get(c.Request.Context(), name, metav1.GetOptions{})
	if err != nil {
		h.logger.WithError(err).WithField("pod", name).WithField("namespace", namespace).Error("Failed to get pod")
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	// Always send SSE format for detail endpoints since they're used by EventSource
	h.sseHandler.SendSSEResponse(c, pod)
}

// GetPod returns a specific pod
func (h *PodsHandler) GetPod(c *gin.Context) {
	client, err := h.getClientAndConfig(c)
	if err != nil {
		h.logger.WithError(err).Error("Failed to get client for pod")
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	name := c.Param("name")
	namespace := c.Param("namespace")

	pod, err := client.CoreV1().Pods(namespace).Get(c.Request.Context(), name, metav1.GetOptions{})
	if err != nil {
		h.logger.WithError(err).WithField("pod", name).WithField("namespace", namespace).Error("Failed to get pod")
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	// Always send SSE format for detail endpoints since they're used by EventSource
	h.sseHandler.SendSSEResponse(c, pod)
}

// GetPodYAMLByName returns the YAML representation of a specific pod by name
func (h *PodsHandler) GetPodYAMLByName(c *gin.Context) {
	client, err := h.getClientAndConfig(c)
	if err != nil {
		h.logger.WithError(err).Error("Failed to get client for pod YAML")
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	name := c.Param("name")
	namespace := c.Query("namespace")

	if namespace == "" {
		h.logger.WithField("pod", name).Error("Namespace is required for pod YAML lookup")
		c.JSON(http.StatusBadRequest, gin.H{"error": "namespace parameter is required"})
		return
	}

	pod, err := client.CoreV1().Pods(namespace).Get(c.Request.Context(), name, metav1.GetOptions{})
	if err != nil {
		h.logger.WithError(err).WithField("pod", name).WithField("namespace", namespace).Error("Failed to get pod for YAML")
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	h.yamlHandler.SendYAMLResponse(c, pod, name)
}

// GetPodYAML returns the YAML representation of a specific pod
func (h *PodsHandler) GetPodYAML(c *gin.Context) {
	client, err := h.getClientAndConfig(c)
	if err != nil {
		h.logger.WithError(err).Error("Failed to get client for pod YAML")
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	name := c.Param("name")
	namespace := c.Param("namespace")

	pod, err := client.CoreV1().Pods(namespace).Get(c.Request.Context(), name, metav1.GetOptions{})
	if err != nil {
		h.logger.WithError(err).WithField("pod", name).WithField("namespace", namespace).Error("Failed to get pod for YAML")
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	h.yamlHandler.SendYAMLResponse(c, pod, name)
}

// GetPodEventsByName returns events for a specific pod by name
func (h *PodsHandler) GetPodEventsByName(c *gin.Context) {
	client, err := h.getClientAndConfig(c)
	if err != nil {
		h.logger.WithError(err).Error("Failed to get client for pod events")
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	name := c.Param("name")
	namespace := c.Query("namespace")

	if namespace == "" {
		h.logger.WithField("pod", name).Error("Namespace is required for pod events lookup")
		c.JSON(http.StatusBadRequest, gin.H{"error": "namespace parameter is required"})
		return
	}

	h.eventsHandler.GetResourceEventsWithNamespace(c, client, "Pod", name, namespace, h.sseHandler.SendSSEResponse)
}

// GetPodEvents returns events for a specific pod
func (h *PodsHandler) GetPodEvents(c *gin.Context) {
	client, err := h.getClientAndConfig(c)
	if err != nil {
		h.logger.WithError(err).Error("Failed to get client for pod events")
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	name := c.Param("name")
	h.eventsHandler.GetResourceEvents(c, client, "Pod", name, h.sseHandler.SendSSEResponse)
}

// GetPodLogs returns logs for a specific pod with real-time streaming
func (h *PodsHandler) GetPodLogs(c *gin.Context) {
	client, err := h.getClientAndConfig(c)
	if err != nil {
		h.logger.WithError(err).Error("Failed to get client for pod logs")
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	name := c.Param("name")
	namespace := c.Param("namespace")
	container := c.Query("container")
	allContainers := c.Query("all-containers") == "true"
	tailLines := int64(100) // Default to 100 lines

	// Get the pod to check its containers
	pod, err := client.CoreV1().Pods(namespace).Get(c.Request.Context(), name, metav1.GetOptions{})
	if err != nil {
		h.logger.WithError(err).WithField("pod", name).WithField("namespace", namespace).Error("Failed to get pod for logs")
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	// Set up SSE headers
	c.Header("Content-Type", "text/event-stream")
	c.Header("Cache-Control", "no-cache")
	c.Header("Connection", "keep-alive")
	c.Header("Access-Control-Allow-Origin", "*")
	c.Header("Access-Control-Allow-Headers", "Cache-Control")

	// Function to stream logs for a specific container
	streamContainerLogs := func(containerName string) {
		req := client.CoreV1().Pods(namespace).GetLogs(name, &v1.PodLogOptions{
			Container: containerName,
			Follow:    true,
			TailLines: &tailLines,
		})

		stream, err := req.Stream(c.Request.Context())
		if err != nil {
			h.logger.WithError(err).WithField("container", containerName).Error("Failed to get log stream")
			return
		}
		defer stream.Close()

		scanner := bufio.NewScanner(stream)
		for scanner.Scan() {
			logLine := scanner.Text()

			// Create log response
			logResponse := map[string]interface{}{
				"containerName": containerName,
				"timestamp":     time.Now().Format(time.RFC3339),
				"log":           logLine,
			}

			// Send as SSE
			jsonData, _ := json.Marshal(logResponse)
			c.SSEvent("message", string(jsonData))
			c.Writer.Flush()

			// Check if client disconnected
			if c.Request.Context().Err() != nil {
				break
			}
		}
	}

	// Stream logs for all containers or specific container
	if allContainers {
		for _, container := range pod.Spec.Containers {
			// Send container change marker
			containerChange := map[string]interface{}{
				"containerName":   container.Name,
				"containerChange": true,
			}
			jsonData, _ := json.Marshal(containerChange)
			c.SSEvent("message", string(jsonData))
			c.Writer.Flush()

			streamContainerLogs(container.Name)
		}
	} else if container != "" {
		streamContainerLogs(container)
	} else {
		// Default to first container
		if len(pod.Spec.Containers) > 0 {
			streamContainerLogs(pod.Spec.Containers[0].Name)
		}
	}
}

// GetPodLogsByName returns logs for a specific pod by name using namespace from query parameters
func (h *PodsHandler) GetPodLogsByName(c *gin.Context) {
	name := c.Param("name")
	namespace := c.Query("namespace")

	if namespace == "" {
		h.logger.WithField("pod", name).Error("Namespace is required for pod logs lookup")
		c.JSON(http.StatusBadRequest, gin.H{"error": "namespace parameter is required"})
		return
	}

	// Set the namespace in the context for the main handler
	c.Params = append(c.Params, gin.Param{Key: "namespace", Value: namespace})
	h.GetPodLogs(c)
}

// GetPodExec handles WebSocket-based pod exec
func (h *PodsHandler) GetPodExec(c *gin.Context) {
	// This will be handled by the WebSocket upgrade handler
	// The actual implementation is in the WebSocket handler
	c.JSON(http.StatusOK, gin.H{"message": "WebSocket upgrade required for pod exec"})
}

// GetPodExecByName handles WebSocket-based pod exec by name
func (h *PodsHandler) GetPodExecByName(c *gin.Context) {
	// This will be handled by the WebSocket upgrade handler
	// The actual implementation is in the WebSocket handler
	c.JSON(http.StatusOK, gin.H{"message": "WebSocket upgrade required for pod exec"})
}
