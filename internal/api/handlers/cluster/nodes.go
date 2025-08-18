package cluster

import (
	"fmt"
	"net/http"
	"time"

	"github.com/Facets-cloud/kube-dash/internal/api/transformers"
	"github.com/Facets-cloud/kube-dash/internal/api/types"
	"github.com/Facets-cloud/kube-dash/internal/api/utils"
	"github.com/Facets-cloud/kube-dash/internal/k8s"
	"github.com/Facets-cloud/kube-dash/internal/storage"
	"github.com/Facets-cloud/kube-dash/internal/tracing"
	"github.com/Facets-cloud/kube-dash/pkg/logger"

	"github.com/gin-gonic/gin"
	authorizationv1 "k8s.io/api/authorization/v1"
	v1 "k8s.io/api/core/v1"
	policyv1 "k8s.io/api/policy/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	k8stypes "k8s.io/apimachinery/pkg/types"
	"k8s.io/client-go/kubernetes"
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

// NodesHandler handles node-related operations
type NodesHandler struct {
	store         *storage.KubeConfigStore
	clientFactory *k8s.ClientFactory
	logger        *logger.Logger
	sseHandler    *utils.SSEHandler
	yamlHandler   *utils.YAMLHandler
	eventsHandler *utils.EventsHandler
	tracingHelper *tracing.TracingHelper
}

// NewNodesHandler creates a new NodesHandler instance
func NewNodesHandler(store *storage.KubeConfigStore, clientFactory *k8s.ClientFactory, log *logger.Logger) *NodesHandler {
	return &NodesHandler{
		store:         store,
		clientFactory: clientFactory,
		logger:        log,
		sseHandler:    utils.NewSSEHandler(log),
		yamlHandler:   utils.NewYAMLHandler(log),
		eventsHandler: utils.NewEventsHandler(log),
		tracingHelper: tracing.GetTracingHelper(),
	}
}

// getClientAndConfig gets the Kubernetes client and config for the current request
func (h *NodesHandler) getClientAndConfig(c *gin.Context) (*kubernetes.Clientset, error) {
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

// transformNodeToResponse transforms a Kubernetes node to the frontend-expected format
func (h *NodesHandler) transformNodeToResponse(node *v1.Node) NodeListResponse {
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

// GetNodes returns all nodes
func (h *NodesHandler) GetNodes(c *gin.Context) {
	// Start child span for client setup
	ctx, clientSpan := h.tracingHelper.StartAuthSpan(c.Request.Context(), "get-client-config")
	defer clientSpan.End()

	client, err := h.getClientAndConfig(c)
	if err != nil {
		h.logger.WithError(err).Error("Failed to get client for nodes")
		h.tracingHelper.RecordError(clientSpan, err, "Failed to get Kubernetes client")
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	h.tracingHelper.RecordSuccess(clientSpan, "Successfully obtained Kubernetes client")

	// Start child span for Kubernetes API call
	_, k8sSpan := h.tracingHelper.StartKubernetesAPISpan(ctx, "list", "nodes", "")
	defer k8sSpan.End()

	nodes, err := client.CoreV1().Nodes().List(ctx, metav1.ListOptions{})
	if err != nil {
		h.logger.WithError(err).Error("Failed to list nodes")
		h.tracingHelper.RecordError(k8sSpan, err, "Failed to list nodes")
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	h.tracingHelper.RecordSuccess(k8sSpan, "Successfully listed nodes")
	h.tracingHelper.AddResourceAttributes(k8sSpan, "nodes", "node", len(nodes.Items))

	// Start child span for data transformation
	_, transformSpan := h.tracingHelper.StartDataProcessingSpan(ctx, "transform-nodes")
	defer transformSpan.End()

	// Transform nodes to frontend-expected format
	var response []NodeListResponse
	for _, node := range nodes.Items {
		response = append(response, h.transformNodeToResponse(&node))
	}
	h.tracingHelper.RecordSuccess(transformSpan, "Successfully transformed nodes data")
	h.tracingHelper.AddResourceAttributes(transformSpan, "transformed-nodes", "node", len(response))

	c.JSON(http.StatusOK, response)
}

// GetNodesSSE returns nodes as Server-Sent Events with real-time updates
func (h *NodesHandler) GetNodesSSE(c *gin.Context) {
	// Start child span for client setup
	_, clientSpan := h.tracingHelper.StartAuthSpan(c.Request.Context(), "setup-client-for-sse")
	defer clientSpan.End()

	client, err := h.getClientAndConfig(c)
	if err != nil {
		h.logger.WithError(err).Error("Failed to get client for nodes SSE")
		h.tracingHelper.RecordError(clientSpan, err, "Failed to get Kubernetes client for SSE")
		h.sseHandler.SendSSEError(c, http.StatusBadRequest, err.Error())
		return
	}
	h.tracingHelper.RecordSuccess(clientSpan, "Successfully obtained Kubernetes client for SSE")

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
		h.sseHandler.SendSSEResponseWithUpdates(c, initialData, fetchNodes)
		return
	}

	// For non-SSE requests, return JSON
	c.JSON(http.StatusOK, initialData)
}

// GetNode returns a specific node
func (h *NodesHandler) GetNode(c *gin.Context) {
	// Start child span for client setup
	ctx, clientSpan := h.tracingHelper.StartAuthSpan(c.Request.Context(), "get-client-config")
	defer clientSpan.End()

	client, err := h.getClientAndConfig(c)
	if err != nil {
		h.logger.WithError(err).Error("Failed to get client for node")
		h.tracingHelper.RecordError(clientSpan, err, "Failed to get Kubernetes client")
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	h.tracingHelper.RecordSuccess(clientSpan, "Successfully obtained Kubernetes client")

	name := c.Param("name")

	// Start child span for Kubernetes API call
	_, k8sSpan := h.tracingHelper.StartKubernetesAPISpan(ctx, "get", "node", "")
	defer k8sSpan.End()

	node, err := client.CoreV1().Nodes().Get(ctx, name, metav1.GetOptions{})
	if err != nil {
		h.logger.WithError(err).WithField("node", name).Error("Failed to get node")
		h.tracingHelper.RecordError(k8sSpan, err, "Failed to get node")
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}
	h.tracingHelper.RecordSuccess(k8sSpan, "Successfully retrieved node")
	h.tracingHelper.AddResourceAttributes(k8sSpan, name, "node", 1)

	// Check if this is an SSE request (EventSource expects SSE format)
	acceptHeader := c.GetHeader("Accept")
	if acceptHeader == "text/event-stream" {
		h.sseHandler.SendSSEResponse(c, node)
		return
	}

	c.JSON(http.StatusOK, node)
}

// GetNodeYAML returns the YAML representation of a specific node
func (h *NodesHandler) GetNodeYAML(c *gin.Context) {
	// Start child span for client setup
	ctx, clientSpan := h.tracingHelper.StartAuthSpan(c.Request.Context(), "get-client-config")
	defer clientSpan.End()

	client, err := h.getClientAndConfig(c)
	if err != nil {
		h.logger.WithError(err).Error("Failed to get client for node YAML")
		h.tracingHelper.RecordError(clientSpan, err, "Failed to get Kubernetes client")
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	h.tracingHelper.RecordSuccess(clientSpan, "Successfully obtained Kubernetes client")

	name := c.Param("name")

	// Start child span for Kubernetes API call
	_, k8sSpan := h.tracingHelper.StartKubernetesAPISpan(ctx, "get", "node", "")
	defer k8sSpan.End()

	node, err := client.CoreV1().Nodes().Get(ctx, name, metav1.GetOptions{})
	if err != nil {
		h.logger.WithError(err).WithField("node", name).Error("Failed to get node for YAML")
		h.tracingHelper.RecordError(k8sSpan, err, "Failed to get node for YAML")
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}
	h.tracingHelper.RecordSuccess(k8sSpan, "Successfully retrieved node for YAML")
	h.tracingHelper.AddResourceAttributes(k8sSpan, name, "node", 1)

	// Start child span for YAML generation
	_, yamlSpan := h.tracingHelper.StartDataProcessingSpan(ctx, "generate-yaml")
	defer yamlSpan.End()

	h.yamlHandler.SendYAMLResponse(c, node, name)
	h.tracingHelper.RecordSuccess(yamlSpan, "Successfully generated YAML response")
}

// GetNodeEvents returns events for a specific node
func (h *NodesHandler) GetNodeEvents(c *gin.Context) {
	// Start child span for client setup
	ctx, clientSpan := h.tracingHelper.StartAuthSpan(c.Request.Context(), "get-client-config")
	defer clientSpan.End()

	client, err := h.getClientAndConfig(c)
	if err != nil {
		h.logger.WithError(err).Error("Failed to get client for node events")
		h.tracingHelper.RecordError(clientSpan, err, "Failed to get Kubernetes client")
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	h.tracingHelper.RecordSuccess(clientSpan, "Successfully obtained Kubernetes client")

	name := c.Param("name")

	// Start child span for events retrieval
	_, eventsSpan := h.tracingHelper.StartKubernetesAPISpan(ctx, "list", "events", "")
	defer eventsSpan.End()

	h.eventsHandler.GetResourceEvents(c, client, "Node", name, h.sseHandler.SendSSEResponse)
	h.tracingHelper.RecordSuccess(eventsSpan, "Successfully retrieved node events")
	h.tracingHelper.AddResourceAttributes(eventsSpan, name, "events", 0)
}

// GetNodePods returns pods for a specific node with SSE support
func (h *NodesHandler) GetNodePods(c *gin.Context) {
	client, err := h.getClientAndConfig(c)
	if err != nil {
		h.logger.WithError(err).Error("Failed to get client for node pods")
		h.sseHandler.SendSSEError(c, http.StatusBadRequest, err.Error())
		return
	}

	nodeName := c.Param("name")
	configID := c.Query("config")
	cluster := c.Query("cluster")

	// Function to fetch and transform pods data for the specific node
	fetchNodePods := func() (interface{}, error) {
		// Get pods with field selector for the specific node
		podList, err := client.CoreV1().Pods("").List(c.Request.Context(), metav1.ListOptions{
			FieldSelector: fmt.Sprintf("spec.nodeName=%s", nodeName),
		})
		if err != nil {
			return nil, err
		}

		// Transform pods to frontend-expected format
		var response []types.PodListResponse
		for _, pod := range podList.Items {
			response = append(response, transformers.TransformPodToResponse(&pod, configID, cluster))
		}

		return response, nil
	}

	// Get initial data
	initialData, err := fetchNodePods()
	if err != nil {
		h.logger.WithError(err).WithField("node", nodeName).Error("Failed to list node pods for SSE")
		h.sseHandler.SendSSEError(c, http.StatusInternalServerError, err.Error())
		return
	}

	// Check if this is an SSE request (EventSource expects SSE format)
	acceptHeader := c.GetHeader("Accept")
	if acceptHeader == "text/event-stream" {
		// Send SSE response with periodic updates
		h.sseHandler.SendSSEResponseWithUpdates(c, initialData, fetchNodePods)
		return
	}

	// For non-SSE requests, return JSON
	c.JSON(http.StatusOK, initialData)
}

// NodeActionRequest represents the request format for node actions
type NodeActionRequest struct {
	Force              bool `json:"force"`
	IgnoreDaemonSets   bool `json:"ignoreDaemonSets"`
	DeleteEmptyDirData bool `json:"deleteEmptyDirData"`
	GracePeriod        int  `json:"gracePeriod"`
}

// CordonNode marks a node as unschedulable
func (h *NodesHandler) CordonNode(c *gin.Context) {
	// Start child span for client setup
	ctx, clientSpan := h.tracingHelper.StartAuthSpan(c.Request.Context(), "get-client-config")
	defer clientSpan.End()

	client, err := h.getClientAndConfig(c)
	if err != nil {
		h.logger.WithError(err).Error("Failed to get client for cordon node")
		h.tracingHelper.RecordError(clientSpan, err, "Failed to get Kubernetes client")
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	h.tracingHelper.RecordSuccess(clientSpan, "Successfully obtained Kubernetes client")

	name := c.Param("name")

	// Start child span for getting current node
	_, getSpan := h.tracingHelper.StartKubernetesAPISpan(ctx, "get", "node", "")
	defer getSpan.End()

	// Get the current node
	node, err := client.CoreV1().Nodes().Get(ctx, name, metav1.GetOptions{})
	if err != nil {
		h.logger.WithError(err).WithField("node", name).Error("Failed to get node for cordon")
		h.tracingHelper.RecordError(getSpan, err, "Failed to get node for cordon")
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}
	h.tracingHelper.RecordSuccess(getSpan, "Successfully retrieved node for cordon")
	h.tracingHelper.AddResourceAttributes(getSpan, name, "node", 1)

	// Check if node is already cordoned
	if node.Spec.Unschedulable {
		c.JSON(http.StatusOK, gin.H{"message": "Node is already cordoned"})
		return
	}

	// Start child span for patch operation
	_, patchSpan := h.tracingHelper.StartKubernetesAPISpan(ctx, "patch", "node", "")
	defer patchSpan.End()

	// Create a patch to mark the node as unschedulable
	patch := []byte(`{"spec":{"unschedulable":true}}`)

	_, err = client.CoreV1().Nodes().Patch(
		ctx,
		name,
		k8stypes.StrategicMergePatchType,
		patch,
		metav1.PatchOptions{},
	)
	if err != nil {
		h.logger.WithError(err).WithField("node", name).Error("Failed to cordon node")
		h.tracingHelper.RecordError(patchSpan, err, "Failed to cordon node")
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	h.tracingHelper.RecordSuccess(patchSpan, "Successfully cordoned node")
	h.tracingHelper.AddResourceAttributes(patchSpan, name, "node", 1)

	c.JSON(http.StatusOK, gin.H{"message": "Node cordoned successfully"})
}

// UncordonNode marks a node as schedulable
func (h *NodesHandler) UncordonNode(c *gin.Context) {
	client, err := h.getClientAndConfig(c)
	if err != nil {
		h.logger.WithError(err).Error("Failed to get client for uncordon node")
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	name := c.Param("name")

	// Get the current node
	node, err := client.CoreV1().Nodes().Get(c.Request.Context(), name, metav1.GetOptions{})
	if err != nil {
		h.logger.WithError(err).WithField("node", name).Error("Failed to get node for uncordon")
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	// Check if node is already uncordoned
	if !node.Spec.Unschedulable {
		c.JSON(http.StatusOK, gin.H{"message": "Node is already uncordoned"})
		return
	}

	// Create a patch to mark the node as schedulable
	patch := []byte(`{"spec":{"unschedulable":false}}`)

	_, err = client.CoreV1().Nodes().Patch(
		c.Request.Context(),
		name,
		k8stypes.StrategicMergePatchType,
		patch,
		metav1.PatchOptions{},
	)
	if err != nil {
		h.logger.WithError(err).WithField("node", name).Error("Failed to uncordon node")
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Node uncordoned successfully"})
}

// DrainNode evicts all pods from a node
func (h *NodesHandler) DrainNode(c *gin.Context) {
	client, err := h.getClientAndConfig(c)
	if err != nil {
		h.logger.WithError(err).Error("Failed to get client for drain node")
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	name := c.Param("name")

	// Parse request body for drain options
	var req NodeActionRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request body"})
		return
	}

	// Get the node (we need this to check if it exists)
	_, err = client.CoreV1().Nodes().Get(c.Request.Context(), name, metav1.GetOptions{})
	if err != nil {
		h.logger.WithError(err).WithField("node", name).Error("Failed to get node for drain")
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	// Get all pods on this node
	pods, err := client.CoreV1().Pods("").List(c.Request.Context(), metav1.ListOptions{
		FieldSelector: fmt.Sprintf("spec.nodeName=%s", name),
	})
	if err != nil {
		h.logger.WithError(err).WithField("node", name).Error("Failed to list pods for drain")
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	var evictedPods []string
	var failedPods []string

	// Evict each pod
	for _, pod := range pods.Items {
		// Skip daemon sets if ignoreDaemonSets is true
		if req.IgnoreDaemonSets && pod.OwnerReferences != nil {
			for _, owner := range pod.OwnerReferences {
				if owner.Kind == "DaemonSet" {
					continue
				}
			}
		}

		// Create eviction
		eviction := &policyv1.Eviction{
			ObjectMeta: metav1.ObjectMeta{
				Name:      pod.Name,
				Namespace: pod.Namespace,
			},
		}

		// Set grace period if specified
		if req.GracePeriod > 0 {
			gracePeriodSeconds := int64(req.GracePeriod)
			eviction.DeleteOptions = &metav1.DeleteOptions{
				GracePeriodSeconds: &gracePeriodSeconds,
			}
		}

		// Perform eviction
		err := client.CoreV1().Pods(pod.Namespace).EvictV1(c.Request.Context(), eviction)
		if err != nil {
			h.logger.WithError(err).WithField("node", name).WithField("pod", pod.Name).Error("Failed to evict pod")
			failedPods = append(failedPods, fmt.Sprintf("%s/%s", pod.Namespace, pod.Name))
		} else {
			evictedPods = append(evictedPods, fmt.Sprintf("%s/%s", pod.Namespace, pod.Name))
		}
	}

	// Mark node as unschedulable
	patch := []byte(`{"spec":{"unschedulable":true}}`)
	_, err = client.CoreV1().Nodes().Patch(
		c.Request.Context(),
		name,
		k8stypes.StrategicMergePatchType,
		patch,
		metav1.PatchOptions{},
	)
	if err != nil {
		h.logger.WithError(err).WithField("node", name).Error("Failed to mark node as unschedulable during drain")
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	response := gin.H{
		"message":      "Node drain completed",
		"evictedPods":  evictedPods,
		"failedPods":   failedPods,
		"totalPods":    len(pods.Items),
		"evictedCount": len(evictedPods),
		"failedCount":  len(failedPods),
	}

	if len(failedPods) > 0 {
		c.JSON(http.StatusPartialContent, response)
	} else {
		c.JSON(http.StatusOK, response)
	}
}

// CheckNodeActionPermission checks if the user has permission to perform node actions
func (h *NodesHandler) CheckNodeActionPermission(c *gin.Context) {
	client, err := h.getClientAndConfig(c)
	if err != nil {
		h.logger.WithError(err).Error("Failed to get client for node action permission check")
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	action := c.Query("action")
	nodeName := c.Query("nodeName")

	if action == "" || nodeName == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "action and nodeName parameters are required"})
		return
	}

	// Define required permissions for each action
	var requiredVerbs []string
	switch action {
	case "cordon", "uncordon":
		requiredVerbs = []string{"patch", "update"}
	case "drain":
		requiredVerbs = []string{"patch", "update", "delete"}
	default:
		c.JSON(http.StatusBadRequest, gin.H{"error": "unsupported action"})
		return
	}

	permissions := make(map[string]bool)

	for _, verb := range requiredVerbs {
		accessReview := &authorizationv1.SelfSubjectAccessReview{
			Spec: authorizationv1.SelfSubjectAccessReviewSpec{
				ResourceAttributes: &authorizationv1.ResourceAttributes{
					Group:    "",
					Resource: "nodes",
					Verb:     verb,
					Name:     nodeName,
				},
			},
		}

		result, err := client.AuthorizationV1().SelfSubjectAccessReviews().Create(c.Request.Context(), accessReview, metav1.CreateOptions{})
		if err != nil {
			h.logger.WithError(err).Errorf("Failed to check %s permission for node action", verb)
			c.JSON(http.StatusInternalServerError, gin.H{"error": fmt.Sprintf("failed to check %s permissions: %v", verb, err)})
			return
		}

		permissions[verb] = result.Status.Allowed
	}

	// For drain action, also check pod permissions
	if action == "drain" {
		podPermissions := make(map[string]bool)
		podVerbs := []string{"delete"}

		for _, verb := range podVerbs {
			accessReview := &authorizationv1.SelfSubjectAccessReview{
				Spec: authorizationv1.SelfSubjectAccessReviewSpec{
					ResourceAttributes: &authorizationv1.ResourceAttributes{
						Group:    "",
						Resource: "pods",
						Verb:     verb,
					},
				},
			}

			result, err := client.AuthorizationV1().SelfSubjectAccessReviews().Create(c.Request.Context(), accessReview, metav1.CreateOptions{})
			if err != nil {
				h.logger.WithError(err).Errorf("Failed to check %s permission for pods", verb)
				c.JSON(http.StatusInternalServerError, gin.H{"error": fmt.Sprintf("failed to check %s permissions for pods: %v", verb, err)})
				return
			}

			podPermissions[verb] = result.Status.Allowed
		}

		// User needs all permissions to drain
		canDrain := true
		for _, allowed := range permissions {
			if !allowed {
				canDrain = false
				break
			}
		}
		for _, allowed := range podPermissions {
			if !allowed {
				canDrain = false
				break
			}
		}

		c.JSON(http.StatusOK, gin.H{
			"allowed":        canDrain,
			"action":         action,
			"nodeName":       nodeName,
			"permissions":    permissions,
			"podPermissions": podPermissions,
		})
		return
	}

	// For cordon/uncordon, user needs all required permissions
	canPerform := true
	for _, allowed := range permissions {
		if !allowed {
			canPerform = false
			break
		}
	}

	c.JSON(http.StatusOK, gin.H{
		"allowed":     canPerform,
		"action":      action,
		"nodeName":    nodeName,
		"permissions": permissions,
	})
}
