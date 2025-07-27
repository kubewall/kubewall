package api

import (
	"bufio"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"sync/atomic"
	"time"

	"kubewall-backend/internal/k8s"
	"kubewall-backend/internal/storage"
	"kubewall-backend/pkg/logger"

	"github.com/gin-gonic/gin"
	"github.com/gorilla/websocket"
	"github.com/sirupsen/logrus"
	"gopkg.in/yaml.v3"
	appsV1 "k8s.io/api/apps/v1"
	v1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/client-go/dynamic"
	"k8s.io/client-go/kubernetes"
	"k8s.io/client-go/kubernetes/scheme"
	"k8s.io/client-go/tools/clientcmd"
	"k8s.io/client-go/tools/clientcmd/api"
	"k8s.io/client-go/tools/remotecommand"
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
	ConfigName        string `json:"configName"`
	ClusterName       string `json:"clusterName"`
}

// DeploymentListResponse represents the response format expected by the frontend for deployments
type DeploymentListResponse struct {
	Age        string `json:"age"`
	HasUpdated bool   `json:"hasUpdated"`
	Name       string `json:"name"`
	Namespace  string `json:"namespace"`
	UID        string `json:"uid"`
	Replicas   string `json:"replicas"`
	Spec       struct {
		Replicas int32 `json:"replicas"`
	} `json:"spec"`
	Status struct {
		ObservedGeneration int64 `json:"observedGeneration"`
		Replicas           int32 `json:"replicas"`
		UpdatedReplicas    int32 `json:"updatedReplicas"`
		ReadyReplicas      int32 `json:"readyReplicas"`
		AvailableReplicas  int32 `json:"availableReplicas"`
		Conditions         []struct {
			Type   string `json:"type"`
			Status string `json:"status"`
		} `json:"conditions"`
	} `json:"status"`
}

// DaemonSetListResponse represents the response format expected by the frontend for daemonsets
type DaemonSetListResponse struct {
	Age        string `json:"age"`
	HasUpdated bool   `json:"hasUpdated"`
	Name       string `json:"name"`
	Namespace  string `json:"namespace"`
	UID        string `json:"uid"`
	Status     struct {
		CurrentNumberScheduled int32 `json:"currentNumberScheduled"`
		NumberMisscheduled     int32 `json:"numberMisscheduled"`
		DesiredNumberScheduled int32 `json:"desiredNumberScheduled"`
		NumberReady            int32 `json:"numberReady"`
		ObservedGeneration     int64 `json:"observedGeneration"`
		UpdatedNumberScheduled int32 `json:"updatedNumberScheduled"`
		NumberAvailable        int32 `json:"numberAvailable"`
	} `json:"status"`
}

// StatefulSetListResponse represents the response format expected by the frontend for statefulsets
type StatefulSetListResponse struct {
	Age        string `json:"age"`
	HasUpdated bool   `json:"hasUpdated"`
	Name       string `json:"name"`
	Namespace  string `json:"namespace"`
	UID        string `json:"uid"`
	Status     struct {
		Replicas             int32 `json:"replicas"`
		FullyLabeledReplicas int32 `json:"fullyLabeledReplicas"`
		ReadyReplicas        int32 `json:"readyReplicas"`
		AvailableReplicas    int32 `json:"availableReplicas"`
		ObservedGeneration   int64 `json:"observedGeneration"`
	} `json:"status"`
}

// ReplicaSetListResponse represents the response format expected by the frontend for replicasets
type ReplicaSetListResponse struct {
	Age        string `json:"age"`
	HasUpdated bool   `json:"hasUpdated"`
	Name       string `json:"name"`
	Namespace  string `json:"namespace"`
	UID        string `json:"uid"`
	Status     struct {
		Replicas             int32 `json:"replicas"`
		FullyLabeledReplicas int32 `json:"fullyLabeledReplicas"`
		ReadyReplicas        int32 `json:"readyReplicas"`
		AvailableReplicas    int32 `json:"availableReplicas"`
		ObservedGeneration   int64 `json:"observedGeneration"`
	} `json:"status"`
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

// sendSSEResponse sends a Server-Sent Events response with real-time updates
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

	// Set up periodic updates (every 10 seconds for real-time updates)
	ticker := time.NewTicker(10 * time.Second)
	defer ticker.Stop()

	// Keep connection alive with periodic updates
	for {
		select {
		case <-c.Request.Context().Done():
			h.logger.Info("SSE connection closed by client")
			return
		case <-ticker.C:
			// Send a keep-alive comment to prevent connection timeout
			c.SSEvent("", "")
			c.Writer.Flush()
		}
	}
}

// sendSSEResponseWithUpdates sends a Server-Sent Events response with periodic data updates
func (h *ResourcesHandler) sendSSEResponseWithUpdates(c *gin.Context, data interface{}, updateFunc func() (interface{}, error)) {
	// Set proper headers for SSE
	c.Header("Content-Type", "text/event-stream")
	c.Header("Cache-Control", "no-cache, no-store, must-revalidate")
	c.Header("Connection", "keep-alive")
	c.Header("Access-Control-Allow-Origin", "*")
	c.Header("Access-Control-Allow-Headers", "Cache-Control")
	c.Header("X-Accel-Buffering", "no") // Disable nginx buffering if present

	// Send initial data
	jsonData, err := json.Marshal(data)
	if err != nil {
		h.logger.WithError(err).Error("Failed to marshal SSE data")
		return
	}

	// Use Gin's SSEvent for initial data
	c.SSEvent("message", string(jsonData))
	c.Writer.Flush()

	// Set up periodic updates (every 10 seconds for real-time updates)
	ticker := time.NewTicker(10 * time.Second)
	defer ticker.Stop()

	// Keep connection alive with periodic updates
	for {
		select {
		case <-c.Request.Context().Done():
			h.logger.Info("SSE connection closed by client")
			return
		case <-ticker.C:
			// Fetch fresh data and send update
			if updateFunc != nil {
				freshData, err := updateFunc()
				if err != nil {
					h.logger.WithError(err).Error("Failed to fetch fresh data for SSE update")
					// Send keep-alive using SSEvent
					c.SSEvent("", "")
					c.Writer.Flush()
					continue
				}

				jsonData, err := json.Marshal(freshData)
				if err != nil {
					h.logger.WithError(err).Error("Failed to marshal fresh SSE data")
					// Send keep-alive using SSEvent
					c.SSEvent("", "")
					c.Writer.Flush()
					continue
				}

				// Send data using SSEvent
				c.SSEvent("message", string(jsonData))
				c.Writer.Flush()
			} else {
				// Send a keep-alive using SSEvent
				c.SSEvent("", "")
				c.Writer.Flush()
			}
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

// GetNamespacesSSE returns namespaces as Server-Sent Events with real-time updates
func (h *ResourcesHandler) GetNamespacesSSE(c *gin.Context) {
	client, _, err := h.getClientAndConfig(c)
	if err != nil {
		h.logger.WithError(err).Error("Failed to get client for namespaces SSE")
		h.sendSSEError(c, http.StatusBadRequest, err.Error())
		return
	}

	// Function to fetch namespaces data
	fetchNamespaces := func() (interface{}, error) {
		namespaceList, err := client.CoreV1().Namespaces().List(c.Request.Context(), metav1.ListOptions{})
		if err != nil {
			return nil, err
		}
		return namespaceList.Items, nil
	}

	// Get initial data
	initialData, err := fetchNamespaces()
	if err != nil {
		h.logger.WithError(err).Error("Failed to list namespaces for SSE")
		h.sendSSEError(c, http.StatusInternalServerError, err.Error())
		return
	}

	// Send SSE response with periodic updates
	h.sendSSEResponseWithUpdates(c, initialData, fetchNamespaces)
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
func (h *ResourcesHandler) transformPodToResponse(pod *v1.Pod, configName, clusterName string) PodListResponse {
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
		ConfigName:        configName,
		ClusterName:       clusterName,
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

// GetNodesSSE returns nodes as Server-Sent Events with real-time updates
func (h *ResourcesHandler) GetNodesSSE(c *gin.Context) {
	client, _, err := h.getClientAndConfig(c)
	if err != nil {
		h.logger.WithError(err).Error("Failed to get client for nodes SSE")
		h.sendSSEError(c, http.StatusBadRequest, err.Error())
		return
	}

	// Function to fetch and transform nodes data
	fetchNodes := func() (interface{}, error) {
		nodeList, err := client.CoreV1().Nodes().List(c.Request.Context(), metav1.ListOptions{})
		if err != nil {
			return nil, err
		}

		// Transform nodes to frontend-expected format
		var response []NodeListResponse
		for _, node := range nodeList.Items {
			response = append(response, h.transformNodeToResponse(&node))
		}

		return response, nil
	}

	// Get initial data
	initialData, err := fetchNodes()
	if err != nil {
		h.logger.WithError(err).Error("Failed to list nodes for SSE")
		h.sendSSEError(c, http.StatusInternalServerError, err.Error())
		return
	}

	// Send SSE response with periodic updates
	h.sendSSEResponseWithUpdates(c, initialData, fetchNodes)
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

// GetPodsSSE returns pods as Server-Sent Events with real-time updates
func (h *ResourcesHandler) GetPodsSSE(c *gin.Context) {
	client, _, err := h.getClientAndConfig(c)
	if err != nil {
		h.logger.WithError(err).Error("Failed to get client for pods SSE")
		h.sendSSEError(c, http.StatusBadRequest, err.Error())
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
		var transformedPods []PodListResponse
		for _, pod := range podList.Items {
			transformedPods = append(transformedPods, h.transformPodToResponse(&pod, configID, cluster))
		}

		return transformedPods, nil
	}

	// Get initial data
	initialData, err := fetchPods()
	if err != nil {
		h.logger.WithError(err).Error("Failed to list pods for SSE")
		h.sendSSEError(c, http.StatusInternalServerError, err.Error())
		return
	}

	// Send SSE response with periodic updates
	h.sendSSEResponseWithUpdates(c, initialData, fetchPods)
}

// GetPodByName returns a specific pod by name using namespace from query parameters
func (h *ResourcesHandler) GetPodByName(c *gin.Context) {
	client, _, err := h.getClientAndConfig(c)
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

	// Check if this is an SSE request (EventSource expects SSE format)
	acceptHeader := c.GetHeader("Accept")
	if acceptHeader == "text/event-stream" {
		h.sendSSEResponse(c, pod)
		return
	}

	c.JSON(http.StatusOK, pod)
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

// GetPodYAMLByName returns the YAML representation of a specific pod by name using namespace from query parameters
func (h *ResourcesHandler) GetPodYAMLByName(c *gin.Context) {
	client, _, err := h.getClientAndConfig(c)
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

	// Convert to YAML
	yamlData, err := yaml.Marshal(pod)
	if err != nil {
		h.logger.WithError(err).Error("Failed to marshal pod to YAML")
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

// GetPodYAML returns the YAML representation of a specific pod
func (h *ResourcesHandler) GetPodYAML(c *gin.Context) {
	client, _, err := h.getClientAndConfig(c)
	if err != nil {
		h.logger.WithError(err).Error("Failed to get client for pod YAML")
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	namespace := c.Param("namespace")
	name := c.Param("name")
	pod, err := client.CoreV1().Pods(namespace).Get(c.Request.Context(), name, metav1.GetOptions{})
	if err != nil {
		h.logger.WithError(err).WithField("pod", name).WithField("namespace", namespace).Error("Failed to get pod for YAML")
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	// Convert to YAML
	yamlData, err := yaml.Marshal(pod)
	if err != nil {
		h.logger.WithError(err).Error("Failed to marshal pod to YAML")
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

// GetDeployments returns all deployments in a namespace
func (h *ResourcesHandler) GetDeployments(c *gin.Context) {
	client, _, err := h.getClientAndConfig(c)
	if err != nil {
		h.logger.WithError(err).Error("Failed to get client for deployments")
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	namespace := c.Query("namespace")
	deploymentList, err := client.AppsV1().Deployments(namespace).List(c.Request.Context(), metav1.ListOptions{})
	if err != nil {
		h.logger.WithError(err).Error("Failed to list deployments")
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	// Transform deployments to frontend-expected format
	var response []DeploymentListResponse
	for _, deployment := range deploymentList.Items {
		response = append(response, h.transformDeploymentToResponse(&deployment))
	}

	c.JSON(http.StatusOK, response)
}

// GetDeploymentsSSE returns deployments as Server-Sent Events with real-time updates
func (h *ResourcesHandler) GetDeploymentsSSE(c *gin.Context) {
	client, _, err := h.getClientAndConfig(c)
	if err != nil {
		h.logger.WithError(err).Error("Failed to get client for deployments SSE")
		h.sendSSEError(c, http.StatusBadRequest, err.Error())
		return
	}

	namespace := c.Query("namespace")

	// Function to fetch and transform deployments data
	fetchDeployments := func() (interface{}, error) {
		deploymentList, err := client.AppsV1().Deployments(namespace).List(c.Request.Context(), metav1.ListOptions{})
		if err != nil {
			return nil, err
		}

		// Transform deployments to frontend-expected format
		var response []DeploymentListResponse
		for _, deployment := range deploymentList.Items {
			response = append(response, h.transformDeploymentToResponse(&deployment))
		}

		return response, nil
	}

	// Get initial data
	initialData, err := fetchDeployments()
	if err != nil {
		h.logger.WithError(err).Error("Failed to list deployments for SSE")
		h.sendSSEError(c, http.StatusInternalServerError, err.Error())
		return
	}

	// Send SSE response with periodic updates
	h.sendSSEResponseWithUpdates(c, initialData, fetchDeployments)
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

// GetDeploymentByName returns a specific deployment by name using namespace from query parameters
func (h *ResourcesHandler) GetDeploymentByName(c *gin.Context) {
	client, _, err := h.getClientAndConfig(c)
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

	// Check if this is an SSE request (EventSource expects SSE format)
	acceptHeader := c.GetHeader("Accept")
	if acceptHeader == "text/event-stream" {
		h.sendSSEResponse(c, deployment)
		return
	}

	c.JSON(http.StatusOK, deployment)
}

// GetDeploymentYAMLByName returns the YAML representation of a specific deployment by name using namespace from query parameters
func (h *ResourcesHandler) GetDeploymentYAMLByName(c *gin.Context) {
	client, _, err := h.getClientAndConfig(c)
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

	// Convert to YAML
	yamlData, err := yaml.Marshal(deployment)
	if err != nil {
		h.logger.WithError(err).Error("Failed to marshal deployment to YAML")
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

// GetDeploymentYAML returns the YAML representation of a specific deployment
func (h *ResourcesHandler) GetDeploymentYAML(c *gin.Context) {
	client, _, err := h.getClientAndConfig(c)
	if err != nil {
		h.logger.WithError(err).Error("Failed to get client for deployment YAML")
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	namespace := c.Param("namespace")
	name := c.Param("name")
	deployment, err := client.AppsV1().Deployments(namespace).Get(c.Request.Context(), name, metav1.GetOptions{})
	if err != nil {
		h.logger.WithError(err).WithField("deployment", name).WithField("namespace", namespace).Error("Failed to get deployment for YAML")
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	// Convert to YAML
	yamlData, err := yaml.Marshal(deployment)
	if err != nil {
		h.logger.WithError(err).Error("Failed to marshal deployment to YAML")
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

// GetDeploymentEventsByName returns events for a specific deployment by name using namespace from query parameters
func (h *ResourcesHandler) GetDeploymentEventsByName(c *gin.Context) {
	name := c.Param("name")
	namespace := c.Query("namespace")

	if namespace == "" {
		h.logger.WithField("deployment", name).Error("Namespace is required for deployment events lookup")
		c.JSON(http.StatusBadRequest, gin.H{"error": "namespace parameter is required"})
		return
	}

	h.getResourceEvents(c, "Deployment", name)
}

// GetDeploymentPods returns pods for a specific deployment
func (h *ResourcesHandler) GetDeploymentPods(c *gin.Context) {
	client, _, err := h.getClientAndConfig(c)
	if err != nil {
		h.logger.WithError(err).Error("Failed to get client for deployment pods")
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	namespace := c.Param("namespace")
	name := c.Param("name")

	// Get the deployment to find its labels
	deployment, err := client.AppsV1().Deployments(namespace).Get(c.Request.Context(), name, metav1.GetOptions{})
	if err != nil {
		h.logger.WithError(err).WithField("deployment", name).WithField("namespace", namespace).Error("Failed to get deployment")
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	// Get pods that match the deployment's selector
	podList, err := client.CoreV1().Pods(namespace).List(c.Request.Context(), metav1.ListOptions{
		LabelSelector: metav1.FormatLabelSelector(deployment.Spec.Selector),
	})
	if err != nil {
		h.logger.WithError(err).Error("Failed to list deployment pods")
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	// Transform pods to the expected format
	var transformedPods []PodListResponse
	configID := c.Query("config")
	cluster := c.Query("cluster")
	for _, pod := range podList.Items {
		transformedPods = append(transformedPods, h.transformPodToResponse(&pod, configID, cluster))
	}

	// Check if this is an SSE request (EventSource expects SSE format)
	acceptHeader := c.GetHeader("Accept")
	if acceptHeader == "text/event-stream" {
		h.sendSSEResponse(c, transformedPods)
		return
	}

	c.JSON(http.StatusOK, transformedPods)
}

// GetDeploymentPodsByName returns pods for a specific deployment by name using namespace from query parameters
func (h *ResourcesHandler) GetDeploymentPodsByName(c *gin.Context) {
	client, _, err := h.getClientAndConfig(c)
	if err != nil {
		h.logger.WithError(err).Error("Failed to get client for deployment pods")
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	name := c.Param("name")
	namespace := c.Query("namespace")

	if namespace == "" {
		h.logger.WithField("deployment", name).Error("Namespace is required for deployment pod lookup")
		c.JSON(http.StatusBadRequest, gin.H{"error": "namespace parameter is required"})
		return
	}

	// Get the deployment to find its labels
	deployment, err := client.AppsV1().Deployments(namespace).Get(c.Request.Context(), name, metav1.GetOptions{})
	if err != nil {
		h.logger.WithError(err).WithField("deployment", name).WithField("namespace", namespace).Error("Failed to get deployment")
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	// Get pods that match the deployment's selector
	podList, err := client.CoreV1().Pods(namespace).List(c.Request.Context(), metav1.ListOptions{
		LabelSelector: metav1.FormatLabelSelector(deployment.Spec.Selector),
	})
	if err != nil {
		h.logger.WithError(err).Error("Failed to list deployment pods")
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	// Transform pods to the expected format
	var transformedPods []PodListResponse
	configID := c.Query("config")
	cluster := c.Query("cluster")
	for _, pod := range podList.Items {
		transformedPods = append(transformedPods, h.transformPodToResponse(&pod, configID, cluster))
	}

	// Check if this is an SSE request (EventSource expects SSE format)
	acceptHeader := c.GetHeader("Accept")
	if acceptHeader == "text/event-stream" {
		h.sendSSEResponse(c, transformedPods)
		return
	}

	c.JSON(http.StatusOK, transformedPods)
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

// GetServicesSSE returns services as Server-Sent Events with real-time updates
func (h *ResourcesHandler) GetServicesSSE(c *gin.Context) {
	client, _, err := h.getClientAndConfig(c)
	if err != nil {
		h.logger.WithError(err).Error("Failed to get client for services SSE")
		h.sendSSEError(c, http.StatusBadRequest, err.Error())
		return
	}

	namespace := c.Query("namespace")

	// Function to fetch services data
	fetchServices := func() (interface{}, error) {
		serviceList, err := client.CoreV1().Services(namespace).List(c.Request.Context(), metav1.ListOptions{})
		if err != nil {
			return nil, err
		}
		return serviceList.Items, nil
	}

	// Get initial data
	initialData, err := fetchServices()
	if err != nil {
		h.logger.WithError(err).Error("Failed to list services for SSE")
		h.sendSSEError(c, http.StatusInternalServerError, err.Error())
		return
	}

	// Send SSE response with periodic updates
	h.sendSSEResponseWithUpdates(c, initialData, fetchServices)
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

// GetServiceByName returns a specific service by name using namespace from query parameters
func (h *ResourcesHandler) GetServiceByName(c *gin.Context) {
	client, _, err := h.getClientAndConfig(c)
	if err != nil {
		h.logger.WithError(err).Error("Failed to get client for service")
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	name := c.Param("name")
	namespace := c.Query("namespace")

	if namespace == "" {
		h.logger.WithField("service", name).Error("Namespace is required for service lookup")
		c.JSON(http.StatusBadRequest, gin.H{"error": "namespace parameter is required"})
		return
	}

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

// GetServiceYAMLByName returns the YAML representation of a specific service by name using namespace from query parameters
func (h *ResourcesHandler) GetServiceYAMLByName(c *gin.Context) {
	client, _, err := h.getClientAndConfig(c)
	if err != nil {
		h.logger.WithError(err).Error("Failed to get client for service YAML")
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	name := c.Param("name")
	namespace := c.Query("namespace")

	if namespace == "" {
		h.logger.WithField("service", name).Error("Namespace is required for service YAML lookup")
		c.JSON(http.StatusBadRequest, gin.H{"error": "namespace parameter is required"})
		return
	}

	service, err := client.CoreV1().Services(namespace).Get(c.Request.Context(), name, metav1.GetOptions{})
	if err != nil {
		h.logger.WithError(err).WithField("service", name).WithField("namespace", namespace).Error("Failed to get service for YAML")
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	// Convert to YAML
	yamlData, err := yaml.Marshal(service)
	if err != nil {
		h.logger.WithError(err).Error("Failed to marshal service to YAML")
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

// GetServiceYAML returns the YAML representation of a specific service
func (h *ResourcesHandler) GetServiceYAML(c *gin.Context) {
	client, _, err := h.getClientAndConfig(c)
	if err != nil {
		h.logger.WithError(err).Error("Failed to get client for service YAML")
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	namespace := c.Param("namespace")
	name := c.Param("name")
	service, err := client.CoreV1().Services(namespace).Get(c.Request.Context(), name, metav1.GetOptions{})
	if err != nil {
		h.logger.WithError(err).WithField("service", name).WithField("namespace", namespace).Error("Failed to get service for YAML")
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	// Convert to YAML
	yamlData, err := yaml.Marshal(service)
	if err != nil {
		h.logger.WithError(err).Error("Failed to marshal service to YAML")
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

// GetServiceEventsByName returns events for a specific service by name using namespace from query parameters
func (h *ResourcesHandler) GetServiceEventsByName(c *gin.Context) {
	name := c.Param("name")
	namespace := c.Query("namespace")

	if namespace == "" {
		h.logger.WithField("service", name).Error("Namespace is required for service events lookup")
		c.JSON(http.StatusBadRequest, gin.H{"error": "namespace parameter is required"})
		return
	}

	h.getResourceEvents(c, "Service", name)
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

// GetConfigMapsSSE returns configmaps as Server-Sent Events with real-time updates
func (h *ResourcesHandler) GetConfigMapsSSE(c *gin.Context) {
	client, _, err := h.getClientAndConfig(c)
	if err != nil {
		h.logger.WithError(err).Error("Failed to get client for configmaps SSE")
		h.sendSSEError(c, http.StatusBadRequest, err.Error())
		return
	}

	namespace := c.Query("namespace")

	// Function to fetch configmaps data
	fetchConfigMaps := func() (interface{}, error) {
		configMapList, err := client.CoreV1().ConfigMaps(namespace).List(c.Request.Context(), metav1.ListOptions{})
		if err != nil {
			return nil, err
		}
		return configMapList.Items, nil
	}

	// Get initial data
	initialData, err := fetchConfigMaps()
	if err != nil {
		h.logger.WithError(err).Error("Failed to list configmaps for SSE")
		h.sendSSEError(c, http.StatusInternalServerError, err.Error())
		return
	}

	// Send SSE response with periodic updates
	h.sendSSEResponseWithUpdates(c, initialData, fetchConfigMaps)
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

// GetConfigMapByName returns a specific configmap by name using namespace from query parameters
func (h *ResourcesHandler) GetConfigMapByName(c *gin.Context) {
	client, _, err := h.getClientAndConfig(c)
	if err != nil {
		h.logger.WithError(err).Error("Failed to get client for configmap")
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	name := c.Param("name")
	namespace := c.Query("namespace")

	if namespace == "" {
		h.logger.WithField("configmap", name).Error("Namespace is required for configmap lookup")
		c.JSON(http.StatusBadRequest, gin.H{"error": "namespace parameter is required"})
		return
	}

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

// GetConfigMapYAMLByName returns the YAML representation of a specific configmap by name using namespace from query parameters
func (h *ResourcesHandler) GetConfigMapYAMLByName(c *gin.Context) {
	client, _, err := h.getClientAndConfig(c)
	if err != nil {
		h.logger.WithError(err).Error("Failed to get client for configmap YAML")
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	name := c.Param("name")
	namespace := c.Query("namespace")

	if namespace == "" {
		h.logger.WithField("configmap", name).Error("Namespace is required for configmap YAML lookup")
		c.JSON(http.StatusBadRequest, gin.H{"error": "namespace parameter is required"})
		return
	}

	configMap, err := client.CoreV1().ConfigMaps(namespace).Get(c.Request.Context(), name, metav1.GetOptions{})
	if err != nil {
		h.logger.WithError(err).WithField("configmap", name).WithField("namespace", namespace).Error("Failed to get configmap for YAML")
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	// Convert to YAML
	yamlData, err := yaml.Marshal(configMap)
	if err != nil {
		h.logger.WithError(err).Error("Failed to marshal configmap to YAML")
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

// GetConfigMapYAML returns the YAML representation of a specific configmap
func (h *ResourcesHandler) GetConfigMapYAML(c *gin.Context) {
	client, _, err := h.getClientAndConfig(c)
	if err != nil {
		h.logger.WithError(err).Error("Failed to get client for configmap YAML")
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	namespace := c.Param("namespace")
	name := c.Param("name")
	configMap, err := client.CoreV1().ConfigMaps(namespace).Get(c.Request.Context(), name, metav1.GetOptions{})
	if err != nil {
		h.logger.WithError(err).WithField("configmap", name).WithField("namespace", namespace).Error("Failed to get configmap for YAML")
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	// Convert to YAML
	yamlData, err := yaml.Marshal(configMap)
	if err != nil {
		h.logger.WithError(err).Error("Failed to marshal configmap to YAML")
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

// GetConfigMapEventsByName returns events for a specific configmap by name using namespace from query parameters
func (h *ResourcesHandler) GetConfigMapEventsByName(c *gin.Context) {
	name := c.Param("name")
	namespace := c.Query("namespace")

	if namespace == "" {
		h.logger.WithField("configmap", name).Error("Namespace is required for configmap events lookup")
		c.JSON(http.StatusBadRequest, gin.H{"error": "namespace parameter is required"})
		return
	}

	h.getResourceEvents(c, "ConfigMap", name)
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

// GetSecretsSSE returns secrets as Server-Sent Events with real-time updates
func (h *ResourcesHandler) GetSecretsSSE(c *gin.Context) {
	client, _, err := h.getClientAndConfig(c)
	if err != nil {
		h.logger.WithError(err).Error("Failed to get client for secrets SSE")
		h.sendSSEError(c, http.StatusBadRequest, err.Error())
		return
	}

	namespace := c.Query("namespace")

	// Function to fetch secrets data
	fetchSecrets := func() (interface{}, error) {
		secretList, err := client.CoreV1().Secrets(namespace).List(c.Request.Context(), metav1.ListOptions{})
		if err != nil {
			return nil, err
		}
		return secretList.Items, nil
	}

	// Get initial data
	initialData, err := fetchSecrets()
	if err != nil {
		h.logger.WithError(err).Error("Failed to list secrets for SSE")
		h.sendSSEError(c, http.StatusInternalServerError, err.Error())
		return
	}

	// Send SSE response with periodic updates
	h.sendSSEResponseWithUpdates(c, initialData, fetchSecrets)
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

// GetSecretByName returns a specific secret by name using namespace from query parameters
func (h *ResourcesHandler) GetSecretByName(c *gin.Context) {
	client, _, err := h.getClientAndConfig(c)
	if err != nil {
		h.logger.WithError(err).Error("Failed to get client for secret")
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	name := c.Param("name")
	namespace := c.Query("namespace")

	if namespace == "" {
		h.logger.WithField("secret", name).Error("Namespace is required for secret lookup")
		c.JSON(http.StatusBadRequest, gin.H{"error": "namespace parameter is required"})
		return
	}

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

// GetSecretYAMLByName returns the YAML representation of a specific secret by name using namespace from query parameters
func (h *ResourcesHandler) GetSecretYAMLByName(c *gin.Context) {
	client, _, err := h.getClientAndConfig(c)
	if err != nil {
		h.logger.WithError(err).Error("Failed to get client for secret YAML")
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	name := c.Param("name")
	namespace := c.Query("namespace")

	if namespace == "" {
		h.logger.WithField("secret", name).Error("Namespace is required for secret YAML lookup")
		c.JSON(http.StatusBadRequest, gin.H{"error": "namespace parameter is required"})
		return
	}

	secret, err := client.CoreV1().Secrets(namespace).Get(c.Request.Context(), name, metav1.GetOptions{})
	if err != nil {
		h.logger.WithError(err).WithField("secret", name).WithField("namespace", namespace).Error("Failed to get secret for YAML")
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	// Convert to YAML
	yamlData, err := yaml.Marshal(secret)
	if err != nil {
		h.logger.WithError(err).Error("Failed to marshal secret to YAML")
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

// GetSecretYAML returns the YAML representation of a specific secret
func (h *ResourcesHandler) GetSecretYAML(c *gin.Context) {
	client, _, err := h.getClientAndConfig(c)
	if err != nil {
		h.logger.WithError(err).Error("Failed to get client for secret YAML")
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	namespace := c.Param("namespace")
	name := c.Param("name")
	secret, err := client.CoreV1().Secrets(namespace).Get(c.Request.Context(), name, metav1.GetOptions{})
	if err != nil {
		h.logger.WithError(err).WithField("secret", name).WithField("namespace", namespace).Error("Failed to get secret for YAML")
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	// Convert to YAML
	yamlData, err := yaml.Marshal(secret)
	if err != nil {
		h.logger.WithError(err).Error("Failed to marshal secret to YAML")
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

// GetSecretEventsByName returns events for a specific secret by name using namespace from query parameters
func (h *ResourcesHandler) GetSecretEventsByName(c *gin.Context) {
	name := c.Param("name")
	namespace := c.Query("namespace")

	if namespace == "" {
		h.logger.WithField("secret", name).Error("Namespace is required for secret events lookup")
		c.JSON(http.StatusBadRequest, gin.H{"error": "namespace parameter is required"})
		return
	}

	h.getResourceEvents(c, "Secret", name)
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

// GetCustomResourceDefinitionsSSE returns CRDs as Server-Sent Events with real-time updates
func (h *ResourcesHandler) GetCustomResourceDefinitionsSSE(c *gin.Context) {
	dynamicClient, err := h.getDynamicClient(c)
	if err != nil {
		h.logger.WithError(err).Error("Failed to get dynamic client for CRDs SSE")
		h.sendSSEError(c, http.StatusBadRequest, err.Error())
		return
	}

	// Function to fetch CRDs data
	fetchCRDs := func() (interface{}, error) {
		// CRDs are in the apiextensions.k8s.io/v1 API group
		gvr := schema.GroupVersionResource{
			Group:    "apiextensions.k8s.io",
			Version:  "v1",
			Resource: "customresourcedefinitions",
		}

		crdList, err := dynamicClient.Resource(gvr).List(c.Request.Context(), metav1.ListOptions{})
		if err != nil {
			return nil, err
		}

		items, _ := crdList.UnstructuredContent()["items"].([]interface{})
		return items, nil
	}

	// Get initial data
	initialData, err := fetchCRDs()
	if err != nil {
		h.logger.WithError(err).Error("Failed to list custom resource definitions for SSE")
		h.sendSSEError(c, http.StatusInternalServerError, err.Error())
		return
	}

	// Send SSE response with periodic updates
	h.sendSSEResponseWithUpdates(c, initialData, fetchCRDs)
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
		daemonSetList, err2 := client.AppsV1().DaemonSets(namespace).List(c.Request.Context(), metav1.ListOptions{})
		if err2 == nil {
			// Transform DaemonSets to frontend-expected format
			var response []DaemonSetListResponse
			for _, daemonSet := range daemonSetList.Items {
				response = append(response, h.transformDaemonSetToResponse(&daemonSet))
			}
			c.JSON(http.StatusOK, response)
			return
		}
		result = daemonSetList
		err2 = err2
	case "statefulsets":
		statefulSetList, err2 := client.AppsV1().StatefulSets(namespace).List(c.Request.Context(), metav1.ListOptions{})
		if err2 == nil {
			// Transform StatefulSets to frontend-expected format
			var response []StatefulSetListResponse
			for _, statefulSet := range statefulSetList.Items {
				response = append(response, h.transformStatefulSetToResponse(&statefulSet))
			}
			c.JSON(http.StatusOK, response)
			return
		}
		result = statefulSetList
		err2 = err2
	case "replicasets":
		replicaSetList, err2 := client.AppsV1().ReplicaSets(namespace).List(c.Request.Context(), metav1.ListOptions{})
		if err2 == nil {
			// Transform ReplicaSets to frontend-expected format
			var response []ReplicaSetListResponse
			for _, replicaSet := range replicaSetList.Items {
				response = append(response, h.transformReplicaSetToResponse(&replicaSet))
			}
			h.sendSSEResponse(c, response)
			return
		}
		result = replicaSetList
		err2 = err2
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

// GetGenericResourceSSE returns generic resources as Server-Sent Events with real-time updates
func (h *ResourcesHandler) GetGenericResourceSSE(c *gin.Context) {
	client, _, err := h.getClientAndConfig(c)
	if err != nil {
		h.logger.WithError(err).Error("Failed to get client for generic resource SSE")
		h.sendSSEError(c, http.StatusBadRequest, err.Error())
		return
	}

	resourceType := c.Param("resource")
	namespace := c.Query("namespace")

	// Function to fetch and transform data based on resource type
	fetchResource := func() (interface{}, error) {
		switch resourceType {
		case "daemonsets":
			daemonSetList, err := client.AppsV1().DaemonSets(namespace).List(c.Request.Context(), metav1.ListOptions{})
			if err != nil {
				return nil, err
			}
			// Transform DaemonSets to frontend-expected format
			var response []DaemonSetListResponse
			for _, daemonSet := range daemonSetList.Items {
				response = append(response, h.transformDaemonSetToResponse(&daemonSet))
			}
			return response, nil
		case "statefulsets":
			statefulSetList, err := client.AppsV1().StatefulSets(namespace).List(c.Request.Context(), metav1.ListOptions{})
			if err != nil {
				return nil, err
			}
			// Transform StatefulSets to frontend-expected format
			var response []StatefulSetListResponse
			for _, statefulSet := range statefulSetList.Items {
				response = append(response, h.transformStatefulSetToResponse(&statefulSet))
			}
			return response, nil
		case "replicasets":
			replicaSetList, err := client.AppsV1().ReplicaSets(namespace).List(c.Request.Context(), metav1.ListOptions{})
			if err != nil {
				return nil, err
			}
			// Transform ReplicaSets to frontend-expected format
			var response []ReplicaSetListResponse
			for _, replicaSet := range replicaSetList.Items {
				response = append(response, h.transformReplicaSetToResponse(&replicaSet))
			}
			return response, nil
		case "jobs":
			result, err := client.BatchV1().Jobs(namespace).List(c.Request.Context(), metav1.ListOptions{})
			if err != nil {
				return nil, err
			}
			return result.Items, nil
		case "cronjobs":
			result, err := client.BatchV1().CronJobs(namespace).List(c.Request.Context(), metav1.ListOptions{})
			if err != nil {
				return nil, err
			}
			return result.Items, nil
		case "horizontalpodautoscalers":
			result, err := client.AutoscalingV2().HorizontalPodAutoscalers(namespace).List(c.Request.Context(), metav1.ListOptions{})
			if err != nil {
				return nil, err
			}
			return result.Items, nil
		case "limitranges":
			result, err := client.CoreV1().LimitRanges(namespace).List(c.Request.Context(), metav1.ListOptions{})
			if err != nil {
				return nil, err
			}
			return result.Items, nil
		case "resourcequotas":
			result, err := client.CoreV1().ResourceQuotas(namespace).List(c.Request.Context(), metav1.ListOptions{})
			if err != nil {
				return nil, err
			}
			return result.Items, nil
		case "serviceaccounts":
			result, err := client.CoreV1().ServiceAccounts(namespace).List(c.Request.Context(), metav1.ListOptions{})
			if err != nil {
				return nil, err
			}
			return result.Items, nil
		case "roles":
			result, err := client.RbacV1().Roles(namespace).List(c.Request.Context(), metav1.ListOptions{})
			if err != nil {
				return nil, err
			}
			return result.Items, nil
		case "rolebindings":
			result, err := client.RbacV1().RoleBindings(namespace).List(c.Request.Context(), metav1.ListOptions{})
			if err != nil {
				return nil, err
			}
			return result.Items, nil
		case "clusterroles":
			result, err := client.RbacV1().ClusterRoles().List(c.Request.Context(), metav1.ListOptions{})
			if err != nil {
				return nil, err
			}
			return result.Items, nil
		case "clusterrolebindings":
			result, err := client.RbacV1().ClusterRoleBindings().List(c.Request.Context(), metav1.ListOptions{})
			if err != nil {
				return nil, err
			}
			return result.Items, nil
		case "persistentvolumes":
			result, err := client.CoreV1().PersistentVolumes().List(c.Request.Context(), metav1.ListOptions{})
			if err != nil {
				return nil, err
			}
			return result.Items, nil
		case "persistentvolumeclaims":
			result, err := client.CoreV1().PersistentVolumeClaims(namespace).List(c.Request.Context(), metav1.ListOptions{})
			if err != nil {
				return nil, err
			}
			return result.Items, nil
		case "storageclasses":
			result, err := client.StorageV1().StorageClasses().List(c.Request.Context(), metav1.ListOptions{})
			if err != nil {
				return nil, err
			}
			return result.Items, nil
		case "priorityclasses":
			result, err := client.SchedulingV1().PriorityClasses().List(c.Request.Context(), metav1.ListOptions{})
			if err != nil {
				return nil, err
			}
			return result.Items, nil
		case "leases":
			result, err := client.CoordinationV1().Leases(namespace).List(c.Request.Context(), metav1.ListOptions{})
			if err != nil {
				return nil, err
			}
			return result.Items, nil
		case "runtimeclasses":
			result, err := client.NodeV1().RuntimeClasses().List(c.Request.Context(), metav1.ListOptions{})
			if err != nil {
				return nil, err
			}
			return result.Items, nil
		case "poddisruptionbudgets":
			result, err := client.PolicyV1().PodDisruptionBudgets(namespace).List(c.Request.Context(), metav1.ListOptions{})
			if err != nil {
				return nil, err
			}
			return result.Items, nil
		case "endpoints":
			result, err := client.CoreV1().Endpoints(namespace).List(c.Request.Context(), metav1.ListOptions{})
			if err != nil {
				return nil, err
			}
			return result.Items, nil
		case "ingresses":
			result, err := client.NetworkingV1().Ingresses(namespace).List(c.Request.Context(), metav1.ListOptions{})
			if err != nil {
				return nil, err
			}
			return result.Items, nil
		case "events":
			result, err := client.CoreV1().Events(namespace).List(c.Request.Context(), metav1.ListOptions{})
			if err != nil {
				return nil, err
			}
			return result.Items, nil
		default:
			return nil, fmt.Errorf("Resource type %s not supported", resourceType)
		}
	}

	// Get initial data
	initialData, err := fetchResource()
	if err != nil {
		h.logger.WithError(err).WithField("resource_type", resourceType).Error("Failed to list resource for SSE")
		h.sendSSEError(c, http.StatusInternalServerError, err.Error())
		return
	}

	// Send SSE response with periodic updates
	h.sendSSEResponseWithUpdates(c, initialData, fetchResource)
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

// GetPodEventsByName returns events for a specific pod by name using namespace from query parameters
func (h *ResourcesHandler) GetPodEventsByName(c *gin.Context) {
	name := c.Param("name")
	namespace := c.Query("namespace")

	if namespace == "" {
		h.logger.WithField("pod", name).Error("Namespace is required for pod events lookup")
		c.JSON(http.StatusBadRequest, gin.H{"error": "namespace parameter is required"})
		return
	}

	h.getResourceEvents(c, "Pod", name)
}

// GetPodEvents returns events for a specific pod
func (h *ResourcesHandler) GetPodEvents(c *gin.Context) {
	name := c.Param("name")
	h.getResourceEvents(c, "Pod", name)
}

// GetPodLogs returns logs for a specific pod
func (h *ResourcesHandler) GetPodLogs(c *gin.Context) {
	client, _, err := h.getClientAndConfig(c)
	if err != nil {
		h.logger.WithError(err).Error("Failed to get client for pod logs")
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	namespace := c.Param("namespace")
	name := c.Param("name")
	container := c.Query("container")
	allContainers := c.Query("all-containers") == "true"

	// Get pod to verify it exists and get container names
	pod, err := client.CoreV1().Pods(namespace).Get(c.Request.Context(), name, metav1.GetOptions{})
	if err != nil {
		h.logger.WithError(err).WithField("pod", name).WithField("namespace", namespace).Error("Failed to get pod for logs")
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	// If all-containers is requested, get logs from all containers
	if allContainers {
		// Check if this is an SSE request
		acceptHeader := c.GetHeader("Accept")
		if acceptHeader == "text/event-stream" {
			// For SSE with all containers, stream logs from all containers concurrently
			c.Header("Content-Type", "text/event-stream")
			c.Header("Cache-Control", "no-cache")
			c.Header("Connection", "keep-alive")
			c.Header("Access-Control-Allow-Origin", "*")
			c.Header("Access-Control-Allow-Headers", "Cache-Control")

			// Create a channel to coordinate goroutines
			done := make(chan bool)
			var activeStreams int32

			for _, containerStatus := range pod.Status.ContainerStatuses {
				containerName := containerStatus.Name

				go func(containerName string) {
					defer func() {
						if atomic.AddInt32(&activeStreams, -1) == 0 {
							close(done)
						}
					}()
					atomic.AddInt32(&activeStreams, 1)

					logs, err := client.CoreV1().Pods(namespace).GetLogs(name, &v1.PodLogOptions{
						Container: containerName,
						Follow:    true,
					}).Stream(c.Request.Context())
					if err != nil {
						h.logger.WithError(err).WithField("container", containerName).Error("Failed to get logs for container")
						return
					}
					defer logs.Close()

					scanner := bufio.NewScanner(logs)
					for scanner.Scan() {
						logEntry := map[string]interface{}{
							"containerName": containerName,
							"timestamp":     time.Now().Format(time.RFC3339),
							"log":           scanner.Text(),
						}
						data, _ := json.Marshal(logEntry)
						fmt.Fprintf(c.Writer, "data: %s\n\n", data)
						c.Writer.Flush()
					}
				}(containerName)
			}

			// Wait for all streams to complete
			<-done
			return
		}

		// For regular requests, return logs from all containers
		var allLogs []map[string]interface{}
		for _, containerStatus := range pod.Status.ContainerStatuses {
			containerName := containerStatus.Name
			logs, err := client.CoreV1().Pods(namespace).GetLogs(name, &v1.PodLogOptions{
				Container: containerName,
				Follow:    false, // Don't follow for regular requests
			}).Stream(c.Request.Context())
			if err != nil {
				h.logger.WithError(err).WithField("container", containerName).Error("Failed to get logs for container")
				continue
			}
			defer logs.Close()

			scanner := bufio.NewScanner(logs)
			for scanner.Scan() {
				allLogs = append(allLogs, map[string]interface{}{
					"containerName": containerName,
					"timestamp":     time.Now().Format(time.RFC3339),
					"log":           scanner.Text(),
				})
			}
		}

		c.JSON(http.StatusOK, allLogs)
		return
	}

	// Get logs for specific container
	if container == "" {
		// If no container specified, use the first container
		if len(pod.Spec.Containers) > 0 {
			container = pod.Spec.Containers[0].Name
		} else {
			c.JSON(http.StatusBadRequest, gin.H{"error": "No containers found in pod"})
			return
		}
	}

	logs, err := client.CoreV1().Pods(namespace).GetLogs(name, &v1.PodLogOptions{
		Container: container,
		Follow:    true,
	}).Stream(c.Request.Context())
	if err != nil {
		h.logger.WithError(err).WithField("container", container).Error("Failed to get logs for container")
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	defer logs.Close()

	// Check if this is an SSE request
	acceptHeader := c.GetHeader("Accept")
	if acceptHeader == "text/event-stream" {
		// For SSE, stream the logs
		c.Header("Content-Type", "text/event-stream")
		c.Header("Cache-Control", "no-cache")
		c.Header("Connection", "keep-alive")
		c.Header("Access-Control-Allow-Origin", "*")
		c.Header("Access-Control-Allow-Headers", "Cache-Control")

		scanner := bufio.NewScanner(logs)
		for scanner.Scan() {
			logEntry := map[string]interface{}{
				"containerName": container,
				"timestamp":     time.Now().Format(time.RFC3339),
				"log":           scanner.Text(),
			}
			data, _ := json.Marshal(logEntry)
			fmt.Fprintf(c.Writer, "data: %s\n\n", data)
			c.Writer.Flush()
		}
		return
	}

	// For regular requests, return all logs at once
	var logLines []string
	scanner := bufio.NewScanner(logs)
	for scanner.Scan() {
		logLines = append(logLines, scanner.Text())
	}

	c.JSON(http.StatusOK, gin.H{
		"containerName": container,
		"logs":          logLines,
	})
}

// GetPodExec handles pod exec requests
func (h *ResourcesHandler) GetPodExec(c *gin.Context) {
	client, _, err := h.getClientAndConfig(c)
	if err != nil {
		h.logger.WithError(err).Error("Failed to get client for pod exec")
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	namespace := c.Param("namespace")
	name := c.Param("name")
	container := c.Query("container")
	command := c.Query("command")
	if command == "" {
		command = "/bin/sh"
	}

	// Get pod to verify it exists and get container names
	pod, err := client.CoreV1().Pods(namespace).Get(c.Request.Context(), name, metav1.GetOptions{})
	if err != nil {
		h.logger.WithError(err).WithField("pod", name).WithField("namespace", namespace).Error("Failed to get pod for exec")
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	// If no container specified, use the first container (0th container)
	if container == "" {
		if len(pod.Spec.Containers) > 0 {
			container = pod.Spec.Containers[0].Name
		} else {
			c.JSON(http.StatusBadRequest, gin.H{"error": "No containers found in pod"})
			return
		}
	}

	// Return container information for the frontend
	c.JSON(http.StatusOK, gin.H{
		"message":   "Pod exec endpoint available",
		"pod":       name,
		"namespace": namespace,
		"container": container,
		"command":   command,
		"containers": func() []string {
			var names []string
			for _, c := range pod.Spec.Containers {
				names = append(names, c.Name)
			}
			return names
		}(),
	})
}

// GetPodExecWebSocket handles WebSocket-based pod exec
func (h *ResourcesHandler) GetPodExecWebSocket(c *gin.Context) {
	client, config, err := h.getClientAndConfig(c)
	if err != nil {
		h.logger.WithError(err).Error("Failed to get client for pod exec WebSocket")
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	namespace := c.Param("namespace")
	name := c.Param("name")
	container := c.Query("container")
	command := c.Query("command")
	if command == "" {
		command = "/bin/sh"
	}

	h.logger.WithFields(logrus.Fields{
		"pod":       name,
		"namespace": namespace,
		"container": container,
		"command":   command,
	}).Info("Starting WebSocket pod exec")

	// Get pod to verify it exists and get container names
	pod, err := client.CoreV1().Pods(namespace).Get(c.Request.Context(), name, metav1.GetOptions{})
	if err != nil {
		h.logger.WithError(err).WithField("pod", name).WithField("namespace", namespace).Error("Failed to get pod for exec")
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	// If no container specified, use the first container (0th container)
	if container == "" {
		if len(pod.Spec.Containers) > 0 {
			container = pod.Spec.Containers[0].Name
		} else {
			c.JSON(http.StatusBadRequest, gin.H{"error": "No containers found in pod"})
			return
		}
	}

	// Upgrade to WebSocket
	upgrader := websocket.Upgrader{
		CheckOrigin: func(r *http.Request) bool {
			return true // Allow all origins for now
		},
	}

	ws, err := upgrader.Upgrade(c.Writer, c.Request, nil)
	if err != nil {
		h.logger.WithError(err).Error("Failed to upgrade to WebSocket")
		return
	}
	defer ws.Close()

	h.logger.Info("WebSocket connection established for pod exec")

	// Create exec request
	req := client.CoreV1().RESTClient().Post().
		Resource("pods").
		Name(name).
		Namespace(namespace).
		SubResource("exec").
		VersionedParams(&v1.PodExecOptions{
			Container: container,
			Command:   []string{command},
			Stdin:     true,
			Stdout:    true,
			Stderr:    true,
			TTY:       true,
		}, scheme.ParameterCodec)

	// Get rest config
	clientConfig := clientcmd.NewDefaultClientConfig(*config, &clientcmd.ConfigOverrides{})
	restConfig, err := clientConfig.ClientConfig()
	if err != nil {
		h.logger.WithError(err).Error("Failed to get rest config")
		ws.WriteJSON(gin.H{"error": err.Error()})
		return
	}

	// Create SPDY executor
	exec, err := remotecommand.NewSPDYExecutor(restConfig, "POST", req.URL())
	if err != nil {
		h.logger.WithError(err).Error("Failed to create SPDY executor")
		ws.WriteJSON(gin.H{"error": err.Error()})
		return
	}

	// Create streams
	stdin := NewWebSocketStdin(ws)
	stdout := &WebSocketStdout{conn: ws}
	stderr := &WebSocketStderr{conn: ws}

	h.logger.Info("Starting exec stream")

	// Start exec
	err = exec.Stream(remotecommand.StreamOptions{
		Stdin:  stdin,
		Stdout: stdout,
		Stderr: stderr,
		Tty:    true,
	})

	if err != nil {
		h.logger.WithError(err).Error("Failed to stream exec")
		ws.WriteJSON(gin.H{"error": err.Error()})
	} else {
		h.logger.Info("Exec stream completed successfully")
	}
}

// WebSocket stream implementations
type WebSocketStdin struct {
	conn      *websocket.Conn
	inputChan chan []byte
}

func NewWebSocketStdin(conn *websocket.Conn) *WebSocketStdin {
	ws := &WebSocketStdin{
		conn:      conn,
		inputChan: make(chan []byte, 100),
	}

	// Start a goroutine to read messages
	go func() {
		defer close(ws.inputChan)

		for {
			_, message, err := conn.ReadMessage()
			if err != nil {
				if websocket.IsUnexpectedCloseError(err) {
					log.Printf("WebSocket stdin closed unexpectedly: %v", err)
				} else {
					log.Printf("WebSocket stdin read error: %v", err)
				}
				return
			}

			var data map[string]interface{}
			if err := json.Unmarshal(message, &data); err != nil {
				log.Printf("Failed to unmarshal WebSocket message: %v", err)
				continue
			}

			if input, ok := data["input"].(string); ok {
				ws.inputChan <- []byte(input)
			} else {
				log.Printf("No input field in WebSocket message: %v", data)
			}
		}
	}()

	return ws
}

func (w *WebSocketStdin) Read(p []byte) (n int, err error) {
	data := <-w.inputChan
	if len(data) > len(p) {
		data = data[:len(p)]
	}
	copy(p, data)
	return len(data), nil
}

type WebSocketStdout struct {
	conn *websocket.Conn
}

func (w *WebSocketStdout) Write(p []byte) (n int, err error) {
	err = w.conn.WriteJSON(gin.H{
		"type": "stdout",
		"data": string(p),
	})
	if err != nil {
		return 0, err
	}
	return len(p), nil
}

type WebSocketStderr struct {
	conn *websocket.Conn
}

func (w *WebSocketStderr) Write(p []byte) (n int, err error) {
	err = w.conn.WriteJSON(gin.H{
		"type": "stderr",
		"data": string(p),
	})
	if err != nil {
		return 0, err
	}
	return len(p), nil
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

// GetPodLogsByName returns logs for a specific pod by name using namespace from query parameters
func (h *ResourcesHandler) GetPodLogsByName(c *gin.Context) {
	client, _, err := h.getClientAndConfig(c)
	if err != nil {
		h.logger.WithError(err).Error("Failed to get client for pod logs")
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	name := c.Param("name")
	namespace := c.Query("namespace")
	container := c.Query("container")
	allContainers := c.Query("all-containers") == "true"

	if namespace == "" {
		h.logger.WithField("pod", name).Error("Namespace is required for pod logs lookup")
		c.JSON(http.StatusBadRequest, gin.H{"error": "namespace parameter is required"})
		return
	}

	// Get pod to verify it exists and get container names
	pod, err := client.CoreV1().Pods(namespace).Get(c.Request.Context(), name, metav1.GetOptions{})
	if err != nil {
		h.logger.WithError(err).WithField("pod", name).WithField("namespace", namespace).Error("Failed to get pod for logs")
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	// If all-containers is requested, get logs from all containers
	if allContainers {
		// Check if this is an SSE request
		acceptHeader := c.GetHeader("Accept")
		if acceptHeader == "text/event-stream" {
			// For SSE with all containers, stream logs from all containers concurrently
			c.Header("Content-Type", "text/event-stream")
			c.Header("Cache-Control", "no-cache")
			c.Header("Connection", "keep-alive")
			c.Header("Access-Control-Allow-Origin", "*")
			c.Header("Access-Control-Allow-Headers", "Cache-Control")

			// Create a channel to coordinate goroutines
			done := make(chan bool)
			var activeStreams int32

			for _, containerStatus := range pod.Status.ContainerStatuses {
				containerName := containerStatus.Name

				go func(containerName string) {
					defer func() {
						if atomic.AddInt32(&activeStreams, -1) == 0 {
							close(done)
						}
					}()
					atomic.AddInt32(&activeStreams, 1)

					logs, err := client.CoreV1().Pods(namespace).GetLogs(name, &v1.PodLogOptions{
						Container: containerName,
						Follow:    true,
					}).Stream(c.Request.Context())
					if err != nil {
						h.logger.WithError(err).WithField("container", containerName).Error("Failed to get logs for container")
						return
					}
					defer logs.Close()

					scanner := bufio.NewScanner(logs)
					for scanner.Scan() {
						logEntry := map[string]interface{}{
							"containerName": containerName,
							"timestamp":     time.Now().Format(time.RFC3339),
							"log":           scanner.Text(),
						}
						data, _ := json.Marshal(logEntry)
						fmt.Fprintf(c.Writer, "data: %s\n\n", data)
						c.Writer.Flush()
					}
				}(containerName)
			}

			// Wait for all streams to complete
			<-done
			return
		}

		// For regular requests, return logs from all containers
		var allLogs []map[string]interface{}
		for _, containerStatus := range pod.Status.ContainerStatuses {
			containerName := containerStatus.Name
			logs, err := client.CoreV1().Pods(namespace).GetLogs(name, &v1.PodLogOptions{
				Container: containerName,
				Follow:    false, // Don't follow for regular requests
			}).Stream(c.Request.Context())
			if err != nil {
				h.logger.WithError(err).WithField("container", containerName).Error("Failed to get logs for container")
				continue
			}
			defer logs.Close()

			scanner := bufio.NewScanner(logs)
			for scanner.Scan() {
				allLogs = append(allLogs, map[string]interface{}{
					"containerName": containerName,
					"timestamp":     time.Now().Format(time.RFC3339),
					"log":           scanner.Text(),
				})
			}
		}

		c.JSON(http.StatusOK, allLogs)
		return
	}

	// Get logs for specific container
	if container == "" {
		// If no container specified, use the first container
		if len(pod.Spec.Containers) > 0 {
			container = pod.Spec.Containers[0].Name
		} else {
			c.JSON(http.StatusBadRequest, gin.H{"error": "No containers found in pod"})
			return
		}
	}

	logs, err := client.CoreV1().Pods(namespace).GetLogs(name, &v1.PodLogOptions{
		Container: container,
		Follow:    true,
	}).Stream(c.Request.Context())
	if err != nil {
		h.logger.WithError(err).WithField("container", container).Error("Failed to get logs for container")
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	defer logs.Close()

	// Check if this is an SSE request
	acceptHeader := c.GetHeader("Accept")
	if acceptHeader == "text/event-stream" {
		// For SSE, stream the logs
		c.Header("Content-Type", "text/event-stream")
		c.Header("Cache-Control", "no-cache")
		c.Header("Connection", "keep-alive")
		c.Header("Access-Control-Allow-Origin", "*")
		c.Header("Access-Control-Allow-Headers", "Cache-Control")

		scanner := bufio.NewScanner(logs)
		for scanner.Scan() {
			logEntry := map[string]interface{}{
				"containerName": container,
				"timestamp":     time.Now().Format(time.RFC3339),
				"log":           scanner.Text(),
			}
			data, _ := json.Marshal(logEntry)
			fmt.Fprintf(c.Writer, "data: %s\n\n", data)
			c.Writer.Flush()
		}
		return
	}

	// For regular requests, return all logs at once
	var logLines []string
	scanner := bufio.NewScanner(logs)
	for scanner.Scan() {
		logLines = append(logLines, scanner.Text())
	}

	c.JSON(http.StatusOK, gin.H{
		"containerName": container,
		"logs":          logLines,
	})
}

func (h *ResourcesHandler) transformDeploymentToResponse(deployment *appsV1.Deployment) DeploymentListResponse {
	// Send creation timestamp instead of calculated age
	age := ""
	if deployment.CreationTimestamp.Time != (time.Time{}) {
		age = deployment.CreationTimestamp.Time.Format(time.RFC3339)
	}

	// Transform conditions
	var conditions []struct {
		Type   string `json:"type"`
		Status string `json:"status"`
	}
	for _, condition := range deployment.Status.Conditions {
		conditions = append(conditions, struct {
			Type   string `json:"type"`
			Status string `json:"status"`
		}{
			Type:   string(condition.Type),
			Status: string(condition.Status),
		})
	}

	response := DeploymentListResponse{
		Age:        age,
		HasUpdated: false, // This would need to be tracked separately
		Name:       deployment.Name,
		Namespace:  deployment.Namespace,
		UID:        string(deployment.UID),
		Replicas:   fmt.Sprintf("%d", *deployment.Spec.Replicas),
		Spec: struct {
			Replicas int32 `json:"replicas"`
		}{
			Replicas: *deployment.Spec.Replicas,
		},
		Status: struct {
			ObservedGeneration int64 `json:"observedGeneration"`
			Replicas           int32 `json:"replicas"`
			UpdatedReplicas    int32 `json:"updatedReplicas"`
			ReadyReplicas      int32 `json:"readyReplicas"`
			AvailableReplicas  int32 `json:"availableReplicas"`
			Conditions         []struct {
				Type   string `json:"type"`
				Status string `json:"status"`
			} `json:"conditions"`
		}{
			ObservedGeneration: deployment.Status.ObservedGeneration,
			Replicas:           deployment.Status.Replicas,
			UpdatedReplicas:    deployment.Status.UpdatedReplicas,
			ReadyReplicas:      deployment.Status.ReadyReplicas,
			AvailableReplicas:  deployment.Status.AvailableReplicas,
			Conditions:         conditions,
		},
	}

	return response
}

func (h *ResourcesHandler) transformDaemonSetToResponse(daemonSet *appsV1.DaemonSet) DaemonSetListResponse {
	// Send creation timestamp instead of calculated age
	age := ""
	if daemonSet.CreationTimestamp.Time != (time.Time{}) {
		age = daemonSet.CreationTimestamp.Time.Format(time.RFC3339)
	}

	response := DaemonSetListResponse{
		Age:        age,
		HasUpdated: false, // This would need to be tracked separately
		Name:       daemonSet.Name,
		Namespace:  daemonSet.Namespace,
		UID:        string(daemonSet.UID),
		Status: struct {
			CurrentNumberScheduled int32 `json:"currentNumberScheduled"`
			NumberMisscheduled     int32 `json:"numberMisscheduled"`
			DesiredNumberScheduled int32 `json:"desiredNumberScheduled"`
			NumberReady            int32 `json:"numberReady"`
			ObservedGeneration     int64 `json:"observedGeneration"`
			UpdatedNumberScheduled int32 `json:"updatedNumberScheduled"`
			NumberAvailable        int32 `json:"numberAvailable"`
		}{
			CurrentNumberScheduled: daemonSet.Status.CurrentNumberScheduled,
			NumberMisscheduled:     daemonSet.Status.NumberMisscheduled,
			DesiredNumberScheduled: daemonSet.Status.DesiredNumberScheduled,
			NumberReady:            daemonSet.Status.NumberReady,
			ObservedGeneration:     daemonSet.Status.ObservedGeneration,
			UpdatedNumberScheduled: daemonSet.Status.UpdatedNumberScheduled,
			NumberAvailable:        daemonSet.Status.NumberAvailable,
		},
	}

	return response
}

func (h *ResourcesHandler) transformStatefulSetToResponse(statefulSet *appsV1.StatefulSet) StatefulSetListResponse {
	// Send creation timestamp instead of calculated age
	age := ""
	if statefulSet.CreationTimestamp.Time != (time.Time{}) {
		age = statefulSet.CreationTimestamp.Time.Format(time.RFC3339)
	}

	response := StatefulSetListResponse{
		Age:        age,
		HasUpdated: false, // This would need to be tracked separately
		Name:       statefulSet.Name,
		Namespace:  statefulSet.Namespace,
		UID:        string(statefulSet.UID),
		Status: struct {
			Replicas             int32 `json:"replicas"`
			FullyLabeledReplicas int32 `json:"fullyLabeledReplicas"`
			ReadyReplicas        int32 `json:"readyReplicas"`
			AvailableReplicas    int32 `json:"availableReplicas"`
			ObservedGeneration   int64 `json:"observedGeneration"`
		}{
			Replicas:             statefulSet.Status.Replicas,
			FullyLabeledReplicas: statefulSet.Status.Replicas, // Use Replicas as fallback since FullyLabeledReplicas doesn't exist
			ReadyReplicas:        statefulSet.Status.ReadyReplicas,
			AvailableReplicas:    statefulSet.Status.AvailableReplicas,
			ObservedGeneration:   statefulSet.Status.ObservedGeneration,
		},
	}

	return response
}

func (h *ResourcesHandler) transformReplicaSetToResponse(replicaSet *appsV1.ReplicaSet) ReplicaSetListResponse {
	// Send creation timestamp instead of calculated age
	age := ""
	if replicaSet.CreationTimestamp.Time != (time.Time{}) {
		age = replicaSet.CreationTimestamp.Time.Format(time.RFC3339)
	}

	response := ReplicaSetListResponse{
		Age:        age,
		HasUpdated: false, // This would need to be tracked separately
		Name:       replicaSet.Name,
		Namespace:  replicaSet.Namespace,
		UID:        string(replicaSet.UID),
		Status: struct {
			Replicas             int32 `json:"replicas"`
			FullyLabeledReplicas int32 `json:"fullyLabeledReplicas"`
			ReadyReplicas        int32 `json:"readyReplicas"`
			AvailableReplicas    int32 `json:"availableReplicas"`
			ObservedGeneration   int64 `json:"observedGeneration"`
		}{
			Replicas:             replicaSet.Status.Replicas,
			FullyLabeledReplicas: replicaSet.Status.FullyLabeledReplicas,
			ReadyReplicas:        replicaSet.Status.ReadyReplicas,
			AvailableReplicas:    replicaSet.Status.AvailableReplicas,
			ObservedGeneration:   replicaSet.Status.ObservedGeneration,
		},
	}

	return response
}

// GetGenericResourceYAML returns the YAML representation of a specific generic resource
func (h *ResourcesHandler) GetGenericResourceYAML(c *gin.Context) {
	client, _, err := h.getClientAndConfig(c)
	if err != nil {
		h.logger.WithError(err).Error("Failed to get client for generic resource YAML")
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
	case "persistentvolumeclaims":
		result, err2 = client.CoreV1().PersistentVolumeClaims(namespace).Get(c.Request.Context(), name, metav1.GetOptions{})
	case "poddisruptionbudgets":
		result, err2 = client.PolicyV1().PodDisruptionBudgets(namespace).Get(c.Request.Context(), name, metav1.GetOptions{})
	case "endpoints":
		result, err2 = client.CoreV1().Endpoints(namespace).Get(c.Request.Context(), name, metav1.GetOptions{})
	case "ingresses":
		result, err2 = client.NetworkingV1().Ingresses(namespace).Get(c.Request.Context(), name, metav1.GetOptions{})
	case "leases":
		result, err2 = client.CoordinationV1().Leases(namespace).Get(c.Request.Context(), name, metav1.GetOptions{})
	default:
		h.logger.WithField("resource_type", resourceType).Error("Unsupported resource type for YAML")
		c.JSON(http.StatusBadRequest, gin.H{"error": "Unsupported resource type"})
		return
	}

	if err2 != nil {
		h.logger.WithError(err2).WithField("resource_type", resourceType).WithField("name", name).WithField("namespace", namespace).Error("Failed to get resource for YAML")
		c.JSON(http.StatusNotFound, gin.H{"error": err2.Error()})
		return
	}

	// Convert to YAML
	yamlData, err := yaml.Marshal(result)
	if err != nil {
		h.logger.WithError(err).Error("Failed to marshal resource to YAML")
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

// GetGenericResourceYAMLByName returns the YAML representation of a specific generic resource by name using namespace from query parameters
func (h *ResourcesHandler) GetGenericResourceYAMLByName(c *gin.Context) {
	client, _, err := h.getClientAndConfig(c)
	if err != nil {
		h.logger.WithError(err).Error("Failed to get client for generic resource YAML")
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	resourceType := c.Param("resource")
	name := c.Param("name")
	namespace := c.Query("namespace")

	if namespace == "" {
		h.logger.WithField("resource_type", resourceType).WithField("name", name).Error("Namespace is required for generic resource YAML lookup")
		c.JSON(http.StatusBadRequest, gin.H{"error": "namespace parameter is required"})
		return
	}

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
	case "persistentvolumeclaims":
		result, err2 = client.CoreV1().PersistentVolumeClaims(namespace).Get(c.Request.Context(), name, metav1.GetOptions{})
	case "poddisruptionbudgets":
		result, err2 = client.PolicyV1().PodDisruptionBudgets(namespace).Get(c.Request.Context(), name, metav1.GetOptions{})
	case "endpoints":
		result, err2 = client.CoreV1().Endpoints(namespace).Get(c.Request.Context(), name, metav1.GetOptions{})
	case "ingresses":
		result, err2 = client.NetworkingV1().Ingresses(namespace).Get(c.Request.Context(), name, metav1.GetOptions{})
	case "leases":
		result, err2 = client.CoordinationV1().Leases(namespace).Get(c.Request.Context(), name, metav1.GetOptions{})
	default:
		h.logger.WithField("resource_type", resourceType).Error("Unsupported resource type for YAML")
		c.JSON(http.StatusBadRequest, gin.H{"error": "Unsupported resource type"})
		return
	}

	if err2 != nil {
		h.logger.WithError(err2).WithField("resource_type", resourceType).WithField("name", name).WithField("namespace", namespace).Error("Failed to get resource for YAML")
		c.JSON(http.StatusNotFound, gin.H{"error": err2.Error()})
		return
	}

	// Convert to YAML
	yamlData, err := yaml.Marshal(result)
	if err != nil {
		h.logger.WithError(err).Error("Failed to marshal resource to YAML")
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

// GetDaemonSetsSSE returns daemonsets as Server-Sent Events
// GetDaemonSetsSSE returns daemonsets as Server-Sent Events with real-time updates
func (h *ResourcesHandler) GetDaemonSetsSSE(c *gin.Context) {
	client, _, err := h.getClientAndConfig(c)
	if err != nil {
		h.logger.WithError(err).Error("Failed to get client for daemonsets SSE")
		h.sendSSEError(c, http.StatusBadRequest, err.Error())
		return
	}

	namespace := c.Query("namespace")

	// Function to fetch and transform daemonsets data
	fetchDaemonSets := func() (interface{}, error) {
		daemonSetList, err := client.AppsV1().DaemonSets(namespace).List(c.Request.Context(), metav1.ListOptions{})
		if err != nil {
			return nil, err
		}

		// Transform daemonsets to frontend-expected format
		var response []DaemonSetListResponse
		for _, daemonSet := range daemonSetList.Items {
			response = append(response, h.transformDaemonSetToResponse(&daemonSet))
		}

		return response, nil
	}

	// Get initial data
	initialData, err := fetchDaemonSets()
	if err != nil {
		h.logger.WithError(err).Error("Failed to list daemonsets for SSE")
		h.sendSSEError(c, http.StatusInternalServerError, err.Error())
		return
	}

	// Send SSE response with periodic updates
	h.sendSSEResponseWithUpdates(c, initialData, fetchDaemonSets)
}

// GetDaemonSet returns a specific daemonset
func (h *ResourcesHandler) GetDaemonSet(c *gin.Context) {
	client, _, err := h.getClientAndConfig(c)
	if err != nil {
		h.logger.WithError(err).Error("Failed to get client for daemonset")
		// For EventSource, send error as SSE
		if c.GetHeader("Accept") == "text/event-stream" {
			h.sendSSEError(c, http.StatusBadRequest, err.Error())
		} else {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		}
		return
	}

	namespace := c.Param("namespace")
	name := c.Param("name")

	daemonSet, err := client.AppsV1().DaemonSets(namespace).Get(c.Request.Context(), name, metav1.GetOptions{})
	if err != nil {
		h.logger.WithError(err).WithField("daemonset", name).WithField("namespace", namespace).Error("Failed to get daemonset")
		// For EventSource, send error as SSE
		if c.GetHeader("Accept") == "text/event-stream" {
			h.sendSSEError(c, http.StatusNotFound, err.Error())
		} else {
			c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		}
		return
	}

	// Check if this is an SSE request (EventSource expects SSE format)
	acceptHeader := c.GetHeader("Accept")
	if acceptHeader == "text/event-stream" {
		h.sendSSEResponse(c, daemonSet)
		return
	}

	c.JSON(http.StatusOK, daemonSet)
}

// GetDaemonSetYAML returns the YAML representation of a specific daemonset
func (h *ResourcesHandler) GetDaemonSetYAML(c *gin.Context) {
	client, _, err := h.getClientAndConfig(c)
	if err != nil {
		h.logger.WithError(err).Error("Failed to get client for daemonset YAML")
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	namespace := c.Param("namespace")
	name := c.Param("name")

	daemonSet, err := client.AppsV1().DaemonSets(namespace).Get(c.Request.Context(), name, metav1.GetOptions{})
	if err != nil {
		h.logger.WithError(err).WithField("daemonset", name).WithField("namespace", namespace).Error("Failed to get daemonset for YAML")
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	// Convert to YAML
	yamlData, err := yaml.Marshal(daemonSet)
	if err != nil {
		h.logger.WithError(err).Error("Failed to marshal daemonset to YAML")
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

// GetDaemonSetEvents returns events for a specific daemonset
func (h *ResourcesHandler) GetDaemonSetEvents(c *gin.Context) {
	name := c.Param("name")
	h.getResourceEvents(c, "DaemonSet", name)
}

// GetDaemonSetPods returns pods for a specific daemonset
func (h *ResourcesHandler) GetDaemonSetPods(c *gin.Context) {
	client, _, err := h.getClientAndConfig(c)
	if err != nil {
		h.logger.WithError(err).Error("Failed to get client for daemonset pods")
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	namespace := c.Param("namespace")
	name := c.Param("name")

	// Get the daemonset to find its labels
	daemonSet, err := client.AppsV1().DaemonSets(namespace).Get(c.Request.Context(), name, metav1.GetOptions{})
	if err != nil {
		h.logger.WithError(err).WithField("daemonset", name).WithField("namespace", namespace).Error("Failed to get daemonset")
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	// Get pods that match the daemonset's selector
	podList, err := client.CoreV1().Pods(namespace).List(c.Request.Context(), metav1.ListOptions{
		LabelSelector: metav1.FormatLabelSelector(daemonSet.Spec.Selector),
	})
	if err != nil {
		h.logger.WithError(err).Error("Failed to list daemonset pods")
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	// Transform pods to the expected format
	var transformedPods []PodListResponse
	configID := c.Query("config")
	cluster := c.Query("cluster")
	for _, pod := range podList.Items {
		transformedPods = append(transformedPods, h.transformPodToResponse(&pod, configID, cluster))
	}

	// Check if this is an SSE request (EventSource expects SSE format)
	acceptHeader := c.GetHeader("Accept")
	if acceptHeader == "text/event-stream" {
		h.sendSSEResponse(c, transformedPods)
		return
	}

	c.JSON(http.StatusOK, transformedPods)
}

// GetStatefulSetPods returns pods for a specific statefulset
func (h *ResourcesHandler) GetStatefulSetPods(c *gin.Context) {
	client, _, err := h.getClientAndConfig(c)
	if err != nil {
		h.logger.WithError(err).Error("Failed to get client for statefulset pods")
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	namespace := c.Param("namespace")
	name := c.Param("name")

	// Get the statefulset to find its labels
	statefulSet, err := client.AppsV1().StatefulSets(namespace).Get(c.Request.Context(), name, metav1.GetOptions{})
	if err != nil {
		h.logger.WithError(err).WithField("statefulset", name).WithField("namespace", namespace).Error("Failed to get statefulset")
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	// Get pods that match the statefulset's selector
	podList, err := client.CoreV1().Pods(namespace).List(c.Request.Context(), metav1.ListOptions{
		LabelSelector: metav1.FormatLabelSelector(statefulSet.Spec.Selector),
	})
	if err != nil {
		h.logger.WithError(err).Error("Failed to list statefulset pods")
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	// Transform pods to the expected format
	var transformedPods []PodListResponse
	configID := c.Query("config")
	cluster := c.Query("cluster")
	for _, pod := range podList.Items {
		transformedPods = append(transformedPods, h.transformPodToResponse(&pod, configID, cluster))
	}

	// Check if this is an SSE request (EventSource expects SSE format)
	acceptHeader := c.GetHeader("Accept")
	if acceptHeader == "text/event-stream" {
		h.sendSSEResponse(c, transformedPods)
		return
	}

	c.JSON(http.StatusOK, transformedPods)
}

// GetStatefulSet returns a specific statefulset
func (h *ResourcesHandler) GetStatefulSet(c *gin.Context) {
	client, _, err := h.getClientAndConfig(c)
	if err != nil {
		h.logger.WithError(err).Error("Failed to get client for statefulset")
		// For EventSource, send error as SSE
		if c.GetHeader("Accept") == "text/event-stream" {
			h.sendSSEError(c, http.StatusBadRequest, err.Error())
		} else {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		}
		return
	}

	namespace := c.Param("namespace")
	name := c.Param("name")

	statefulSet, err := client.AppsV1().StatefulSets(namespace).Get(c.Request.Context(), name, metav1.GetOptions{})
	if err != nil {
		h.logger.WithError(err).WithField("statefulset", name).WithField("namespace", namespace).Error("Failed to get statefulset")
		// For EventSource, send error as SSE
		if c.GetHeader("Accept") == "text/event-stream" {
			h.sendSSEError(c, http.StatusNotFound, err.Error())
		} else {
			c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		}
		return
	}

	// Check if this is an SSE request (EventSource expects SSE format)
	acceptHeader := c.GetHeader("Accept")
	if acceptHeader == "text/event-stream" {
		h.sendSSEResponse(c, statefulSet)
		return
	}

	c.JSON(http.StatusOK, statefulSet)
}

// GetStatefulSetYAML returns the YAML representation of a specific statefulset
func (h *ResourcesHandler) GetStatefulSetYAML(c *gin.Context) {
	client, _, err := h.getClientAndConfig(c)
	if err != nil {
		h.logger.WithError(err).Error("Failed to get client for statefulset YAML")
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	namespace := c.Param("namespace")
	name := c.Param("name")

	statefulSet, err := client.AppsV1().StatefulSets(namespace).Get(c.Request.Context(), name, metav1.GetOptions{})
	if err != nil {
		h.logger.WithError(err).WithField("statefulset", name).WithField("namespace", namespace).Error("Failed to get statefulset for YAML")
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	// Convert to YAML
	yamlData, err := yaml.Marshal(statefulSet)
	if err != nil {
		h.logger.WithError(err).Error("Failed to marshal statefulset to YAML")
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

// GetStatefulSetEvents returns events for a specific statefulset
func (h *ResourcesHandler) GetStatefulSetEvents(c *gin.Context) {
	name := c.Param("name")
	h.getResourceEvents(c, "StatefulSet", name)
}

// GetNodePods returns pods running on a specific node
func (h *ResourcesHandler) GetNodePods(c *gin.Context) {
	client, _, err := h.getClientAndConfig(c)
	if err != nil {
		h.logger.WithError(err).Error("Failed to get client for node pods")
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	nodeName := c.Param("name")

	// Get all pods and filter by node
	podList, err := client.CoreV1().Pods("").List(c.Request.Context(), metav1.ListOptions{
		FieldSelector: fmt.Sprintf("spec.nodeName=%s", nodeName),
	})
	if err != nil {
		h.logger.WithError(err).Error("Failed to list node pods")
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	// Transform pods to the expected format
	var transformedPods []PodListResponse
	configID := c.Query("config")
	cluster := c.Query("cluster")
	for _, pod := range podList.Items {
		transformedPods = append(transformedPods, h.transformPodToResponse(&pod, configID, cluster))
	}

	// Check if this is an SSE request (EventSource expects SSE format)
	acceptHeader := c.GetHeader("Accept")
	if acceptHeader == "text/event-stream" {
		h.sendSSEResponse(c, transformedPods)
		return
	}

	c.JSON(http.StatusOK, transformedPods)
}

// GetNamespacePods returns all pods in a specific namespace
func (h *ResourcesHandler) GetNamespacePods(c *gin.Context) {
	client, _, err := h.getClientAndConfig(c)
	if err != nil {
		h.logger.WithError(err).Error("Failed to get client for namespace pods")
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	namespaceName := c.Param("name")

	// Get pods in the specific namespace
	podList, err := client.CoreV1().Pods(namespaceName).List(c.Request.Context(), metav1.ListOptions{})
	if err != nil {
		h.logger.WithError(err).Error("Failed to list namespace pods")
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	// Transform pods to the expected format
	var transformedPods []PodListResponse
	configID := c.Query("config")
	cluster := c.Query("cluster")
	for _, pod := range podList.Items {
		transformedPods = append(transformedPods, h.transformPodToResponse(&pod, configID, cluster))
	}

	// Check if this is an SSE request (EventSource expects SSE format)
	acceptHeader := c.GetHeader("Accept")
	if acceptHeader == "text/event-stream" {
		h.sendSSEResponse(c, transformedPods)
		return
	}

	c.JSON(http.StatusOK, transformedPods)
}

// GetReplicaSetPods returns pods for a specific replicaset
func (h *ResourcesHandler) GetReplicaSetPods(c *gin.Context) {
	client, _, err := h.getClientAndConfig(c)
	if err != nil {
		h.logger.WithError(err).Error("Failed to get client for replicaset pods")
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	namespace := c.Param("namespace")
	name := c.Param("name")

	// Get the replicaset to find its labels
	replicaSet, err := client.AppsV1().ReplicaSets(namespace).Get(c.Request.Context(), name, metav1.GetOptions{})
	if err != nil {
		h.logger.WithError(err).WithField("replicaset", name).WithField("namespace", namespace).Error("Failed to get replicaset")
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	// Get pods that match the replicaset's selector
	podList, err := client.CoreV1().Pods(namespace).List(c.Request.Context(), metav1.ListOptions{
		LabelSelector: metav1.FormatLabelSelector(replicaSet.Spec.Selector),
	})
	if err != nil {
		h.logger.WithError(err).Error("Failed to list replicaset pods")
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	// Transform pods to the expected format
	var transformedPods []PodListResponse
	configID := c.Query("config")
	cluster := c.Query("cluster")
	for _, pod := range podList.Items {
		transformedPods = append(transformedPods, h.transformPodToResponse(&pod, configID, cluster))
	}

	// Check if this is an SSE request (EventSource expects SSE format)
	acceptHeader := c.GetHeader("Accept")
	if acceptHeader == "text/event-stream" {
		h.sendSSEResponse(c, transformedPods)
		return
	}

	c.JSON(http.StatusOK, transformedPods)
}

// GetReplicaSet returns details for a specific replicaset
func (h *ResourcesHandler) GetReplicaSet(c *gin.Context) {
	client, _, err := h.getClientAndConfig(c)
	if err != nil {
		h.logger.WithError(err).Error("Failed to get client for replicaset details")
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	namespace := c.Param("namespace")
	name := c.Param("name")

	replicaSet, err := client.AppsV1().ReplicaSets(namespace).Get(c.Request.Context(), name, metav1.GetOptions{})
	if err != nil {
		h.logger.WithError(err).WithField("replicaset", name).WithField("namespace", namespace).Error("Failed to get replicaset")
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	// Check if this is an SSE request (EventSource expects SSE format)
	acceptHeader := c.GetHeader("Accept")
	if acceptHeader == "text/event-stream" {
		h.sendSSEResponse(c, replicaSet)
		return
	}

	c.JSON(http.StatusOK, replicaSet)
}

// GetReplicaSetYAML returns the YAML representation of a specific replicaset
func (h *ResourcesHandler) GetReplicaSetYAML(c *gin.Context) {
	client, _, err := h.getClientAndConfig(c)
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

	// Convert to YAML
	yamlData, err := yaml.Marshal(replicaSet)
	if err != nil {
		h.logger.WithError(err).Error("Failed to marshal replicaset to YAML")
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

// GetReplicaSetEvents returns events for a specific replicaset
func (h *ResourcesHandler) GetReplicaSetEvents(c *gin.Context) {
	h.getResourceEvents(c, "ReplicaSet", c.Param("name"))
}
