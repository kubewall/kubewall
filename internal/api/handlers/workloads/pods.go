package workloads

import (
	"context"
	"fmt"
	"net/http"
	"strconv"
	"time"

	"github.com/Facets-cloud/kube-dash/internal/api/transformers"
	"github.com/Facets-cloud/kube-dash/internal/api/types"
	"github.com/Facets-cloud/kube-dash/internal/api/utils"
	"github.com/Facets-cloud/kube-dash/internal/k8s"
	"github.com/Facets-cloud/kube-dash/internal/storage"
	"github.com/Facets-cloud/kube-dash/internal/tracing"
	"github.com/Facets-cloud/kube-dash/pkg/logger"

	"github.com/gin-gonic/gin"
	v1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/client-go/kubernetes"
	metricsclient "k8s.io/metrics/pkg/client/clientset/versioned"
)

// Helper to check metrics availability
func (h *PodsHandler) getMetricsClient(c *gin.Context) (*metricsclient.Clientset, error) {
	configID := c.Query("config")
	cluster := c.Query("cluster")
	if configID == "" {
		return nil, fmt.Errorf("config parameter is required")
	}
	cfg, err := h.store.GetKubeConfig(configID)
	if err != nil {
		return nil, fmt.Errorf("config not found: %w", err)
	}
	return h.clientFactory.GetMetricsClientForConfig(cfg, cluster)
}

// formats millicores as string with m suffix
func formatCPU(milli int64) string {
	return fmt.Sprintf("%dm", milli)
}

// bytes to MiB integer string
func bytesToMiBString(bytes int64) string {
	if bytes <= 0 {
		return "0"
	}
	mib := bytes / (1024 * 1024)
	return strconv.FormatInt(mib, 10)
}

// PodsHandler handles all pod-related operations
type PodsHandler struct {
	store         *storage.KubeConfigStore
	clientFactory *k8s.ClientFactory
	logger        *logger.Logger
	sseHandler    *utils.SSEHandler
	yamlHandler   *utils.YAMLHandler
	eventsHandler *utils.EventsHandler
	tracingHelper *tracing.TracingHelper
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
		tracingHelper: tracing.GetTracingHelper(),
	}
}

// getClientAndConfig gets the Kubernetes client and config for the given config ID and cluster
func (h *PodsHandler) getClientAndConfig(c *gin.Context) (*kubernetes.Clientset, error) {
	return h.getClientAndConfigWithContext(c, c.Request.Context())
}

// getClientAndConfigWithContext gets the Kubernetes client and config with tracing context
func (h *PodsHandler) getClientAndConfigWithContext(c *gin.Context, ctx context.Context) (*kubernetes.Clientset, error) {
	configID := c.Query("config")
	cluster := c.Query("cluster")

	if configID == "" {
		return nil, fmt.Errorf("config parameter is required")
	}

	// Start child span for config retrieval
	_, configSpan := h.tracingHelper.StartDataProcessingSpan(ctx, "get-kubeconfig")
	defer configSpan.End()

	config, err := h.store.GetKubeConfig(configID)
	if err != nil {
		h.tracingHelper.RecordError(configSpan, err, "Failed to get kubeconfig")
		return nil, fmt.Errorf("config not found: %w", err)
	}
	h.tracingHelper.AddResourceAttributes(configSpan, configID, "kubeconfig", 1)
	h.tracingHelper.RecordSuccess(configSpan, fmt.Sprintf("Retrieved kubeconfig: %s", configID))

	// Use context-aware client factory method
	client, err := h.clientFactory.GetClientForConfigWithContext(ctx, config, cluster)
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
// @Summary Get Pods (SSE)
// @Description Get all pods with real-time updates via Server-Sent Events
// @Tags Workloads
// @Accept json
// @Produce text/event-stream
// @Param config query string true "Kubernetes configuration ID"
// @Param cluster query string false "Cluster name"
// @Param namespace query string false "Namespace filter"
// @Param node query string false "Node name filter"
// @Param owner query string false "Owner type (deployment, daemonset, etc.)"
// @Param ownerName query string false "Owner name"
// @Success 200 {array} types.PodListResponse "Stream of pod data"
// @Failure 400 {object} map[string]string "Bad request"
// @Failure 500 {object} map[string]string "Internal server error"
// @Security KubeConfig
// @Router /api/v1/pods [get]
func (h *PodsHandler) GetPodsSSE(c *gin.Context) {
	// Start child span for client setup with HTTP context
	ctx, clientSpan := h.tracingHelper.StartAuthSpanWithHTTP(c, "setup-client-for-sse")
	defer clientSpan.End()

	client, err := h.getClientAndConfigWithContext(c, ctx)
	if err != nil {
		h.logger.WithError(err).Error("Failed to get client for pods SSE")
		h.tracingHelper.RecordError(clientSpan, err, "Failed to get client for pods SSE")
		h.sseHandler.SendSSEError(c, http.StatusBadRequest, err.Error())
		return
	}
	h.tracingHelper.RecordSuccess(clientSpan, "Client setup completed for pods SSE")

	namespace := c.Query("namespace")
	node := c.Query("node")
	owner := c.Query("owner")
	ownerName := c.Query("ownerName")
	configID := c.Query("config")
	cluster := c.Query("cluster")

	// Try to create metrics client; if fails, we'll proceed without metrics
	var mClient *metricsclient.Clientset
	if mc, mErr := h.getMetricsClient(c); mErr == nil {
		mClient = mc
	}

	// Function to fetch and transform pods data
	fetchPods := func() (interface{}, error) {
		// Start child span for owner resolution
		fetchCtx, ownerSpan := h.tracingHelper.StartDataProcessingSpanWithHTTP(c, "resolve-owner-filters")
		defer ownerSpan.End()

		// Build list options with filters
		listOptions := metav1.ListOptions{}

		// If filtering by node, use field selector
		if node != "" {
			listOptions.FieldSelector = fmt.Sprintf("spec.nodeName=%s", node)
			h.tracingHelper.AddResourceAttributes(ownerSpan, node, "node-filter", 1)
		}

		// If filtering by owner (deployment, daemonset, etc.), we need to get the owner first
		if owner != "" && ownerName != "" && namespace != "" {
			switch owner {
			case "deployment":
				_, deploySpan := h.tracingHelper.StartKubernetesAPISpan(fetchCtx, "get", "deployment", namespace)
				deployment, err := client.AppsV1().Deployments(namespace).Get(fetchCtx, ownerName, metav1.GetOptions{})
				if err == nil {
					listOptions.LabelSelector = metav1.FormatLabelSelector(deployment.Spec.Selector)
					h.tracingHelper.RecordSuccess(deploySpan, "Retrieved deployment selector")
				} else {
					h.tracingHelper.RecordError(deploySpan, err, "Failed to get deployment")
				}
				deploySpan.End()
			case "daemonset":
				_, dsSpan := h.tracingHelper.StartKubernetesAPISpan(fetchCtx, "get", "daemonset", namespace)
				daemonSet, err := client.AppsV1().DaemonSets(namespace).Get(fetchCtx, ownerName, metav1.GetOptions{})
				if err == nil {
					listOptions.LabelSelector = metav1.FormatLabelSelector(daemonSet.Spec.Selector)
					h.tracingHelper.RecordSuccess(dsSpan, "Retrieved daemonset selector")
				} else {
					h.tracingHelper.RecordError(dsSpan, err, "Failed to get daemonset")
				}
				dsSpan.End()
			case "replicaset":
				_, rsSpan := h.tracingHelper.StartKubernetesAPISpan(fetchCtx, "get", "replicaset", namespace)
				replicaSet, err := client.AppsV1().ReplicaSets(namespace).Get(fetchCtx, ownerName, metav1.GetOptions{})
				if err == nil {
					listOptions.LabelSelector = metav1.FormatLabelSelector(replicaSet.Spec.Selector)
					h.tracingHelper.RecordSuccess(rsSpan, "Retrieved replicaset selector")
				} else {
					h.tracingHelper.RecordError(rsSpan, err, "Failed to get replicaset")
				}
				rsSpan.End()
			}
		}
		h.tracingHelper.RecordSuccess(ownerSpan, "Owner filters resolved")

		// Start child span for Kubernetes API call
		_, k8sSpan := h.tracingHelper.StartKubernetesAPISpan(fetchCtx, "list", "pods", namespace)
		defer k8sSpan.End()

		var podList *v1.PodList
		var err2 error

		if namespace != "" {
			podList, err2 = client.CoreV1().Pods(namespace).List(fetchCtx, listOptions)
		} else {
			podList, err2 = client.CoreV1().Pods("").List(fetchCtx, listOptions)
		}

		if err2 != nil {
			h.tracingHelper.RecordError(k8sSpan, err2, "Failed to list pods")
			return nil, err2
		}
		h.tracingHelper.AddResourceAttributes(k8sSpan, "pods", "list", len(podList.Items))
		h.tracingHelper.RecordSuccess(k8sSpan, fmt.Sprintf("Retrieved %d pods", len(podList.Items)))

		// Start child span for data transformation
		_, transformSpan := h.tracingHelper.StartDataProcessingSpan(fetchCtx, "transform-pods")
		defer transformSpan.End()

		// Transform pods to the expected format first (fast path)
		var transformedPods []types.PodListResponse
		for _, pod := range podList.Items {
			transformedPods = append(transformedPods, transformers.TransformPodToResponse(&pod, configID, cluster))
		}
		h.tracingHelper.AddResourceAttributes(transformSpan, "pods", "transform", len(transformedPods))
		h.tracingHelper.RecordSuccess(transformSpan, fmt.Sprintf("Transformed %d pods", len(transformedPods)))

		// Best-effort metrics overlay: single List call with short timeout; do not block initial response
		if mClient != nil {
			// Start child span for metrics collection
			_, metricsSpan := h.tracingHelper.StartMetricsSpan(fetchCtx, "collect-pod-metrics")
			defer metricsSpan.End()

			// Build a quick lookup for the current pods we have
			podSet := make(map[string]struct{}, len(transformedPods))
			for _, p := range transformedPods {
				key := p.Namespace + "/" + p.BaseResponse.Name
				podSet[key] = struct{}{}
			}

			// Use short timeout so we never block
			metricsCtx, cancel := context.WithTimeout(fetchCtx, 800*time.Millisecond)
			defer cancel()

			// Metrics API list per namespace or all namespaces
			// Use empty selector to avoid metrics-server field selector limitations
			metricsList, err := mClient.MetricsV1beta1().PodMetricses(namespace).List(metricsCtx, metav1.ListOptions{})
			if err == nil {
				// Aggregate metrics per pod
				type agg struct {
					cpuMilli int64
					memBytes int64
				}
				metricsMap := make(map[string]agg, len(metricsList.Items))
				for _, pm := range metricsList.Items {
					var cpuMilli int64
					var memBytes int64
					for _, cont := range pm.Containers {
						if cpuQty, ok := cont.Usage[v1.ResourceCPU]; ok {
							cpuMilli += cpuQty.MilliValue()
						}
						if memQty, ok := cont.Usage[v1.ResourceMemory]; ok {
							memBytes += memQty.Value()
						}
					}
					key := pm.Namespace + "/" + pm.Name
					if _, ok := podSet[key]; ok {
						metricsMap[key] = agg{cpuMilli: cpuMilli, memBytes: memBytes}
					}
				}

				// Start child span for metrics processing
				_, processSpan := h.tracingHelper.StartDataProcessingSpan(metricsCtx, "process-metrics")
				defer processSpan.End()

				// Overlay into transformed list
				metricsApplied := 0
				for i := range transformedPods {
					key := transformedPods[i].Namespace + "/" + transformedPods[i].BaseResponse.Name
					if v, ok := metricsMap[key]; ok {
						transformedPods[i].CPU = formatCPU(v.cpuMilli)
						transformedPods[i].Memory = bytesToMiBString(v.memBytes)
						metricsApplied++
					}
				}
				h.tracingHelper.AddResourceAttributes(processSpan, "metrics", "overlay", metricsApplied)
				h.tracingHelper.RecordSuccess(processSpan, fmt.Sprintf("Applied metrics to %d pods", metricsApplied))
				h.tracingHelper.AddResourceAttributes(metricsSpan, "pod-metrics", "collect", len(metricsList.Items))
				h.tracingHelper.RecordSuccess(metricsSpan, fmt.Sprintf("Collected metrics for %d pods", len(metricsList.Items)))
			} else {
				h.tracingHelper.RecordError(metricsSpan, err, "Failed to collect pod metrics")
			}
		}

		return transformedPods, nil
	}

	// Get initial data
	initialData, err := fetchPods()
	if err != nil {
		h.logger.WithError(err).Error("Failed to list pods for SSE")

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
	// Start child span for client setup
	ctx, clientSpan := h.tracingHelper.StartAuthSpan(c.Request.Context(), "get-client-config")
	defer clientSpan.End()

	client, err := h.getClientAndConfig(c)
	if err != nil {
		h.logger.WithError(err).Error("Failed to get client for pod")
		h.tracingHelper.RecordError(clientSpan, err, "Failed to get Kubernetes client")
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	h.tracingHelper.RecordSuccess(clientSpan, "Kubernetes client obtained")

	name := c.Param("name")
	namespace := c.Param("namespace")

	// Start child span for Kubernetes API call
	_, k8sSpan := h.tracingHelper.StartKubernetesAPISpan(ctx, "get", "pod", namespace)
	defer k8sSpan.End()

	pod, err := client.CoreV1().Pods(namespace).Get(ctx, name, metav1.GetOptions{})
	if err != nil {
		h.logger.WithError(err).WithField("pod", name).WithField("namespace", namespace).Error("Failed to get pod")
		h.tracingHelper.RecordError(k8sSpan, err, "Failed to get pod")
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}
	h.tracingHelper.AddResourceAttributes(k8sSpan, name, "pod", 1)
	h.tracingHelper.RecordSuccess(k8sSpan, fmt.Sprintf("Retrieved pod %s", name))

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



// GetPodMetricsHistory streams recent pod metrics as SSE (best-effort, only if metrics server is available)
func (h *PodsHandler) GetPodMetricsHistory(c *gin.Context) {
	name := c.Param("name")
	namespace := c.Param("namespace")

	// Attempt to get metrics client
	mClient, err := h.getMetricsClient(c)
	if err != nil {
		h.sseHandler.SendSSEError(c, http.StatusNotFound, fmt.Sprintf("metrics not available: %v", err))
		return
	}

	// Build fetch function: best we can do is poll current usage periodically to form a timeline client-side
	fetch := func() (interface{}, error) {
		m, err := mClient.MetricsV1beta1().PodMetricses(namespace).Get(c.Request.Context(), name, metav1.GetOptions{})
		if err != nil {
			return nil, err
		}
		var totalCPUMilli int64
		var totalMemBytes int64
		for _, cont := range m.Containers {
			if cpuQty, ok := cont.Usage[v1.ResourceCPU]; ok {
				totalCPUMilli += cpuQty.MilliValue()
			}
			if memQty, ok := cont.Usage[v1.ResourceMemory]; ok {
				totalMemBytes += memQty.Value()
			}
		}
		point := types.PodMetricsPoint{
			Timestamp: time.Now().UTC().Format(time.RFC3339),
			CPU:       formatCPU(totalCPUMilli),
			Memory:    bytesToMiBString(totalMemBytes),
		}
		// send a single point; frontend accumulates
		return point, nil
	}

	// Prime one sample, then periodic updates
	initial, err := fetch()
	if err != nil {
		h.sseHandler.SendSSEError(c, http.StatusInternalServerError, err.Error())
		return
	}
	h.sseHandler.SendSSEResponseWithUpdates(c, initial, fetch)
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
