package api

import (
	"encoding/base64"
	"encoding/json"
	"fmt"
	"net/http"
	"time"

	"kubewall-backend/internal/k8s"
	"kubewall-backend/internal/storage"
	"kubewall-backend/pkg/logger"

	"github.com/gin-gonic/gin"
	"gopkg.in/yaml.v3"
	appsV1 "k8s.io/api/apps/v1"
	v2 "k8s.io/api/autoscaling/v2"
	batchV1 "k8s.io/api/batch/v1"
	coordinationv1 "k8s.io/api/coordination/v1"
	v1 "k8s.io/api/core/v1"
	networkingv1 "k8s.io/api/networking/v1"
	nodev1 "k8s.io/api/node/v1"
	policyv1 "k8s.io/api/policy/v1"
	rbacv1 "k8s.io/api/rbac/v1"
	schedulingv1 "k8s.io/api/scheduling/v1"
	storagev1 "k8s.io/api/storage/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/client-go/dynamic"
	"k8s.io/client-go/kubernetes"
	"k8s.io/client-go/tools/clientcmd"
	"k8s.io/client-go/tools/clientcmd/api"
)

// NodeListResponse represents the response format expected by the frontend
type NodeListResponse struct {
	Age             string   `json:"age"`
	HasUpdated      bool     `json:"hasUpdated"`
	Name            string   `json:"name"`
	ResourceVersion string   `json:"resourceVersion"`
	Roles           []string `json:"roles"`
	Spec            struct {
		PodCIDR    string   `json:"podCIDR"`
		PodCIDRs   []string `json:"podCIDRs"`
		ProviderID string   `json:"providerID"`
	} `json:"spec"`
	Status struct {
		Addresses struct {
			InternalIP string `json:"internalIP"`
		} `json:"addresses"`
		ConditionStatus string `json:"conditionStatus"`
		NodeInfo        struct {
			Architecture            string `json:"architecture"`
			BootID                  string `json:"bootID"`
			ContainerRuntimeVersion string `json:"containerRuntimeVersion"`
			KernelVersion           string `json:"kernelVersion"`
			KubeProxyVersion        string `json:"kubeProxyVersion"`
			KubeletVersion          string `json:"kubeletVersion"`
			MachineID               string `json:"machineID"`
			OperatingSystem         string `json:"operatingSystem"`
			OSImage                 string `json:"osImage"`
			SystemUUID              string `json:"systemUUID"`
		} `json:"nodeInfo"`
	} `json:"status"`
	UID string `json:"uid"`
}

// PodListResponse represents the response format expected by the frontend for pods
type PodListResponse struct {
	Age               string `json:"age"`
	HasUpdated        bool   `json:"hasUpdated"`
	Name              string `json:"name"`
	Namespace         string `json:"namespace"`
	Node              string `json:"node"`
	Ready             string `json:"ready"`
	Status            string `json:"status"`
	CPU               string `json:"cpu"`
	Memory            string `json:"memory"`
	Restarts          string `json:"restarts"`
	LastRestartAt     string `json:"lastRestartAt"`
	LastRestartReason string `json:"lastRestartReason"`
	PodIP             string `json:"podIP"`
	QOS               string `json:"qos"`
	UID               string `json:"uid"`
}

// ResourcesHandler handles Kubernetes resource-related API requests
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

// sendSSEResponse sends a Server-Sent Events response
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

	c.SSEvent("message", string(jsonData))
	c.Writer.Flush()

	// Set up periodic updates (every 30 seconds)
	ticker := time.NewTicker(30 * time.Second)
	defer ticker.Stop()

	// Keep connection alive with periodic updates
	for {
		select {
		case <-c.Request.Context().Done():
			return
		case <-ticker.C:
			// Send a keep-alive comment
			c.SSEvent("", "")
			c.Writer.Flush()
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

// GetNamespaces returns all namespaces
func (h *ResourcesHandler) GetNamespaces(c *gin.Context) {
	client, _, err := h.getClientAndConfig(c)
	if err != nil {
		h.logger.WithError(err).Error("Failed to get client for namespaces")
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	namespaces, err := client.CoreV1().Namespaces().List(c.Request.Context(), metav1.ListOptions{})
	if err != nil {
		h.logger.WithError(err).Error("Failed to list namespaces")
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, namespaces)
}

// GetNamespacesSSE returns namespaces as Server-Sent Events
func (h *ResourcesHandler) GetNamespacesSSE(c *gin.Context) {
	client, _, err := h.getClientAndConfig(c)
	if err != nil {
		h.logger.WithError(err).Error("Failed to get client for namespaces SSE")
		h.sendSSEError(c, http.StatusBadRequest, err.Error())
		return
	}

	namespaceList, err := client.CoreV1().Namespaces().List(c.Request.Context(), metav1.ListOptions{})
	if err != nil {
		h.logger.WithError(err).Error("Failed to list namespaces for SSE")
		h.sendSSEError(c, http.StatusInternalServerError, err.Error())
		return
	}

	h.sendSSEResponse(c, namespaceList.Items)
}

// GetNamespace returns a specific namespace
func (h *ResourcesHandler) GetNamespace(c *gin.Context) {
	client, _, err := h.getClientAndConfig(c)
	if err != nil {
		h.logger.WithError(err).Error("Failed to get client for namespace")
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	name := c.Param("name")
	namespace, err := client.CoreV1().Namespaces().Get(c.Request.Context(), name, metav1.GetOptions{})
	if err != nil {
		h.logger.WithError(err).WithField("namespace", name).Error("Failed to get namespace")
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	// Check if this is an SSE request (EventSource expects SSE format)
	acceptHeader := c.GetHeader("Accept")
	if acceptHeader == "text/event-stream" {
		h.sendSSEResponse(c, namespace)
		return
	}

	c.JSON(http.StatusOK, namespace)
}

// GetNamespaceYAML returns the YAML representation of a specific namespace
func (h *ResourcesHandler) GetNamespaceYAML(c *gin.Context) {
	client, _, err := h.getClientAndConfig(c)
	if err != nil {
		h.logger.WithError(err).Error("Failed to get client for namespace YAML")
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	name := c.Param("name")
	namespace, err := client.CoreV1().Namespaces().Get(c.Request.Context(), name, metav1.GetOptions{})
	if err != nil {
		h.logger.WithError(err).WithField("namespace", name).Error("Failed to get namespace for YAML")
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	// Convert to YAML
	yamlData, err := yaml.Marshal(namespace)
	if err != nil {
		h.logger.WithError(err).Error("Failed to marshal namespace to YAML")
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to convert to YAML"})
		return
	}

	// Check if this is an SSE request (EventSource expects SSE format)
	acceptHeader := c.GetHeader("Accept")
	if acceptHeader == "text/event-stream" {
		// For EventSource, send the YAML data as base64 encoded string
		encodedYAML := base64.StdEncoding.EncodeToString(yamlData)
		h.sendSSEResponse(c, gin.H{"data": encodedYAML})
		return
	}

	// Return as base64 encoded string to match frontend expectations
	encodedYAML := base64.StdEncoding.EncodeToString(yamlData)
	c.JSON(http.StatusOK, gin.H{"data": encodedYAML})
}

// GetNamespaceEvents returns events for a specific namespace
func (h *ResourcesHandler) GetNamespaceEvents(c *gin.Context) {
	name := c.Param("name")
	h.getResourceEvents(c, "Namespace", name)
}

// transformNodeToResponse transforms a Kubernetes node to the frontend-expected format
func (h *ResourcesHandler) transformNodeToResponse(node *v1.Node) NodeListResponse {
	// Send creation timestamp instead of calculated age
	age := ""
	if node.CreationTimestamp.Time != (time.Time{}) {
		age = node.CreationTimestamp.Time.Format(time.RFC3339)
	}

	// Extract roles from labels
	var roles []string
	if node.Labels != nil {
		if _, hasRole := node.Labels["node-role.kubernetes.io/control-plane"]; hasRole {
			roles = append(roles, "control-plane")
		}
		if _, hasRole := node.Labels["node-role.kubernetes.io/master"]; hasRole {
			roles = append(roles, "master")
		}
		if _, hasRole := node.Labels["node-role.kubernetes.io/worker"]; hasRole {
			roles = append(roles, "worker")
		}
	}
	if len(roles) == 0 {
		roles = append(roles, "worker") // Default role
	}

	// Extract internal IP from addresses
	internalIP := ""
	if node.Status.Addresses != nil {
		for _, addr := range node.Status.Addresses {
			if addr.Type == v1.NodeInternalIP {
				internalIP = addr.Address
				break
			}
		}
	}

	// Determine condition status
	conditionStatus := "Unknown"
	if node.Status.Conditions != nil {
		for _, condition := range node.Status.Conditions {
			if condition.Type == v1.NodeReady {
				conditionStatus = string(condition.Status)
				break
			}
		}
	}

	// Extract node info
	nodeInfo := node.Status.NodeInfo

	response := NodeListResponse{
		Age:             age,
		HasUpdated:      false, // This would need to be tracked separately
		Name:            node.Name,
		ResourceVersion: node.ResourceVersion,
		Roles:           roles,
		UID:             string(node.UID),
	}

	// Set spec fields
	if node.Spec.PodCIDR != "" {
		response.Spec.PodCIDR = node.Spec.PodCIDR
	}
	if node.Spec.PodCIDRs != nil {
		response.Spec.PodCIDRs = node.Spec.PodCIDRs
	}
	if node.Spec.ProviderID != "" {
		response.Spec.ProviderID = node.Spec.ProviderID
	}

	// Set status fields
	response.Status.Addresses.InternalIP = internalIP
	response.Status.ConditionStatus = conditionStatus
	response.Status.NodeInfo.Architecture = nodeInfo.Architecture
	response.Status.NodeInfo.BootID = nodeInfo.BootID
	response.Status.NodeInfo.ContainerRuntimeVersion = nodeInfo.ContainerRuntimeVersion
	response.Status.NodeInfo.KernelVersion = nodeInfo.KernelVersion
	response.Status.NodeInfo.KubeProxyVersion = nodeInfo.KubeProxyVersion
	response.Status.NodeInfo.KubeletVersion = nodeInfo.KubeletVersion
	response.Status.NodeInfo.MachineID = nodeInfo.MachineID
	response.Status.NodeInfo.OperatingSystem = nodeInfo.OperatingSystem
	response.Status.NodeInfo.OSImage = nodeInfo.OSImage
	response.Status.NodeInfo.SystemUUID = nodeInfo.SystemUUID

	return response
}

// transformPodToResponse transforms a Kubernetes Pod to the response format expected by the frontend
func (h *ResourcesHandler) transformPodToResponse(pod *v1.Pod) PodListResponse {
	// Send creation timestamp instead of calculated age
	age := ""
	if pod.CreationTimestamp.Time != (time.Time{}) {
		age = pod.CreationTimestamp.Time.Format(time.RFC3339)
	}

	// Calculate ready status
	ready := "0/0"
	if pod.Status.ContainerStatuses != nil {
		readyCount := 0
		totalCount := len(pod.Status.ContainerStatuses)
		for _, containerStatus := range pod.Status.ContainerStatuses {
			if containerStatus.Ready {
				readyCount++
			}
		}
		ready = fmt.Sprintf("%d/%d", readyCount, totalCount)
	}

	// Get pod status
	status := string(pod.Status.Phase)

	// Calculate total restarts
	restarts := int32(0)
	lastRestartAt := ""
	lastRestartReason := ""
	if pod.Status.ContainerStatuses != nil {
		for _, containerStatus := range pod.Status.ContainerStatuses {
			restarts += containerStatus.RestartCount
			if containerStatus.LastTerminationState.Terminated != nil {
				if containerStatus.LastTerminationState.Terminated.StartedAt.Time.After(time.Time{}) {
					if lastRestartAt == "" || containerStatus.LastTerminationState.Terminated.StartedAt.Time.After(time.Time{}) {
						lastRestartAt = containerStatus.LastTerminationState.Terminated.StartedAt.Time.Format(time.RFC3339)
						lastRestartReason = containerStatus.LastTerminationState.Terminated.Reason
					}
				}
			}
		}
	}

	// Calculate CPU and Memory (this would need metrics server integration for real values)
	cpu := "0"
	memory := "0"

	// Get pod IP
	podIP := ""
	if pod.Status.PodIP != "" {
		podIP = pod.Status.PodIP
	}

	// Get QOS class
	qos := ""
	if pod.Status.QOSClass != "" {
		qos = string(pod.Status.QOSClass)
	}

	response := PodListResponse{
		Age:               age,
		HasUpdated:        false, // This would need to be tracked separately
		Name:              pod.Name,
		Namespace:         pod.Namespace,
		Node:              pod.Spec.NodeName,
		Ready:             ready,
		Status:            status,
		CPU:               cpu,
		Memory:            memory,
		Restarts:          fmt.Sprintf("%d", restarts),
		LastRestartAt:     lastRestartAt,
		LastRestartReason: lastRestartReason,
		PodIP:             podIP,
		QOS:               qos,
		UID:               string(pod.UID),
	}

	return response
}

// GetNodes returns all nodes
func (h *ResourcesHandler) GetNodes(c *gin.Context) {
	client, _, err := h.getClientAndConfig(c)
	if err != nil {
		h.logger.WithError(err).Error("Failed to get client for nodes")
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	nodes, err := client.CoreV1().Nodes().List(c.Request.Context(), metav1.ListOptions{})
	if err != nil {
		h.logger.WithError(err).Error("Failed to list nodes")
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	// Transform nodes to frontend-expected format
	var response []NodeListResponse
	for _, node := range nodes.Items {
		response = append(response, h.transformNodeToResponse(&node))
	}

	c.JSON(http.StatusOK, response)
}

// GetNodesSSE returns nodes as Server-Sent Events
func (h *ResourcesHandler) GetNodesSSE(c *gin.Context) {
	client, _, err := h.getClientAndConfig(c)
	if err != nil {
		h.logger.WithError(err).Error("Failed to get client for nodes SSE")
		h.sendSSEError(c, http.StatusBadRequest, err.Error())
		return
	}

	nodeList, err := client.CoreV1().Nodes().List(c.Request.Context(), metav1.ListOptions{})
	if err != nil {
		h.logger.WithError(err).Error("Failed to list nodes for SSE")
		h.sendSSEError(c, http.StatusInternalServerError, err.Error())
		return
	}

	// Transform nodes to frontend-expected format
	var response []NodeListResponse
	for _, node := range nodeList.Items {
		response = append(response, h.transformNodeToResponse(&node))
	}

	h.sendSSEResponse(c, response)
}

// GetNode returns a specific node
func (h *ResourcesHandler) GetNode(c *gin.Context) {
	client, _, err := h.getClientAndConfig(c)
	if err != nil {
		h.logger.WithError(err).Error("Failed to get client for node")
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	name := c.Param("name")
	node, err := client.CoreV1().Nodes().Get(c.Request.Context(), name, metav1.GetOptions{})
	if err != nil {
		h.logger.WithError(err).WithField("node", name).Error("Failed to get node")
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	// Check if this is an SSE request (EventSource expects SSE format)
	acceptHeader := c.GetHeader("Accept")
	if acceptHeader == "text/event-stream" {
		h.sendSSEResponse(c, node)
		return
	}

	c.JSON(http.StatusOK, node)
}

// GetNodeYAML returns the YAML representation of a specific node
func (h *ResourcesHandler) GetNodeYAML(c *gin.Context) {
	client, _, err := h.getClientAndConfig(c)
	if err != nil {
		h.logger.WithError(err).Error("Failed to get client for node YAML")
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	name := c.Param("name")
	node, err := client.CoreV1().Nodes().Get(c.Request.Context(), name, metav1.GetOptions{})
	if err != nil {
		h.logger.WithError(err).WithField("node", name).Error("Failed to get node for YAML")
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	// Convert to YAML
	yamlData, err := yaml.Marshal(node)
	if err != nil {
		h.logger.WithError(err).Error("Failed to marshal node to YAML")
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to convert to YAML"})
		return
	}

	// Check if this is an SSE request (EventSource expects SSE format)
	acceptHeader := c.GetHeader("Accept")
	h.logger.WithField("acceptHeader", acceptHeader).Info("Accept header received")
	if acceptHeader == "text/event-stream" {
		h.logger.Info("Sending SSE response for EventSource")
		// For EventSource, send the YAML data as base64 encoded string
		encodedYAML := base64.StdEncoding.EncodeToString(yamlData)
		h.sendSSEResponse(c, gin.H{"data": encodedYAML})
		return
	}

	// Return as base64 encoded string to match frontend expectations
	encodedYAML := base64.StdEncoding.EncodeToString(yamlData)
	c.JSON(http.StatusOK, gin.H{"data": encodedYAML})
}

// GetNodeEvents returns events for a specific node
func (h *ResourcesHandler) GetNodeEvents(c *gin.Context) {
	name := c.Param("name")
	h.getResourceEvents(c, "Node", name)
}

// GetPods returns all pods in a namespace (or all namespaces if namespace is not specified)
func (h *ResourcesHandler) GetPods(c *gin.Context) {
	client, _, err := h.getClientAndConfig(c)
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

// GetPodsSSE returns pods as Server-Sent Events
func (h *ResourcesHandler) GetPodsSSE(c *gin.Context) {
	client, _, err := h.getClientAndConfig(c)
	if err != nil {
		h.logger.WithError(err).Error("Failed to get client for pods SSE")
		h.sendSSEError(c, http.StatusBadRequest, err.Error())
		return
	}

	namespace := c.Query("namespace")
	var podList *v1.PodList
	var err2 error

	if namespace != "" {
		podList, err2 = client.CoreV1().Pods(namespace).List(c.Request.Context(), metav1.ListOptions{})
	} else {
		podList, err2 = client.CoreV1().Pods("").List(c.Request.Context(), metav1.ListOptions{})
	}

	if err2 != nil {
		h.logger.WithError(err2).Error("Failed to list pods for SSE")
		h.sendSSEError(c, http.StatusInternalServerError, err2.Error())
		return
	}

	// Transform pods to the expected format
	var transformedPods []PodListResponse
	for _, pod := range podList.Items {
		transformedPods = append(transformedPods, h.transformPodToResponse(&pod))
	}

	h.sendSSEResponse(c, transformedPods)
}

// GetPod returns a specific pod
func (h *ResourcesHandler) GetPod(c *gin.Context) {
	client, _, err := h.getClientAndConfig(c)
	if err != nil {
		h.logger.WithError(err).Error("Failed to get client for pod")
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	namespace := c.Param("namespace")
	name := c.Param("name")
	pod, err := client.CoreV1().Pods(namespace).Get(c.Request.Context(), name, metav1.GetOptions{})
	if err != nil {
		h.logger.WithError(err).WithField("pod", name).WithField("namespace", namespace).Error("Failed to get pod")
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	// Check if this is an SSE request (EventSource expects SSE format)
	acceptHeader := c.GetHeader("Accept")
	if acceptHeader == "text/event-stream" {
		h.sendSSEResponse(c, pod)
		return
	}

	c.JSON(http.StatusOK, pod)
}

// GetDeployments returns all deployments in a namespace
func (h *ResourcesHandler) GetDeployments(c *gin.Context) {
	client, _, err := h.getClientAndConfig(c)
	if err != nil {
		h.logger.WithError(err).Error("Failed to get client for deployments")
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	namespace := c.Query("namespace")
	deployments, err := client.AppsV1().Deployments(namespace).List(c.Request.Context(), metav1.ListOptions{})
	if err != nil {
		h.logger.WithError(err).Error("Failed to list deployments")
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, deployments)
}

// GetDeploymentsSSE returns deployments as Server-Sent Events
func (h *ResourcesHandler) GetDeploymentsSSE(c *gin.Context) {
	client, _, err := h.getClientAndConfig(c)
	if err != nil {
		h.logger.WithError(err).Error("Failed to get client for deployments SSE")
		h.sendSSEError(c, http.StatusBadRequest, err.Error())
		return
	}

	namespace := c.Query("namespace")
	deploymentList, err := client.AppsV1().Deployments(namespace).List(c.Request.Context(), metav1.ListOptions{})
	if err != nil {
		h.logger.WithError(err).Error("Failed to list deployments for SSE")
		h.sendSSEError(c, http.StatusInternalServerError, err.Error())
		return
	}

	h.sendSSEResponse(c, deploymentList.Items)
}

// GetDeployment returns a specific deployment
func (h *ResourcesHandler) GetDeployment(c *gin.Context) {
	client, _, err := h.getClientAndConfig(c)
	if err != nil {
		h.logger.WithError(err).Error("Failed to get client for deployment")
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	namespace := c.Param("namespace")
	name := c.Param("name")
	deployment, err := client.AppsV1().Deployments(namespace).Get(c.Request.Context(), name, metav1.GetOptions{})
	if err != nil {
		h.logger.WithError(err).WithField("deployment", name).WithField("namespace", namespace).Error("Failed to get deployment")
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	// Check if this is an SSE request (EventSource expects SSE format)
	acceptHeader := c.GetHeader("Accept")
	if acceptHeader == "text/event-stream" {
		h.sendSSEResponse(c, deployment)
		return
	}

	c.JSON(http.StatusOK, deployment)
}

// GetServices returns all services in a namespace
func (h *ResourcesHandler) GetServices(c *gin.Context) {
	client, _, err := h.getClientAndConfig(c)
	if err != nil {
		h.logger.WithError(err).Error("Failed to get client for services")
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	namespace := c.Query("namespace")
	services, err := client.CoreV1().Services(namespace).List(c.Request.Context(), metav1.ListOptions{})
	if err != nil {
		h.logger.WithError(err).Error("Failed to list services")
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, services)
}

// GetServicesSSE returns services as Server-Sent Events
func (h *ResourcesHandler) GetServicesSSE(c *gin.Context) {
	client, _, err := h.getClientAndConfig(c)
	if err != nil {
		h.logger.WithError(err).Error("Failed to get client for services SSE")
		h.sendSSEError(c, http.StatusBadRequest, err.Error())
		return
	}

	namespace := c.Query("namespace")
	serviceList, err := client.CoreV1().Services(namespace).List(c.Request.Context(), metav1.ListOptions{})
	if err != nil {
		h.logger.WithError(err).Error("Failed to list services for SSE")
		h.sendSSEError(c, http.StatusInternalServerError, err.Error())
		return
	}

	h.sendSSEResponse(c, serviceList.Items)
}

// GetService returns a specific service
func (h *ResourcesHandler) GetService(c *gin.Context) {
	client, _, err := h.getClientAndConfig(c)
	if err != nil {
		h.logger.WithError(err).Error("Failed to get client for service")
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	namespace := c.Param("namespace")
	name := c.Param("name")
	service, err := client.CoreV1().Services(namespace).Get(c.Request.Context(), name, metav1.GetOptions{})
	if err != nil {
		h.logger.WithError(err).WithField("service", name).WithField("namespace", namespace).Error("Failed to get service")
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	// Check if this is an SSE request (EventSource expects SSE format)
	acceptHeader := c.GetHeader("Accept")
	if acceptHeader == "text/event-stream" {
		h.sendSSEResponse(c, service)
		return
	}

	c.JSON(http.StatusOK, service)
}

// GetConfigMaps returns all configmaps in a namespace
func (h *ResourcesHandler) GetConfigMaps(c *gin.Context) {
	client, _, err := h.getClientAndConfig(c)
	if err != nil {
		h.logger.WithError(err).Error("Failed to get client for configmaps")
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	namespace := c.Query("namespace")
	configMaps, err := client.CoreV1().ConfigMaps(namespace).List(c.Request.Context(), metav1.ListOptions{})
	if err != nil {
		h.logger.WithError(err).Error("Failed to list configmaps")
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, configMaps)
}

// GetConfigMapsSSE returns configmaps as Server-Sent Events
func (h *ResourcesHandler) GetConfigMapsSSE(c *gin.Context) {
	client, _, err := h.getClientAndConfig(c)
	if err != nil {
		h.logger.WithError(err).Error("Failed to get client for configmaps SSE")
		h.sendSSEError(c, http.StatusBadRequest, err.Error())
		return
	}

	namespace := c.Query("namespace")
	configMapList, err := client.CoreV1().ConfigMaps(namespace).List(c.Request.Context(), metav1.ListOptions{})
	if err != nil {
		h.logger.WithError(err).Error("Failed to list configmaps for SSE")
		h.sendSSEError(c, http.StatusInternalServerError, err.Error())
		return
	}

	h.sendSSEResponse(c, configMapList.Items)
}

// GetConfigMap returns a specific configmap
func (h *ResourcesHandler) GetConfigMap(c *gin.Context) {
	client, _, err := h.getClientAndConfig(c)
	if err != nil {
		h.logger.WithError(err).Error("Failed to get client for configmap")
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	namespace := c.Param("namespace")
	name := c.Param("name")
	configMap, err := client.CoreV1().ConfigMaps(namespace).Get(c.Request.Context(), name, metav1.GetOptions{})
	if err != nil {
		h.logger.WithError(err).WithField("configmap", name).WithField("namespace", namespace).Error("Failed to get configmap")
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	// Check if this is an SSE request (EventSource expects SSE format)
	acceptHeader := c.GetHeader("Accept")
	if acceptHeader == "text/event-stream" {
		h.sendSSEResponse(c, configMap)
		return
	}

	c.JSON(http.StatusOK, configMap)
}

// GetSecrets returns all secrets in a namespace
func (h *ResourcesHandler) GetSecrets(c *gin.Context) {
	client, _, err := h.getClientAndConfig(c)
	if err != nil {
		h.logger.WithError(err).Error("Failed to get client for secrets")
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	namespace := c.Query("namespace")
	secrets, err := client.CoreV1().Secrets(namespace).List(c.Request.Context(), metav1.ListOptions{})
	if err != nil {
		h.logger.WithError(err).Error("Failed to list secrets")
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, secrets)
}

// GetSecretsSSE returns secrets as Server-Sent Events
func (h *ResourcesHandler) GetSecretsSSE(c *gin.Context) {
	client, _, err := h.getClientAndConfig(c)
	if err != nil {
		h.logger.WithError(err).Error("Failed to get client for secrets SSE")
		h.sendSSEError(c, http.StatusBadRequest, err.Error())
		return
	}

	namespace := c.Query("namespace")
	secretList, err := client.CoreV1().Secrets(namespace).List(c.Request.Context(), metav1.ListOptions{})
	if err != nil {
		h.logger.WithError(err).Error("Failed to list secrets for SSE")
		h.sendSSEError(c, http.StatusInternalServerError, err.Error())
		return
	}

	h.sendSSEResponse(c, secretList.Items)
}

// GetSecret returns a specific secret
func (h *ResourcesHandler) GetSecret(c *gin.Context) {
	client, _, err := h.getClientAndConfig(c)
	if err != nil {
		h.logger.WithError(err).Error("Failed to get client for secret")
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	namespace := c.Param("namespace")
	name := c.Param("name")
	secret, err := client.CoreV1().Secrets(namespace).Get(c.Request.Context(), name, metav1.GetOptions{})
	if err != nil {
		h.logger.WithError(err).WithField("secret", name).WithField("namespace", namespace).Error("Failed to get secret")
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	// Check if this is an SSE request (EventSource expects SSE format)
	acceptHeader := c.GetHeader("Accept")
	if acceptHeader == "text/event-stream" {
		h.sendSSEResponse(c, secret)
		return
	}

	c.JSON(http.StatusOK, secret)
}

// GetCustomResourceDefinitions returns all CRDs
func (h *ResourcesHandler) GetCustomResourceDefinitions(c *gin.Context) {
	dynamicClient, err := h.getDynamicClient(c)
	if err != nil {
		h.logger.WithError(err).Error("Failed to get dynamic client for CRDs")
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// CRDs are in the apiextensions.k8s.io/v1 API group
	gvr := schema.GroupVersionResource{
		Group:    "apiextensions.k8s.io",
		Version:  "v1",
		Resource: "customresourcedefinitions",
	}

	crdList, err := dynamicClient.Resource(gvr).List(c.Request.Context(), metav1.ListOptions{})
	if err != nil {
		h.logger.WithError(err).Error("Failed to list custom resource definitions")
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, crdList)
}

// GetCustomResourceDefinitionsSSE returns CRDs as Server-Sent Events
func (h *ResourcesHandler) GetCustomResourceDefinitionsSSE(c *gin.Context) {
	dynamicClient, err := h.getDynamicClient(c)
	if err != nil {
		h.logger.WithError(err).Error("Failed to get dynamic client for CRDs SSE")
		h.sendSSEError(c, http.StatusBadRequest, err.Error())
		return
	}

	// CRDs are in the apiextensions.k8s.io/v1 API group
	gvr := schema.GroupVersionResource{
		Group:    "apiextensions.k8s.io",
		Version:  "v1",
		Resource: "customresourcedefinitions",
	}

	crdList, err := dynamicClient.Resource(gvr).List(c.Request.Context(), metav1.ListOptions{})
	if err != nil {
		h.logger.WithError(err).Error("Failed to list custom resource definitions for SSE")
		h.sendSSEError(c, http.StatusInternalServerError, err.Error())
		return
	}

	items, _ := crdList.UnstructuredContent()["items"].([]interface{})
	h.sendSSEResponse(c, items)
}

// GetCustomResourceDefinition returns a specific CRD
func (h *ResourcesHandler) GetCustomResourceDefinition(c *gin.Context) {
	dynamicClient, err := h.getDynamicClient(c)
	if err != nil {
		h.logger.WithError(err).Error("Failed to get dynamic client for CRD")
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	name := c.Param("name")
	gvr := schema.GroupVersionResource{
		Group:    "apiextensions.k8s.io",
		Version:  "v1",
		Resource: "customresourcedefinitions",
	}

	crd, err := dynamicClient.Resource(gvr).Get(c.Request.Context(), name, metav1.GetOptions{})
	if err != nil {
		h.logger.WithError(err).WithField("crd", name).Error("Failed to get custom resource definition")
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	// Check if this is an SSE request (EventSource expects SSE format)
	acceptHeader := c.GetHeader("Accept")
	if acceptHeader == "text/event-stream" {
		h.sendSSEResponse(c, crd)
		return
	}

	c.JSON(http.StatusOK, crd)
}

// GetCustomResources returns custom resources for a specific CRD
func (h *ResourcesHandler) GetCustomResources(c *gin.Context) {
	dynamicClient, err := h.getDynamicClient(c)
	if err != nil {
		h.logger.WithError(err).Error("Failed to get dynamic client for custom resources")
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	group := c.Query("group")
	version := c.Query("version")
	resource := c.Query("resource")
	namespace := c.Query("namespace")

	if group == "" || version == "" || resource == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "group, version, and resource parameters are required"})
		return
	}

	gvr := schema.GroupVersionResource{
		Group:    group,
		Version:  version,
		Resource: resource,
	}

	var crList interface{}
	var err2 error

	if namespace != "" {
		crList, err2 = dynamicClient.Resource(gvr).Namespace(namespace).List(c.Request.Context(), metav1.ListOptions{})
	} else {
		crList, err2 = dynamicClient.Resource(gvr).List(c.Request.Context(), metav1.ListOptions{})
	}

	if err2 != nil {
		h.logger.WithError(err2).Error("Failed to list custom resources")
		c.JSON(http.StatusInternalServerError, gin.H{"error": err2.Error()})
		return
	}

	c.JSON(http.StatusOK, crList)
}

// GetCustomResourcesSSE returns custom resources as Server-Sent Events
func (h *ResourcesHandler) GetCustomResourcesSSE(c *gin.Context) {
	dynamicClient, err := h.getDynamicClient(c)
	if err != nil {
		h.logger.WithError(err).Error("Failed to get dynamic client for custom resources SSE")
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	group := c.Query("group")
	version := c.Query("version")
	resource := c.Query("resource")
	namespace := c.Query("namespace")

	if group == "" || version == "" || resource == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "group, version, and resource parameters are required"})
		return
	}

	gvr := schema.GroupVersionResource{
		Group:    group,
		Version:  version,
		Resource: resource,
	}

	var crList interface{}
	var err2 error

	if namespace != "" {
		crList, err2 = dynamicClient.Resource(gvr).Namespace(namespace).List(c.Request.Context(), metav1.ListOptions{})
	} else {
		crList, err2 = dynamicClient.Resource(gvr).List(c.Request.Context(), metav1.ListOptions{})
	}

	if err2 != nil {
		h.logger.WithError(err2).Error("Failed to list custom resources for SSE")
		c.JSON(http.StatusInternalServerError, gin.H{"error": err2.Error()})
		return
	}

	h.sendSSEResponse(c, crList)
}

// GetCustomResource returns a specific custom resource
func (h *ResourcesHandler) GetCustomResource(c *gin.Context) {
	dynamicClient, err := h.getDynamicClient(c)
	if err != nil {
		h.logger.WithError(err).Error("Failed to get dynamic client for custom resource")
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	group := c.Query("group")
	version := c.Query("version")
	resource := c.Query("resource")
	namespace := c.Param("namespace")
	name := c.Param("name")

	if group == "" || version == "" || resource == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "group, version, and resource parameters are required"})
		return
	}

	gvr := schema.GroupVersionResource{
		Group:    group,
		Version:  version,
		Resource: resource,
	}

	var cr interface{}
	var err2 error

	if namespace != "" {
		cr, err2 = dynamicClient.Resource(gvr).Namespace(namespace).Get(c.Request.Context(), name, metav1.GetOptions{})
	} else {
		cr, err2 = dynamicClient.Resource(gvr).Get(c.Request.Context(), name, metav1.GetOptions{})
	}

	if err2 != nil {
		h.logger.WithError(err2).WithField("custom_resource", name).Error("Failed to get custom resource")
		c.JSON(http.StatusNotFound, gin.H{"error": err2.Error()})
		return
	}

	// Check if this is an SSE request (EventSource expects SSE format)
	acceptHeader := c.GetHeader("Accept")
	if acceptHeader == "text/event-stream" {
		h.sendSSEResponse(c, cr)
		return
	}

	c.JSON(http.StatusOK, cr)
}

// Generic resource handler for other Kubernetes resources
func (h *ResourcesHandler) GetGenericResource(c *gin.Context) {
	client, _, err := h.getClientAndConfig(c)
	if err != nil {
		h.logger.WithError(err).Error("Failed to get client for generic resource")
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	resourceType := c.Param("resource")
	namespace := c.Query("namespace")

	var result interface{}
	var err2 error

	switch resourceType {
	case "daemonsets":
		result, err2 = client.AppsV1().DaemonSets(namespace).List(c.Request.Context(), metav1.ListOptions{})
	case "statefulsets":
		result, err2 = client.AppsV1().StatefulSets(namespace).List(c.Request.Context(), metav1.ListOptions{})
	case "replicasets":
		result, err2 = client.AppsV1().ReplicaSets(namespace).List(c.Request.Context(), metav1.ListOptions{})
	case "jobs":
		result, err2 = client.BatchV1().Jobs(namespace).List(c.Request.Context(), metav1.ListOptions{})
	case "cronjobs":
		result, err2 = client.BatchV1().CronJobs(namespace).List(c.Request.Context(), metav1.ListOptions{})
	case "horizontalpodautoscalers":
		result, err2 = client.AutoscalingV2().HorizontalPodAutoscalers(namespace).List(c.Request.Context(), metav1.ListOptions{})
	case "limitranges":
		result, err2 = client.CoreV1().LimitRanges(namespace).List(c.Request.Context(), metav1.ListOptions{})
	case "resourcequotas":
		result, err2 = client.CoreV1().ResourceQuotas(namespace).List(c.Request.Context(), metav1.ListOptions{})
	case "serviceaccounts":
		result, err2 = client.CoreV1().ServiceAccounts(namespace).List(c.Request.Context(), metav1.ListOptions{})
	case "roles":
		result, err2 = client.RbacV1().Roles(namespace).List(c.Request.Context(), metav1.ListOptions{})
	case "rolebindings":
		result, err2 = client.RbacV1().RoleBindings(namespace).List(c.Request.Context(), metav1.ListOptions{})
	case "clusterroles":
		result, err2 = client.RbacV1().ClusterRoles().List(c.Request.Context(), metav1.ListOptions{})
	case "clusterrolebindings":
		result, err2 = client.RbacV1().ClusterRoleBindings().List(c.Request.Context(), metav1.ListOptions{})
	case "persistentvolumes":
		result, err2 = client.CoreV1().PersistentVolumes().List(c.Request.Context(), metav1.ListOptions{})
	case "persistentvolumeclaims":
		result, err2 = client.CoreV1().PersistentVolumeClaims(namespace).List(c.Request.Context(), metav1.ListOptions{})
	case "storageclasses":
		result, err2 = client.StorageV1().StorageClasses().List(c.Request.Context(), metav1.ListOptions{})
	case "priorityclasses":
		result, err2 = client.SchedulingV1().PriorityClasses().List(c.Request.Context(), metav1.ListOptions{})
	case "leases":
		result, err2 = client.CoordinationV1().Leases(namespace).List(c.Request.Context(), metav1.ListOptions{})
	case "runtimeclasses":
		result, err2 = client.NodeV1().RuntimeClasses().List(c.Request.Context(), metav1.ListOptions{})
	case "poddisruptionbudgets":
		result, err2 = client.PolicyV1().PodDisruptionBudgets(namespace).List(c.Request.Context(), metav1.ListOptions{})
	case "endpoints":
		result, err2 = client.CoreV1().Endpoints(namespace).List(c.Request.Context(), metav1.ListOptions{})
	case "ingresses":
		result, err2 = client.NetworkingV1().Ingresses(namespace).List(c.Request.Context(), metav1.ListOptions{})
	case "events":
		result, err2 = client.CoreV1().Events(namespace).List(c.Request.Context(), metav1.ListOptions{})
	default:
		c.JSON(http.StatusNotFound, gin.H{"error": fmt.Sprintf("Resource type %s not supported", resourceType)})
		return
	}

	if err2 != nil {
		h.logger.WithError(err2).WithField("resource_type", resourceType).Error("Failed to list resource")
		c.JSON(http.StatusInternalServerError, gin.H{"error": err2.Error()})
		return
	}

	c.JSON(http.StatusOK, result)
}

// GetGenericResourceSSE returns generic resources as Server-Sent Events
func (h *ResourcesHandler) GetGenericResourceSSE(c *gin.Context) {
	client, _, err := h.getClientAndConfig(c)
	if err != nil {
		h.logger.WithError(err).Error("Failed to get client for generic resource SSE")
		h.sendSSEError(c, http.StatusBadRequest, err.Error())
		return
	}

	resourceType := c.Param("resource")
	namespace := c.Query("namespace")

	var result interface{}
	var err2 error

	switch resourceType {
	case "daemonsets":
		result, err2 = client.AppsV1().DaemonSets(namespace).List(c.Request.Context(), metav1.ListOptions{})
	case "statefulsets":
		result, err2 = client.AppsV1().StatefulSets(namespace).List(c.Request.Context(), metav1.ListOptions{})
	case "replicasets":
		result, err2 = client.AppsV1().ReplicaSets(namespace).List(c.Request.Context(), metav1.ListOptions{})
	case "jobs":
		result, err2 = client.BatchV1().Jobs(namespace).List(c.Request.Context(), metav1.ListOptions{})
	case "cronjobs":
		result, err2 = client.BatchV1().CronJobs(namespace).List(c.Request.Context(), metav1.ListOptions{})
	case "horizontalpodautoscalers":
		result, err2 = client.AutoscalingV2().HorizontalPodAutoscalers(namespace).List(c.Request.Context(), metav1.ListOptions{})
	case "limitranges":
		result, err2 = client.CoreV1().LimitRanges(namespace).List(c.Request.Context(), metav1.ListOptions{})
	case "resourcequotas":
		result, err2 = client.CoreV1().ResourceQuotas(namespace).List(c.Request.Context(), metav1.ListOptions{})
	case "serviceaccounts":
		result, err2 = client.CoreV1().ServiceAccounts(namespace).List(c.Request.Context(), metav1.ListOptions{})
	case "roles":
		result, err2 = client.RbacV1().Roles(namespace).List(c.Request.Context(), metav1.ListOptions{})
	case "rolebindings":
		result, err2 = client.RbacV1().RoleBindings(namespace).List(c.Request.Context(), metav1.ListOptions{})
	case "clusterroles":
		result, err2 = client.RbacV1().ClusterRoles().List(c.Request.Context(), metav1.ListOptions{})
	case "clusterrolebindings":
		result, err2 = client.RbacV1().ClusterRoleBindings().List(c.Request.Context(), metav1.ListOptions{})
	case "persistentvolumes":
		result, err2 = client.CoreV1().PersistentVolumes().List(c.Request.Context(), metav1.ListOptions{})
	case "persistentvolumeclaims":
		result, err2 = client.CoreV1().PersistentVolumeClaims(namespace).List(c.Request.Context(), metav1.ListOptions{})
	case "storageclasses":
		result, err2 = client.StorageV1().StorageClasses().List(c.Request.Context(), metav1.ListOptions{})
	case "priorityclasses":
		result, err2 = client.SchedulingV1().PriorityClasses().List(c.Request.Context(), metav1.ListOptions{})
	case "leases":
		result, err2 = client.CoordinationV1().Leases(namespace).List(c.Request.Context(), metav1.ListOptions{})
	case "runtimeclasses":
		result, err2 = client.NodeV1().RuntimeClasses().List(c.Request.Context(), metav1.ListOptions{})
	case "poddisruptionbudgets":
		result, err2 = client.PolicyV1().PodDisruptionBudgets(namespace).List(c.Request.Context(), metav1.ListOptions{})
	case "endpoints":
		result, err2 = client.CoreV1().Endpoints(namespace).List(c.Request.Context(), metav1.ListOptions{})
	case "ingresses":
		result, err2 = client.NetworkingV1().Ingresses(namespace).List(c.Request.Context(), metav1.ListOptions{})
	case "events":
		result, err2 = client.CoreV1().Events(namespace).List(c.Request.Context(), metav1.ListOptions{})
	default:
		c.JSON(http.StatusNotFound, gin.H{"error": fmt.Sprintf("Resource type %s not supported", resourceType)})
		return
	}

	if err2 != nil {
		h.logger.WithError(err2).WithField("resource_type", resourceType).Error("Failed to list resource for SSE")
		h.sendSSEError(c, http.StatusInternalServerError, err2.Error())
		return
	}

	// For known types, send only .Items
	switch typed := result.(type) {
	case *appsV1.DaemonSetList:
		h.sendSSEResponse(c, typed.Items)
	case *appsV1.StatefulSetList:
		h.sendSSEResponse(c, typed.Items)
	case *appsV1.ReplicaSetList:
		h.sendSSEResponse(c, typed.Items)
	case *batchV1.JobList:
		h.sendSSEResponse(c, typed.Items)
	case *batchV1.CronJobList:
		h.sendSSEResponse(c, typed.Items)
	case *v2.HorizontalPodAutoscalerList:
		h.sendSSEResponse(c, typed.Items)
	case *v1.LimitRangeList:
		h.sendSSEResponse(c, typed.Items)
	case *v1.ResourceQuotaList:
		h.sendSSEResponse(c, typed.Items)
	case *v1.ServiceAccountList:
		h.sendSSEResponse(c, typed.Items)
	case *rbacv1.RoleList:
		h.sendSSEResponse(c, typed.Items)
	case *rbacv1.RoleBindingList:
		h.sendSSEResponse(c, typed.Items)
	case *rbacv1.ClusterRoleList:
		h.sendSSEResponse(c, typed.Items)
	case *rbacv1.ClusterRoleBindingList:
		h.sendSSEResponse(c, typed.Items)
	case *v1.PersistentVolumeList:
		h.sendSSEResponse(c, typed.Items)
	case *v1.PersistentVolumeClaimList:
		h.sendSSEResponse(c, typed.Items)
	case *storagev1.StorageClassList:
		h.sendSSEResponse(c, typed.Items)
	case *schedulingv1.PriorityClassList:
		h.sendSSEResponse(c, typed.Items)
	case *coordinationv1.LeaseList:
		h.sendSSEResponse(c, typed.Items)
	case *nodev1.RuntimeClassList:
		h.sendSSEResponse(c, typed.Items)
	case *policyv1.PodDisruptionBudgetList:
		h.sendSSEResponse(c, typed.Items)
	case *v1.EndpointsList:
		h.sendSSEResponse(c, typed.Items)
	case *networkingv1.IngressList:
		h.sendSSEResponse(c, typed.Items)
	case *v1.EventList:
		h.sendSSEResponse(c, typed.Items)
	default:
		h.sendSSEResponse(c, result)
	}
}

// GetGenericResourceDetails returns details for a specific resource
func (h *ResourcesHandler) GetGenericResourceDetails(c *gin.Context) {
	client, _, err := h.getClientAndConfig(c)
	if err != nil {
		h.logger.WithError(err).Error("Failed to get client for generic resource details")
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	resourceType := c.Param("resource")
	namespace := c.Param("namespace")
	name := c.Param("name")

	var result interface{}
	var err2 error

	switch resourceType {
	case "daemonsets":
		result, err2 = client.AppsV1().DaemonSets(namespace).Get(c.Request.Context(), name, metav1.GetOptions{})
	case "statefulsets":
		result, err2 = client.AppsV1().StatefulSets(namespace).Get(c.Request.Context(), name, metav1.GetOptions{})
	case "replicasets":
		result, err2 = client.AppsV1().ReplicaSets(namespace).Get(c.Request.Context(), name, metav1.GetOptions{})
	case "jobs":
		result, err2 = client.BatchV1().Jobs(namespace).Get(c.Request.Context(), name, metav1.GetOptions{})
	case "cronjobs":
		result, err2 = client.BatchV1().CronJobs(namespace).Get(c.Request.Context(), name, metav1.GetOptions{})
	case "horizontalpodautoscalers":
		result, err2 = client.AutoscalingV2().HorizontalPodAutoscalers(namespace).Get(c.Request.Context(), name, metav1.GetOptions{})
	case "limitranges":
		result, err2 = client.CoreV1().LimitRanges(namespace).Get(c.Request.Context(), name, metav1.GetOptions{})
	case "resourcequotas":
		result, err2 = client.CoreV1().ResourceQuotas(namespace).Get(c.Request.Context(), name, metav1.GetOptions{})
	case "serviceaccounts":
		result, err2 = client.CoreV1().ServiceAccounts(namespace).Get(c.Request.Context(), name, metav1.GetOptions{})
	case "roles":
		result, err2 = client.RbacV1().Roles(namespace).Get(c.Request.Context(), name, metav1.GetOptions{})
	case "rolebindings":
		result, err2 = client.RbacV1().RoleBindings(namespace).Get(c.Request.Context(), name, metav1.GetOptions{})
	case "clusterroles":
		result, err2 = client.RbacV1().ClusterRoles().Get(c.Request.Context(), name, metav1.GetOptions{})
	case "clusterrolebindings":
		result, err2 = client.RbacV1().ClusterRoleBindings().Get(c.Request.Context(), name, metav1.GetOptions{})
	case "persistentvolumes":
		result, err2 = client.CoreV1().PersistentVolumes().Get(c.Request.Context(), name, metav1.GetOptions{})
	case "persistentvolumeclaims":
		result, err2 = client.CoreV1().PersistentVolumeClaims(namespace).Get(c.Request.Context(), name, metav1.GetOptions{})
	case "storageclasses":
		result, err2 = client.StorageV1().StorageClasses().Get(c.Request.Context(), name, metav1.GetOptions{})
	case "priorityclasses":
		result, err2 = client.SchedulingV1().PriorityClasses().Get(c.Request.Context(), name, metav1.GetOptions{})
	case "leases":
		result, err2 = client.CoordinationV1().Leases(namespace).Get(c.Request.Context(), name, metav1.GetOptions{})
	case "runtimeclasses":
		result, err2 = client.NodeV1().RuntimeClasses().Get(c.Request.Context(), name, metav1.GetOptions{})
	case "poddisruptionbudgets":
		result, err2 = client.PolicyV1().PodDisruptionBudgets(namespace).Get(c.Request.Context(), name, metav1.GetOptions{})
	case "endpoints":
		result, err2 = client.CoreV1().Endpoints(namespace).Get(c.Request.Context(), name, metav1.GetOptions{})
	case "ingresses":
		result, err2 = client.NetworkingV1().Ingresses(namespace).Get(c.Request.Context(), name, metav1.GetOptions{})
	default:
		c.JSON(http.StatusNotFound, gin.H{"error": fmt.Sprintf("Resource type %s not supported", resourceType)})
		return
	}

	if err2 != nil {
		h.logger.WithError(err2).WithField("resource_type", resourceType).WithField("name", name).Error("Failed to get resource details")
		c.JSON(http.StatusNotFound, gin.H{"error": err2.Error()})
		return
	}

	// Check if this is an SSE request (EventSource expects SSE format)
	acceptHeader := c.GetHeader("Accept")
	if acceptHeader == "text/event-stream" {
		h.sendSSEResponse(c, result)
		return
	}

	c.JSON(http.StatusOK, result)
}

// getResourceEvents is a common function to get events for any resource type
func (h *ResourcesHandler) getResourceEvents(c *gin.Context, resourceKind, resourceName string) {
	client, _, err := h.getClientAndConfig(c)
	if err != nil {
		h.logger.WithError(err).Error("Failed to get client for resource events")
		// For EventSource, send error as SSE
		if c.GetHeader("Accept") == "text/event-stream" {
			h.sendSSEError(c, http.StatusBadRequest, err.Error())
		} else {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		}
		return
	}

	// Get events filtered by the resource name and kind
	events, err := client.CoreV1().Events("").List(c.Request.Context(), metav1.ListOptions{
		FieldSelector: fmt.Sprintf("involvedObject.name=%s,involvedObject.kind=%s", resourceName, resourceKind),
	})
	if err != nil {
		h.logger.WithError(err).WithField("resource", resourceName).WithField("kind", resourceKind).Error("Failed to get resource events")
		// For EventSource, send error as SSE
		if c.GetHeader("Accept") == "text/event-stream" {
			h.sendSSEError(c, http.StatusInternalServerError, err.Error())
		} else {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		}
		return
	}

	// Ensure we always have a valid array, even if empty
	eventsList := events.Items
	if eventsList == nil {
		eventsList = []v1.Event{}
	}

	// Check if this is an SSE request (EventSource expects SSE format)
	acceptHeader := c.GetHeader("Accept")
	h.logger.WithField("acceptHeader", acceptHeader).Info("Accept header received for resource events")
	if acceptHeader == "text/event-stream" {
		h.logger.Info("Sending SSE response for resource events EventSource")
		h.sendSSEResponse(c, eventsList)
		return
	}

	c.JSON(http.StatusOK, eventsList)
}

// GetPodEvents returns events for a specific pod
func (h *ResourcesHandler) GetPodEvents(c *gin.Context) {
	name := c.Param("name")
	h.getResourceEvents(c, "Pod", name)
}

// GetDeploymentEvents returns events for a specific deployment
func (h *ResourcesHandler) GetDeploymentEvents(c *gin.Context) {
	name := c.Param("name")
	h.getResourceEvents(c, "Deployment", name)
}

// GetServiceEvents returns events for a specific service
func (h *ResourcesHandler) GetServiceEvents(c *gin.Context) {
	name := c.Param("name")
	h.getResourceEvents(c, "Service", name)
}

// GetConfigMapEvents returns events for a specific configmap
func (h *ResourcesHandler) GetConfigMapEvents(c *gin.Context) {
	name := c.Param("name")
	h.getResourceEvents(c, "ConfigMap", name)
}

// GetSecretEvents returns events for a specific secret
func (h *ResourcesHandler) GetSecretEvents(c *gin.Context) {
	name := c.Param("name")
	h.getResourceEvents(c, "Secret", name)
}

// GetGenericResourceEvents returns events for any generic resource
func (h *ResourcesHandler) GetGenericResourceEvents(c *gin.Context) {
	resourceType := c.Param("resource")
	name := c.Param("name")

	// Map resource type to Kubernetes kind
	kindMap := map[string]string{
		"daemonsets":               "DaemonSet",
		"statefulsets":             "StatefulSet",
		"replicasets":              "ReplicaSet",
		"jobs":                     "Job",
		"cronjobs":                 "CronJob",
		"horizontalpodautoscalers": "HorizontalPodAutoscaler",
		"limitranges":              "LimitRange",
		"resourcequotas":           "ResourceQuota",
		"serviceaccounts":          "ServiceAccount",
		"roles":                    "Role",
		"rolebindings":             "RoleBinding",
		"clusterroles":             "ClusterRole",
		"clusterrolebindings":      "ClusterRoleBinding",
		"persistentvolumes":        "PersistentVolume",
		"persistentvolumeclaims":   "PersistentVolumeClaim",
		"storageclasses":           "StorageClass",
		"priorityclasses":          "PriorityClass",
		"leases":                   "Lease",
		"runtimeclasses":           "RuntimeClass",
		"poddisruptionbudgets":     "PodDisruptionBudget",
		"endpoints":                "Endpoints",
		"ingresses":                "Ingress",
	}

	kind, exists := kindMap[resourceType]
	if !exists {
		c.JSON(http.StatusBadRequest, gin.H{"error": fmt.Sprintf("Resource type %s not supported for events", resourceType)})
		return
	}

	h.getResourceEvents(c, kind, name)
}
