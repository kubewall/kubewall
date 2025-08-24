package metrics

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/Facets-cloud/kube-dash/internal/api/utils"
	"github.com/Facets-cloud/kube-dash/internal/k8s"
	"github.com/Facets-cloud/kube-dash/internal/storage"
	"github.com/Facets-cloud/kube-dash/internal/tracing"
	"github.com/Facets-cloud/kube-dash/pkg/logger"

	"github.com/gin-gonic/gin"
	v1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/client-go/kubernetes"
)

// CacheEntry represents a cached item with expiration
type CacheEntry struct {
	Data      interface{}
	ExpiresAt time.Time
}

// PrometheusHandler provides endpoints for Prometheus-backed metrics
type PrometheusHandler struct {
	store         *storage.KubeConfigStore
	clientFactory *k8s.ClientFactory
	logger        *logger.Logger
	sseHandler    *utils.SSEHandler
	tracingHelper *tracing.TracingHelper

	// Cache for metrics operations
	cache    map[string]CacheEntry
	cacheMux sync.RWMutex
	cacheTTL time.Duration
}

// NewPrometheusHandler creates a new Prometheus metrics handler
func NewPrometheusHandler(store *storage.KubeConfigStore, clientFactory *k8s.ClientFactory, log *logger.Logger) *PrometheusHandler {
	return &PrometheusHandler{
		store:         store,
		clientFactory: clientFactory,
		logger:        log,
		sseHandler:    utils.NewSSEHandler(log),
		tracingHelper: tracing.GetTracingHelper(),
		cache:         make(map[string]CacheEntry),
		cacheTTL:      5 * time.Minute, // 5 minute cache TTL for metrics
	}
}

// getCacheKey generates a cache key for the given parameters
func (h *PrometheusHandler) getCacheKey(operation string, configID, cluster, nodeName, rng, step string) string {
	return fmt.Sprintf("%s:%s:%s:%s:%s:%s", operation, configID, cluster, nodeName, rng, step)
}

// getFromCache retrieves data from cache if it exists and is not expired
func (h *PrometheusHandler) getFromCache(key string) (interface{}, bool) {
	h.cacheMux.RLock()
	defer h.cacheMux.RUnlock()

	if entry, exists := h.cache[key]; exists && time.Now().Before(entry.ExpiresAt) {
		return entry.Data, true
	}
	return nil, false
}

// setCache stores data in cache with TTL
func (h *PrometheusHandler) setCache(key string, data interface{}, ttl time.Duration) {
	h.cacheMux.Lock()
	defer h.cacheMux.Unlock()

	h.cache[key] = CacheEntry{
		Data:      data,
		ExpiresAt: time.Now().Add(ttl),
	}
}

// clearExpiredCache removes expired cache entries
func (h *PrometheusHandler) clearExpiredCache() {
	h.cacheMux.Lock()
	defer h.cacheMux.Unlock()

	now := time.Now()
	for key, entry := range h.cache {
		if now.After(entry.ExpiresAt) {
			delete(h.cache, key)
		}
	}
}

// getClient returns a Kubernetes client for the given config and cluster
func (h *PrometheusHandler) getClient(c *gin.Context) (*kubernetes.Clientset, error) {
	configID := c.Query("config")
	cluster := c.Query("cluster")
	if configID == "" {
		return nil, fmt.Errorf("config parameter is required")
	}
	cfg, err := h.store.GetKubeConfig(configID)
	if err != nil {
		return nil, fmt.Errorf("config not found: %w", err)
	}
	client, err := h.clientFactory.GetClientForConfig(cfg, cluster)
	if err != nil {
		return nil, fmt.Errorf("failed to get Kubernetes client: %w", err)
	}
	return client, nil
}

type promTarget struct {
	Namespace string
	Pod       string
	Port      int
	// Service-based target (optional)
	Service   string
	PortName  string
	IsService bool
}

// discoverPrometheus attempts to find a running Prometheus pod and port in the cluster
func (h *PrometheusHandler) discoverPrometheus(ctx context.Context, client *kubernetes.Clientset) (*promTarget, error) {
	// First, simplified path: look for pods with the canonical label
	labeledPods, err := client.CoreV1().Pods("").List(ctx, metav1.ListOptions{LabelSelector: "app.kubernetes.io/name=prometheus"})
	if err == nil {
		for _, p := range labeledPods.Items {
			// Ensure running
			if p.Status.Phase != v1.PodRunning {
				continue
			}
			// Pick first matching port (9090 or any name containing 'web')
			port := 0
			for _, c := range p.Spec.Containers {
				for _, cp := range c.Ports {
					if cp.ContainerPort == 9090 || strings.Contains(strings.ToLower(cp.Name), "web") {
						port = int(cp.ContainerPort)
						if port == 0 {
							port = 9090
						}
						break
					}
				}
			}
			if port == 0 {
				port = 9090
			}
			// Verify target
			if h.verifyPrometheus(ctx, client, p.Namespace, p.Name, port) == nil {
				return &promTarget{Namespace: p.Namespace, Pod: p.Name, Port: port}, nil
			}
		}
	}

	// Fallbacks: previous heuristics
	// Prefer common namespaces first
	namespaces := []string{"default", "monitoring", "observability", "prometheus"}
	// Helper to check a pod if it looks like Prometheus
	isPromPod := func(pod *v1.Pod) (bool, int) {
		if pod == nil || pod.Status.Phase != v1.PodRunning {
			return false, 0
		}
		for _, c := range pod.Spec.Containers {
			nameLower := strings.ToLower(c.Name)
			imageLower := strings.ToLower(c.Image)
			if (strings.Contains(nameLower, "prometheus") || strings.Contains(imageLower, "prometheus")) &&
				!strings.Contains(nameLower, "operator") && !strings.Contains(imageLower, "operator") {
				// Find port 9090 or named with 'web'
				port := 0
				for _, cp := range c.Ports {
					if cp.ContainerPort == 9090 || strings.Contains(strings.ToLower(cp.Name), "web") {
						port = int(cp.ContainerPort)
						if port == 0 {
							port = 9090
						}
						break
					}
				}
				if port == 0 {
					// Default common Prometheus port
					port = 9090
				}
				return true, port
			}
		}
		return false, 0
	}

	// Try preferred namespaces
	for _, ns := range namespaces {
		pods, err := client.CoreV1().Pods(ns).List(ctx, metav1.ListOptions{})
		if err == nil {
			for _, p := range pods.Items {
				ok, port := isPromPod(&p)
				if ok {
					// Verify
					if h.verifyPrometheus(ctx, client, ns, p.Name, port) == nil {
						return &promTarget{Namespace: ns, Pod: p.Name, Port: port}, nil
					}
				}
			}
		}
	}

	// Fallback: scan all namespaces but stop early
	pods, err := client.CoreV1().Pods("").List(ctx, metav1.ListOptions{})
	if err != nil {
		return nil, fmt.Errorf("failed to list pods for discovery: %w", err)
	}
	for _, p := range pods.Items {
		ok, port := isPromPod(&p)
		if ok {
			if h.verifyPrometheus(ctx, client, p.Namespace, p.Name, port) == nil {
				return &promTarget{Namespace: p.Namespace, Pod: p.Name, Port: port}, nil
			}
		}
	}

	// Try service-based discovery as a fallback
	if svcTarget, err := h.discoverPrometheusViaService(ctx, client); err == nil {
		return svcTarget, nil
	}

	return nil, fmt.Errorf("prometheus not found")
}

// verifyPrometheus calls /api/v1/status/buildinfo via pod proxy to confirm target
func (h *PrometheusHandler) verifyPrometheus(ctx context.Context, client *kubernetes.Clientset, namespace, pod string, port int) error {
	// GET /api/v1/status/buildinfo
	raw, err := client.CoreV1().RESTClient().Get().
		Namespace(namespace).
		Resource("pods").
		Name(pod).
		SubResource("proxy").
		Suffix("api/v1/status/buildinfo").
		Param("port", fmt.Sprintf("%d", port)).
		DoRaw(ctx)
	if err != nil {
		return err
	}
	var resp map[string]interface{}
	if err := json.Unmarshal(raw, &resp); err != nil {
		return err
	}
	if status, ok := resp["status"].(string); !ok || status != "success" {
		return fmt.Errorf("prometheus status not success")
	}
	return nil
}

// proxyPrometheus performs a GET call against the Prometheus HTTP API via pod/service proxy
func (h *PrometheusHandler) proxyPrometheus(ctx context.Context, client *kubernetes.Clientset, target *promTarget, path string, params map[string]string) ([]byte, error) {
	req := client.CoreV1().RESTClient().Get().
		Namespace(target.Namespace)
	// Choose pod or service proxy
	if target.IsService {
		req = req.Resource("services").
			Name(target.Service).
			SubResource("proxy").
			Suffix(strings.TrimPrefix(path, "/"))
		if target.PortName != "" {
			req = req.Param("port", target.PortName)
		} else if target.Port != 0 {
			req = req.Param("port", fmt.Sprintf("%d", target.Port))
		}
	} else {
		req = req.Resource("pods").
			Name(target.Pod).
			SubResource("proxy").
			Suffix(strings.TrimPrefix(path, "/")).
			Param("port", fmt.Sprintf("%d", target.Port))
	}
	for k, v := range params {
		req = req.Param(k, v)
	}
	return req.DoRaw(ctx)
}

// discoverPrometheusViaService finds a Prometheus Service by common names/labels/ports and verifies it
func (h *PrometheusHandler) discoverPrometheusViaService(ctx context.Context, client *kubernetes.Clientset) (*promTarget, error) {
	svcs, err := client.CoreV1().Services("").List(ctx, metav1.ListOptions{})
	if err != nil {
		return nil, err
	}
	type cand struct {
		ns, name, portName string
		port               int
	}
	var candidates []cand
	for _, s := range svcs.Items {
		nameLower := strings.ToLower(s.Name)
		lbl := strings.ToLower(s.Labels["app.kubernetes.io/name"])
		comp := strings.ToLower(s.Labels["app.kubernetes.io/component"])
		if !(strings.Contains(nameLower, "prometheus") || lbl == "prometheus" || comp == "prometheus") {
			continue
		}
		for _, p := range s.Spec.Ports {
			portNameLower := strings.ToLower(p.Name)
			if p.Port == 9090 || strings.Contains(portNameLower, "web") || strings.Contains(portNameLower, "prom") || strings.Contains(portNameLower, "http") {
				candidates = append(candidates, cand{ns: s.Namespace, name: s.Name, portName: p.Name, port: int(p.Port)})
			}
		}
	}
	for _, c := range candidates {
		if err := h.verifyPrometheusService(ctx, client, c.ns, c.name, c.portName, c.port); err == nil {
			return &promTarget{Namespace: c.ns, Service: c.name, PortName: c.portName, Port: c.port, IsService: true}, nil
		}
	}
	return nil, fmt.Errorf("prometheus service not found")
}

// verifyPrometheusService calls buildinfo via the Service proxy
func (h *PrometheusHandler) verifyPrometheusService(ctx context.Context, client *kubernetes.Clientset, namespace, svcName, portName string, port int) error {
	req := client.CoreV1().RESTClient().Get().
		Namespace(namespace).
		Resource("services").
		Name(svcName).
		SubResource("proxy").
		Suffix("api/v1/status/buildinfo")
	if portName != "" {
		req = req.Param("port", portName)
	} else if port != 0 {
		req = req.Param("port", fmt.Sprintf("%d", port))
	}
	raw, err := req.DoRaw(ctx)
	if err != nil {
		return err
	}
	var resp map[string]interface{}
	if err := json.Unmarshal(raw, &resp); err != nil {
		return err
	}
	if status, ok := resp["status"].(string); !ok || status != "success" {
		return fmt.Errorf("prometheus status not success")
	}
	return nil
}

// GetAvailability returns whether Prometheus is installed and reachable
// @Summary Check Prometheus availability
// @Description Checks if Prometheus is installed and reachable in the cluster
// @Tags Metrics
// @Accept json
// @Produce json
// @Param config query string true "Kubernetes config ID"
// @Param cluster query string false "Cluster name"
// @Success 200 {object} map[string]interface{} "Prometheus availability status"
// @Failure 400 {object} map[string]string "Bad request"
// @Security BearerAuth
// @Security KubeConfig
// @Router /api/v1/metrics/prometheus/availability [get]
func (h *PrometheusHandler) GetAvailability(c *gin.Context) {
	client, err := h.getClient(c)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"installed": false, "reachable": false, "error": err.Error()})
		return
	}
	ctx, cancel := context.WithTimeout(c.Request.Context(), 3*time.Second)
	defer cancel()

	// Try full discovery (verifies Prometheus is reachable and healthy)
	target, err := h.discoverPrometheus(ctx, client)
	if err == nil && target != nil {
		resp := gin.H{
			"installed": true,
			"reachable": true,
			"namespace": target.Namespace,
			"port":      target.Port,
		}
		if target.IsService {
			resp["service"] = target.Service
			if target.PortName != "" {
				resp["portName"] = target.PortName
			}
		} else {
			resp["pod"] = target.Pod
		}
		c.JSON(http.StatusOK, resp)
		return
	}

	// If discovery failed, perform a lightweight presence check to
	// differentiate "installed but unreachable" from "not installed".
	present := false
	// Look for any pods with canonical prometheus labels
	if pods, errPods := client.CoreV1().Pods("").List(ctx, metav1.ListOptions{LabelSelector: "app.kubernetes.io/name=prometheus"}); errPods == nil && len(pods.Items) > 0 {
		present = true
	}
	// If not found via label, try services with common labels/names
	if !present {
		if svcs, errSvcs := client.CoreV1().Services("").List(ctx, metav1.ListOptions{}); errSvcs == nil {
			for _, s := range svcs.Items {
				nameLower := strings.ToLower(s.Name)
				lbl := strings.ToLower(s.Labels["app.kubernetes.io/name"])
				comp := strings.ToLower(s.Labels["app.kubernetes.io/component"])
				if strings.Contains(nameLower, "prometheus") || lbl == "prometheus" || comp == "prometheus" {
					present = true
					break
				}
			}
		}
	}
	// Fallback: scan pods for containers/images named like prometheus (excluding operator)
	if !present {
		if pods, errPods := client.CoreV1().Pods("").List(ctx, metav1.ListOptions{}); errPods == nil {
			for _, p := range pods.Items {
				for _, ctn := range p.Spec.Containers {
					nameLower := strings.ToLower(ctn.Name)
					imageLower := strings.ToLower(ctn.Image)
					if (strings.Contains(nameLower, "prometheus") || strings.Contains(imageLower, "prometheus")) &&
						!strings.Contains(nameLower, "operator") && !strings.Contains(imageLower, "operator") {
						present = true
						break
					}
				}
				if present {
					break
				}
			}
		}
	}

	if present {
		c.JSON(http.StatusOK, gin.H{"installed": true, "reachable": false, "reason": "prometheus detected but unreachable"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"installed": false, "reachable": false})
}

// ---------- Helpers for Prometheus responses ----------

type promQueryRangeResponse struct {
	Status string `json:"status"`
	Data   struct {
		ResultType string                 `json:"resultType"`
		Result     []promQueryRangeResult `json:"result"`
	} `json:"data"`
}

type promQueryRangeResult struct {
	Metric map[string]string `json:"metric"`
	Values [][]interface{}   `json:"values"` // [ [ <unix>, "value" ], ... ]
}

type timePoint struct {
	T float64 `json:"t"`
	V float64 `json:"v"`
}

type series struct {
	Metric string      `json:"metric"`
	Points []timePoint `json:"points"`
}

// parseMatrix converts Prometheus matrix data into a simplified series list (first series only per metric)
func parseMatrix(raw []byte) ([]series, error) {
	var resp promQueryRangeResponse
	if err := json.Unmarshal(raw, &resp); err != nil {
		return nil, err
	}
	if resp.Status != "success" {
		return nil, fmt.Errorf("prometheus query failed")
	}
	out := []series{}
	for _, r := range resp.Data.Result {
		// Compose a readable metric label
		label := r.Metric["__name__"]
		if label == "" {
			label = "series"
		}
		pts := make([]timePoint, 0, len(r.Values))
		for _, pair := range r.Values {
			if len(pair) != 2 {
				continue
			}
			// pair[0] = timestamp (float)
			// pair[1] = value (string)
			tsFloat := 0.0
			switch t := pair[0].(type) {
			case float64:
				tsFloat = t
			case json.Number:
				if v, err := t.Float64(); err == nil {
					tsFloat = v
				}
			}
			valStr := fmt.Sprintf("%v", pair[1])
			// Parse as float
			v, err := parseFloat(valStr)
			if err != nil {
				continue
			}
			pts = append(pts, timePoint{T: tsFloat, V: v})
		}
		out = append(out, series{Metric: label, Points: pts})
	}
	return out, nil
}

func parseFloat(s string) (float64, error) {
	if s == "NaN" || s == "+Inf" || s == "-Inf" {
		return 0, nil
	}
	return strconvParseFloat(s)
}

// small wrapper to avoid importing strconv at multiple locations
func strconvParseFloat(s string) (float64, error) { return json.Number(s).Float64() }

// ---------- Pod metrics ----------

// GetPodMetricsSSE streams Prometheus-based pod metrics as SSE
// @Summary Get pod metrics with real-time updates
// @Description Streams Prometheus-based pod metrics (CPU, memory, network) via Server-Sent Events
// @Tags Metrics
// @Accept json
// @Produce text/event-stream
// @Produce json
// @Param config query string true "Kubernetes config ID"
// @Param cluster query string false "Cluster name"
// @Param namespace path string true "Namespace name"
// @Param name path string true "Pod name"
// @Param range query string false "Time range for metrics" default(15m)
// @Param step query string false "Step interval for metrics" default(15s)
// @Success 200 {object} map[string]interface{} "Stream of pod metrics"
// @Failure 400 {object} map[string]string "Bad request"
// @Failure 404 {object} map[string]string "Prometheus not available"
// @Security BearerAuth
// @Security KubeConfig
// @Router /api/v1/metrics/pods/{namespace}/{name}/sse [get]
func (h *PrometheusHandler) GetPodMetricsSSE(c *gin.Context) {
	// Start child span for client setup
	ctx, clientSpan := h.tracingHelper.StartAuthSpan(c.Request.Context(), "get-client-config")
	defer clientSpan.End()

	client, err := h.getClient(c)
	if err != nil {
		h.tracingHelper.RecordError(clientSpan, err, "Failed to get Kubernetes client")
		h.sseHandler.SendSSEError(c, http.StatusBadRequest, err.Error())
		return
	}
	h.tracingHelper.RecordSuccess(clientSpan, "Successfully obtained Kubernetes client")

	namespace := c.Param("namespace")
	name := c.Param("name")
	rng := c.DefaultQuery("range", "15m")
	step := c.DefaultQuery("step", "15s")

	// Start child span for Prometheus discovery
	discoveryCtx, discoverySpan := h.tracingHelper.StartKubernetesAPISpan(ctx, "discover", "prometheus", "")
	defer discoverySpan.End()

	timeoutCtx, cancel := context.WithTimeout(discoveryCtx, 4*time.Second)
	defer cancel()
	target, err := h.discoverPrometheus(timeoutCtx, client)
	if err != nil {
		h.tracingHelper.RecordError(discoverySpan, err, "Failed to discover Prometheus")
		h.sseHandler.SendSSEError(c, http.StatusNotFound, "prometheus not available")
		return
	}
	h.tracingHelper.RecordSuccess(discoverySpan, "Successfully discovered Prometheus target")

	// Build queries
	// CPU mcores
	qCPU := fmt.Sprintf("1000 * sum by (namespace,pod) (rate(container_cpu_usage_seconds_total{namespace=\"%s\",pod=\"%s\",container!~\"POD|istio-proxy|istio-init\"}[5m]))", escapeLabelValue(namespace), escapeLabelValue(name))
	// Memory working set bytes
	qMEM := fmt.Sprintf("sum by (namespace,pod) (container_memory_working_set_bytes{namespace=\"%s\",pod=\"%s\",container!~\"POD|istio-proxy|istio-init\"})", escapeLabelValue(namespace), escapeLabelValue(name))
	// Network RX/TX (best-effort; may be missing)
	qRX := fmt.Sprintf("sum by (namespace,pod) (rate(container_network_receive_bytes_total{namespace=\"%s\",pod=\"%s\"}[5m]))", escapeLabelValue(namespace), escapeLabelValue(name))
	qTX := fmt.Sprintf("sum by (namespace,pod) (rate(container_network_transmit_bytes_total{namespace=\"%s\",pod=\"%s\"}[5m]))", escapeLabelValue(namespace), escapeLabelValue(name))

	fetch := func() (interface{}, error) {
		// Start child span for metrics query execution
		queryCtx, querySpan := h.tracingHelper.StartMetricsSpan(ctx, "execute-prometheus-queries")
		defer querySpan.End()

		now := time.Now()
		start := now.Add(-parsePromRange(rng))
		params := map[string]string{
			"query": qCPU,
			"start": fmt.Sprintf("%d", start.Unix()),
			"end":   fmt.Sprintf("%d", now.Unix()),
			"step":  step,
		}

		// CPU Query
		_, cpuQuerySpan := h.tracingHelper.StartMetricsSpan(queryCtx, "query-cpu-metrics")
		cpuRaw, err := h.proxyPrometheus(queryCtx, client, target, "/api/v1/query_range", params)
		if err != nil {
			h.tracingHelper.RecordError(cpuQuerySpan, err, "CPU metrics query failed")
			cpuQuerySpan.End()
			return nil, err
		}
		h.tracingHelper.RecordSuccess(cpuQuerySpan, "CPU metrics query completed")
		cpuQuerySpan.End()
		cpuSeries, _ := parseMatrix(cpuRaw)

		// MEM Query
		_, memQuerySpan := h.tracingHelper.StartMetricsSpan(queryCtx, "query-memory-metrics")
		params["query"] = qMEM
		memRaw, err := h.proxyPrometheus(queryCtx, client, target, "/api/v1/query_range", params)
		if err != nil {
			h.tracingHelper.RecordError(memQuerySpan, err, "Memory metrics query failed")
			memQuerySpan.End()
			return nil, err
		}
		h.tracingHelper.RecordSuccess(memQuerySpan, "Memory metrics query completed")
		memQuerySpan.End()
		memSeries, _ := parseMatrix(memRaw)

		// RX Query
		_, rxQuerySpan := h.tracingHelper.StartMetricsSpan(queryCtx, "query-network-rx-metrics")
		params["query"] = qRX
		rxRaw, _ := h.proxyPrometheus(queryCtx, client, target, "/api/v1/query_range", params)
		h.tracingHelper.RecordSuccess(rxQuerySpan, "Network RX metrics query completed")
		rxQuerySpan.End()
		rxSeries, _ := parseMatrix(rxRaw)

		// TX Query
		_, txQuerySpan := h.tracingHelper.StartMetricsSpan(queryCtx, "query-network-tx-metrics")
		params["query"] = qTX
		txRaw, _ := h.proxyPrometheus(queryCtx, client, target, "/api/v1/query_range", params)
		h.tracingHelper.RecordSuccess(txQuerySpan, "Network TX metrics query completed")
		txQuerySpan.End()
		txSeries, _ := parseMatrix(txRaw)

		h.tracingHelper.RecordSuccess(querySpan, "All Prometheus queries completed successfully")
		payload := gin.H{
			"series": append(append(cpuSeries, memSeries...), append(rxSeries, txSeries...)...),
		}
		return payload, nil
	}

	initial, err := fetch()
	if err != nil {
		h.sseHandler.SendSSEError(c, http.StatusInternalServerError, err.Error())
		return
	}
	h.sseHandler.SendSSEResponseWithUpdates(c, initial, fetch)
}

// GetPodEnhancedMetricsSSE streams enhanced Prometheus-based pod metrics with CPU average/maximum and memory usage
func (h *PrometheusHandler) GetPodEnhancedMetricsSSE(c *gin.Context) {
	// Start child span for client setup
	ctx, clientSpan := h.tracingHelper.StartAuthSpan(c.Request.Context(), "get-client-config")
	defer clientSpan.End()

	client, err := h.getClient(c)
	if err != nil {
		h.tracingHelper.RecordError(clientSpan, err, "Failed to get Kubernetes client")
		h.sseHandler.SendSSEError(c, http.StatusBadRequest, err.Error())
		return
	}
	h.tracingHelper.RecordSuccess(clientSpan, "Successfully obtained Kubernetes client")

	namespace := c.Param("namespace")
	name := c.Param("name")
	rng := c.DefaultQuery("range", "15m")
	step := c.DefaultQuery("step", "15s")

	// Scale timeout based on range duration for longer queries
	timeoutDuration := 4 * time.Second
	rangeDuration := parsePromRange(rng)
	if rangeDuration >= 7*24*time.Hour { // 7+ days
		timeoutDuration = 15 * time.Second
	} else if rangeDuration >= 24*time.Hour { // 1+ day
		timeoutDuration = 10 * time.Second
	}

	// Start child span for Prometheus discovery
	discoveryCtx, discoverySpan := h.tracingHelper.StartKubernetesAPISpan(ctx, "discover", "prometheus", "")
	defer discoverySpan.End()

	timeoutCtx, cancel := context.WithTimeout(discoveryCtx, timeoutDuration)
	defer cancel()
	target, err := h.discoverPrometheus(timeoutCtx, client)
	if err != nil {
		h.tracingHelper.RecordError(discoverySpan, err, "Failed to discover Prometheus")
		h.sseHandler.SendSSEError(c, http.StatusNotFound, "prometheus not available")
		return
	}
	h.tracingHelper.RecordSuccess(discoverySpan, "Successfully discovered Prometheus target")

	// Start child span for pod resource fetching
	resourceCtx, resourceSpan := h.tracingHelper.StartKubernetesAPISpan(ctx, "get", "pod", namespace)
	defer resourceSpan.End()

	// Get pod resource limits and requests from Kubernetes API
	pod, err := client.CoreV1().Pods(namespace).Get(resourceCtx, name, metav1.GetOptions{})
	if err != nil {
		h.logger.Error("Failed to get pod details", "error", err, "namespace", namespace, "name", name)
		h.tracingHelper.RecordError(resourceSpan, err, "Failed to get pod resource details")
	} else {
		h.tracingHelper.RecordSuccess(resourceSpan, "Successfully retrieved pod resource details")
	}

	// Extract resource limits and requests
	var cpuLimit, cpuRequest, memoryLimit, memoryRequest float64
	if pod != nil {
		for _, container := range pod.Spec.Containers {
			if container.Resources.Limits != nil {
				if cpuLimitQuantity, ok := container.Resources.Limits["cpu"]; ok {
					cpuLimit += float64(cpuLimitQuantity.MilliValue())
				}
				if memLimitQuantity, ok := container.Resources.Limits["memory"]; ok {
					memoryLimit += float64(memLimitQuantity.Value())
				}
			}
			if container.Resources.Requests != nil {
				if cpuReqQuantity, ok := container.Resources.Requests["cpu"]; ok {
					cpuRequest += float64(cpuReqQuantity.MilliValue())
				}
				if memReqQuantity, ok := container.Resources.Requests["memory"]; ok {
					memoryRequest += float64(memReqQuantity.Value())
				}
			}
		}
	}

	// Build enhanced queries as specified in requirements
	// CPU Average Usage (millicores)
	qCPUAvg := fmt.Sprintf(`avg(rate(container_cpu_usage_seconds_total{namespace=~"%s",endpoint="https-metrics",pod=~"%s",image!="", container!="POD"}[2m])* 1000)`, escapeLabelValue(namespace), escapeLabelValue(name))
	// CPU Maximum Usage (millicores)
	qCPUMax := fmt.Sprintf(`max(rate(container_cpu_usage_seconds_total{namespace=~"%s",endpoint="https-metrics",pod=~"%s",image!="", container!="POD"}[2m])* 1000)`, escapeLabelValue(namespace), escapeLabelValue(name))
	// Memory Usage (bytes) - using usage_bytes to match Grafana queries and prevent false limit violations
	qMemUsage := fmt.Sprintf(`sum(container_memory_usage_bytes{namespace=~"%s",endpoint="https-metrics",pod=~"%s",image!="",container!="POD"})`, escapeLabelValue(namespace), escapeLabelValue(name))

	fetch := func() (interface{}, error) {
		// Start child span for enhanced metrics query execution
		queryCtx, querySpan := h.tracingHelper.StartMetricsSpan(ctx, "execute-enhanced-prometheus-queries")
		defer querySpan.End()

		now := time.Now()
		rangeDuration := parsePromRange(rng)
		start := now.Add(-rangeDuration)
		params := map[string]string{
			"start": fmt.Sprintf("%d", start.Unix()),
			"end":   fmt.Sprintf("%d", now.Unix()),
			"step":  step,
		}

		// Debug logging for time range calculations
		h.logger.Info("Pod metrics query debug",
			"range", rng,
			"rangeDuration", rangeDuration.String(),
			"startTime", start.Format("2006-01-02 15:04:05"),
			"endTime", now.Format("2006-01-02 15:04:05"),
			"step", step,
			"timeout", timeoutDuration.String())

		// CPU Average Query
		_, cpuAvgQuerySpan := h.tracingHelper.StartMetricsSpan(queryCtx, "query-cpu-average-metrics")
		params["query"] = qCPUAvg
		h.logger.Info("Executing CPU Average query", "query", qCPUAvg, "params", params)
		cpuAvgRaw, err := h.proxyPrometheus(queryCtx, client, target, "/api/v1/query_range", params)
		if err != nil {
			h.logger.Error("CPU Average query failed", "error", err, "query", qCPUAvg)
			h.tracingHelper.RecordError(cpuAvgQuerySpan, err, "CPU Average metrics query failed")
			cpuAvgQuerySpan.End()
			return nil, err
		}
		h.tracingHelper.RecordSuccess(cpuAvgQuerySpan, "CPU Average metrics query completed")
		cpuAvgQuerySpan.End()
		cpuAvgSeries, _ := parseMatrix(cpuAvgRaw)
		for i := range cpuAvgSeries {
			cpuAvgSeries[i].Metric = "cpu_average"
		}
		h.logger.Info("CPU Average query result", "seriesCount", len(cpuAvgSeries), "dataPoints", func() int {
			if len(cpuAvgSeries) > 0 { return len(cpuAvgSeries[0].Points) }
			return 0
		}())
		// Log actual data time range
		if len(cpuAvgSeries) > 0 && len(cpuAvgSeries[0].Points) > 0 {
			firstPoint := cpuAvgSeries[0].Points[0]
			lastPoint := cpuAvgSeries[0].Points[len(cpuAvgSeries[0].Points)-1]
			h.logger.Info("CPU data time range",
				"firstDataPoint", time.Unix(int64(firstPoint.T), 0).Format("2006-01-02 15:04:05"),
				"lastDataPoint", time.Unix(int64(lastPoint.T), 0).Format("2006-01-02 15:04:05"))
		}

		// CPU Maximum Query
		_, cpuMaxQuerySpan := h.tracingHelper.StartMetricsSpan(queryCtx, "query-cpu-maximum-metrics")
		params["query"] = qCPUMax
		cpuMaxRaw, err := h.proxyPrometheus(queryCtx, client, target, "/api/v1/query_range", params)
		if err != nil {
			h.logger.Error("CPU Maximum query failed", "error", err, "query", qCPUMax)
			h.tracingHelper.RecordError(cpuMaxQuerySpan, err, "CPU Maximum metrics query failed")
			cpuMaxQuerySpan.End()
			return nil, err
		}
		h.tracingHelper.RecordSuccess(cpuMaxQuerySpan, "CPU Maximum metrics query completed")
		cpuMaxQuerySpan.End()
		cpuMaxSeries, _ := parseMatrix(cpuMaxRaw)
		for i := range cpuMaxSeries {
			cpuMaxSeries[i].Metric = "cpu_maximum"
		}

		// Memory Usage Query
		_, memUsageQuerySpan := h.tracingHelper.StartMetricsSpan(queryCtx, "query-memory-usage-metrics")
		params["query"] = qMemUsage
		h.logger.Info("Executing Memory Usage query", "query", qMemUsage, "params", params)
		memUsageRaw, err := h.proxyPrometheus(queryCtx, client, target, "/api/v1/query_range", params)
		if err != nil {
			h.logger.Error("Memory Usage query failed", "error", err, "query", qMemUsage)
			h.tracingHelper.RecordError(memUsageQuerySpan, err, "Memory Usage metrics query failed")
			memUsageQuerySpan.End()
			return nil, err
		}
		h.tracingHelper.RecordSuccess(memUsageQuerySpan, "Memory Usage metrics query completed")
		memUsageQuerySpan.End()
		memUsageSeries, _ := parseMatrix(memUsageRaw)
		for i := range memUsageSeries {
			memUsageSeries[i].Metric = "memory_usage"
		}
		h.logger.Info("Memory Usage query result", "seriesCount", len(memUsageSeries), "dataPoints", func() int {
			if len(memUsageSeries) > 0 { return len(memUsageSeries[0].Points) }
			return 0
		}())
		// Log actual data time range
		if len(memUsageSeries) > 0 && len(memUsageSeries[0].Points) > 0 {
			firstPoint := memUsageSeries[0].Points[0]
			lastPoint := memUsageSeries[0].Points[len(memUsageSeries[0].Points)-1]
			h.logger.Info("Memory data time range",
				"firstDataPoint", time.Unix(int64(firstPoint.T), 0).Format("2006-01-02 15:04:05"),
				"lastDataPoint", time.Unix(int64(lastPoint.T), 0).Format("2006-01-02 15:04:05"))
		}

		// VPA Recommendations (instant queries)
		var vpaRecommendations gin.H
		
		// VPA CPU Target Recommendation - start with generic query
		qVPACPUTarget := fmt.Sprintf(`max by (container) (kube_verticalpodautoscaler_status_recommendation_containerrecommendations_target{resource="cpu",unit="core",namespace="%s"})`, escapeLabelValue(namespace))
		h.logger.Info("VPA CPU Target query:", "query", qVPACPUTarget)
		if vpaCPUTargetRaw, err := h.proxyPrometheus(c.Request.Context(), client, target, "/api/v1/query", map[string]string{"query": qVPACPUTarget}); err == nil {
			h.logger.Info("VPA CPU Target raw response:", "response", string(vpaCPUTargetRaw))
			if cpuTarget, err := parseVectorSum(vpaCPUTargetRaw); err == nil && cpuTarget > 0 {
				if vpaRecommendations == nil {
					vpaRecommendations = gin.H{}
				}
				vpaRecommendations["cpu_target"] = cpuTarget * 1000 // Convert to millicores
				h.logger.Info("VPA CPU Target found:", "value", cpuTarget*1000)
			} else {
				h.logger.Info("VPA CPU Target parse result:", "cpuTarget", cpuTarget, "parseError", err)
			}
		} else {
			h.logger.Error("VPA CPU Target query failed:", "error", err)
			// Try even more generic query without unit filter
			qVPACPUTargetAlt := fmt.Sprintf(`max by (container) (kube_verticalpodautoscaler_status_recommendation_containerrecommendations_target{resource="cpu",namespace="%s"})`, escapeLabelValue(namespace))
			h.logger.Info("VPA CPU Target alternative query:", "query", qVPACPUTargetAlt)
			if vpaCPUTargetRaw, err := h.proxyPrometheus(c.Request.Context(), client, target, "/api/v1/query", map[string]string{"query": qVPACPUTargetAlt}); err == nil {
				h.logger.Info("VPA CPU Target alt raw response:", "response", string(vpaCPUTargetRaw))
				if cpuTarget, err := parseVectorSum(vpaCPUTargetRaw); err == nil && cpuTarget > 0 {
					if vpaRecommendations == nil {
						vpaRecommendations = gin.H{}
					}
					vpaRecommendations["cpu_target"] = cpuTarget * 1000
					h.logger.Info("VPA CPU Target found (alt):", "value", cpuTarget*1000)
				} else {
					h.logger.Info("VPA CPU Target alt parse result:", "cpuTarget", cpuTarget, "parseError", err)
				}
			} else {
				h.logger.Error("VPA CPU Target alternative query failed:", "error", err)
			}
		}
		
		// VPA CPU Upperbound Recommendation
		qVPACPUUpperbound := fmt.Sprintf(`max(kube_verticalpodautoscaler_status_recommendation_containerrecommendations_upperbound{resource="cpu",namespace="%s"} * 1000)`, escapeLabelValue(namespace))
		h.logger.Info("VPA CPU Upperbound query:", "query", qVPACPUUpperbound)
		if vpaCPUUpperRaw, err := h.proxyPrometheus(c.Request.Context(), client, target, "/api/v1/query", map[string]string{"query": qVPACPUUpperbound}); err == nil {
			h.logger.Info("VPA CPU Upperbound raw response:", "response", string(vpaCPUUpperRaw))
			if cpuUpper, err := parseVectorSum(vpaCPUUpperRaw); err == nil && cpuUpper > 0 {
				if vpaRecommendations == nil {
					vpaRecommendations = gin.H{}
				}
				vpaRecommendations["cpu_upperbound"] = cpuUpper
				h.logger.Info("VPA CPU Upperbound found:", "value", cpuUpper)
			} else {
				h.logger.Info("VPA CPU Upperbound parse result:", "cpuUpper", cpuUpper, "parseError", err)
			}
		} else {
			h.logger.Error("VPA CPU Upperbound query failed:", "error", err)
		}
		
		// VPA Memory Target Recommendation - start with generic query
		qVPAMemTarget := fmt.Sprintf(`max by (container) (kube_verticalpodautoscaler_status_recommendation_containerrecommendations_target{resource="memory",unit="byte",namespace="%s"})`, escapeLabelValue(namespace))
		h.logger.Info("VPA Memory Target query:", "query", qVPAMemTarget)
		if vpaMemTargetRaw, err := h.proxyPrometheus(c.Request.Context(), client, target, "/api/v1/query", map[string]string{"query": qVPAMemTarget}); err == nil {
			h.logger.Info("VPA Memory Target raw response:", "response", string(vpaMemTargetRaw))
			if memTarget, err := parseVectorSum(vpaMemTargetRaw); err == nil && memTarget > 0 {
				if vpaRecommendations == nil {
					vpaRecommendations = gin.H{}
				}
				vpaRecommendations["memory_target"] = memTarget
				h.logger.Info("VPA Memory Target found:", "value", memTarget)
			} else {
				h.logger.Info("VPA Memory Target parse result:", "memTarget", memTarget, "parseError", err)
			}
		} else {
			h.logger.Error("VPA Memory Target query failed:", "error", err)
			// Try even more generic query without unit filter
			qVPAMemTargetAlt := fmt.Sprintf(`max by (container) (kube_verticalpodautoscaler_status_recommendation_containerrecommendations_target{resource="memory",namespace="%s"})`, escapeLabelValue(namespace))
			h.logger.Info("VPA Memory Target alternative query:", "query", qVPAMemTargetAlt)
			if vpaMemTargetRaw, err := h.proxyPrometheus(c.Request.Context(), client, target, "/api/v1/query", map[string]string{"query": qVPAMemTargetAlt}); err == nil {
				h.logger.Info("VPA Memory Target alt raw response:", "response", string(vpaMemTargetRaw))
				if memTarget, err := parseVectorSum(vpaMemTargetRaw); err == nil && memTarget > 0 {
					if vpaRecommendations == nil {
						vpaRecommendations = gin.H{}
					}
					vpaRecommendations["memory_target"] = memTarget
					h.logger.Info("VPA Memory Target found (alt):", "value", memTarget)
				} else {
					h.logger.Info("VPA Memory Target alt parse result:", "memTarget", memTarget, "parseError", err)
				}
			} else {
				h.logger.Error("VPA Memory Target alternative query failed:", "error", err)
			}
		}
		
		// VPA Memory Upperbound Recommendation
		qVPAMemUpperbound := fmt.Sprintf(`max(kube_verticalpodautoscaler_status_recommendation_containerrecommendations_upperbound{resource="memory",namespace="%s"})`, escapeLabelValue(namespace))
		h.logger.Info("VPA Memory Upperbound query:", "query", qVPAMemUpperbound)
		if vpaMemUpperRaw, err := h.proxyPrometheus(c.Request.Context(), client, target, "/api/v1/query", map[string]string{"query": qVPAMemUpperbound}); err == nil {
			h.logger.Info("VPA Memory Upperbound raw response:", "response", string(vpaMemUpperRaw))
			if memUpper, err := parseVectorSum(vpaMemUpperRaw); err == nil && memUpper > 0 {
				if vpaRecommendations == nil {
					vpaRecommendations = gin.H{}
				}
				vpaRecommendations["memory_upperbound"] = memUpper
				h.logger.Info("VPA Memory Upperbound found:", "value", memUpper)
			} else {
				h.logger.Info("VPA Memory Upperbound parse result:", "memUpper", memUpper, "parseError", err)
			}
		} else {
			h.logger.Error("VPA Memory Upperbound query failed:", "error", err)
		}

		// Combine all series
		allSeries := append(cpuAvgSeries, cpuMaxSeries...)
		allSeries = append(allSeries, memUsageSeries...)

		// Log final payload summary
		totalDataPoints := 0
		for _, series := range allSeries {
			totalDataPoints += len(series.Points)
		}
		h.logger.Info("Final payload summary",
			"totalSeries", len(allSeries),
			"totalDataPoints", totalDataPoints,
			"cpuSeriesCount", len(cpuAvgSeries)+len(cpuMaxSeries),
			"memorySeriesCount", len(memUsageSeries))

		payload := gin.H{
			"series": allSeries,
			"limits": gin.H{
				"cpu":    cpuLimit,
				"memory": memoryLimit,
			},
			"requests": gin.H{
				"cpu":    cpuRequest,
				"memory": memoryRequest,
			},
		}
		
		// Add VPA recommendations if available
		if vpaRecommendations != nil {
			payload["vpa_recommendations"] = vpaRecommendations
			h.logger.Info("VPA recommendations added to payload:", "recommendations", vpaRecommendations)
		} else {
			h.logger.Info("No VPA recommendations found for pod:", "namespace", namespace, "name", name)
		}
		return payload, nil
	}

	initial, err := fetch()
	if err != nil {
		h.sseHandler.SendSSEError(c, http.StatusInternalServerError, err.Error())
		return
	}
	h.sseHandler.SendSSEResponseWithUpdates(c, initial, fetch)
}

// ---------- Node metrics ----------

// GetNodeMetricsSSE streams Prometheus-based node metrics as SSE
func (h *PrometheusHandler) GetNodeMetricsSSE(c *gin.Context) {
	client, err := h.getClient(c)
	if err != nil {
		h.sseHandler.SendSSEError(c, http.StatusBadRequest, err.Error())
		return
	}
	nodeName := c.Param("name")
	rng := c.DefaultQuery("range", "15m")
	step := c.DefaultQuery("step", "15s")
	configID := c.Query("config")
	cluster := c.Query("cluster")

	// Clear expired cache entries periodically
	h.clearExpiredCache()

	// Generate cache key for this specific node metrics request
	cacheKey := h.getCacheKey("node_metrics", configID, cluster, nodeName, rng, step)

	ctx, cancel := context.WithTimeout(c.Request.Context(), 4*time.Second)
	defer cancel()
	target, err := h.discoverPrometheus(ctx, client)
	if err != nil {
		h.sseHandler.SendSSEError(c, http.StatusNotFound, "prometheus not available")
		return
	}

	// Enhanced PromQL queries for comprehensive node metrics
	// Use simple node-based queries that match the working pods pattern
	
	// 1. Node Summary - CPU and Memory Utilization (requested ratios)
	qCPUUtilization := fmt.Sprintf(`sum(kube_pod_container_resource_requests{resource="cpu", node="%s"}) / kube_node_status_allocatable{resource="cpu", node="%s"}`, escapeLabelValue(nodeName), escapeLabelValue(nodeName))
	qMemoryUtilization := fmt.Sprintf(`sum(kube_pod_container_resource_requests{resource="memory", node="%s"}) / kube_node_status_allocatable{resource="memory", node="%s"}`, escapeLabelValue(nodeName), escapeLabelValue(nodeName))

	// 2. Node Disk Usage - try multiple approaches
	// First try: simple aggregation without joins (may return data from all nodes)
	qDiskUsed := `sum(node_filesystem_size_bytes{job="node-exporter"} - node_filesystem_avail_bytes{job="node-exporter"})`
	qDiskAvailable := `sum(node_filesystem_avail_bytes{job="node-exporter"})`

	// 3. Node Memory Usage Breakdown - simple queries without joins
	qMemoryUsed := `sum(node_memory_MemTotal_bytes{job="node-exporter"} - node_memory_MemFree_bytes{job="node-exporter"} - node_memory_Buffers_bytes{job="node-exporter"} - node_memory_Cached_bytes{job="node-exporter"})`
	qMemoryBuffered := `sum(node_memory_Buffers_bytes{job="node-exporter"})`
	qMemoryCached := `sum(node_memory_Cached_bytes{job="node-exporter"})`
	qMemoryFree := `sum(node_memory_MemFree_bytes{job="node-exporter"})`

	// 4. Node CPU Usage (Aggregated) - simple query
	qCPUAggregated := `100 * (1 - avg(rate(node_cpu_seconds_total{job="node-exporter", mode="idle"}[5m])))`

	// Legacy queries for backward compatibility - use same nodeSel pattern
	nodeSel := fmt.Sprintf(`on(instance) group_left(nodename) node_uname_info{nodename="%s"}`, escapeLabelValue(nodeName))

	// Legacy queries for backward compatibility
	qCPU := fmt.Sprintf(`100 * (sum by (instance) (rate(node_cpu_seconds_total{mode!="idle",mode!="iowait",mode!="steal"}[5m])) / sum by (instance) (rate(node_cpu_seconds_total[5m]))) * %s`, nodeSel)
	qMEM := fmt.Sprintf(`100 * (1 - (node_memory_MemAvailable_bytes{job="node-exporter"} / node_memory_MemTotal_bytes{job="node-exporter"})) * %s`, nodeSel)
	qFS := fmt.Sprintf(`100 * (1 - (node_filesystem_avail_bytes{fstype!~"tmpfs|overlay",mountpoint="/"} / node_filesystem_size_bytes{fstype!~"tmpfs|overlay",mountpoint="/"})) * %s`, nodeSel)
	qRX := fmt.Sprintf(`sum by (instance) (rate(node_network_receive_bytes_total{name!~"lo"}[5m])) * %s`, nodeSel)
	qTX := fmt.Sprintf(`sum by (instance) (rate(node_network_transmit_bytes_total{name!~"lo"}[5m])) * %s`, nodeSel)

	// Instant: pods used/capacity
	qPodsCap := fmt.Sprintf(`max by (node) (kube_node_status_capacity{resource="pods",node="%s"})`, escapeLabelValue(nodeName))
	qPodsUsed := fmt.Sprintf(`max by (node) (kubelet_running_pod_count{node="%s"})`, escapeLabelValue(nodeName))

	fetch := func() (interface{}, error) {
		// Check cache first
		if cachedData, found := h.getFromCache(cacheKey); found {
			h.logger.Debug("Returning cached node metrics", "node", nodeName, "range", rng)
			return cachedData, nil
		}

		now := time.Now()
		start := now.Add(-parsePromRange(rng))
		params := map[string]string{
			"start": fmt.Sprintf("%d", start.Unix()),
			"end":   fmt.Sprintf("%d", now.Unix()),
			"step":  step,
		}

		// Enhanced metrics queries with error handling and fallbacks
		// 1. Node Summary - CPU and Memory Utilization (time series)
		var cpuUtilSeries, memUtilSeries []series
		
		// Debug: Log the actual queries being sent
		h.logger.Info("Node metrics queries:", "cpu_util", qCPUUtilization, "mem_util", qMemoryUtilization)
		
		// Try CPU utilization query
		params["query"] = qCPUUtilization
		if cpuUtilRaw, err := h.proxyPrometheus(c.Request.Context(), client, target, "/api/v1/query_range", params); err == nil {
			if series, err := parseMatrix(cpuUtilRaw); err == nil && len(series) > 0 {
				for i := range series {
					series[i].Metric = "cpu_utilization_ratio"
				}
				cpuUtilSeries = series
			} else {
				// Fallback: try simpler CPU query without node filtering
				fallbackCPU := `sum(kube_pod_container_resource_requests{resource="cpu"}) / sum(kube_node_status_allocatable{resource="cpu"})`
				h.logger.Info("Trying CPU fallback query:", "query", fallbackCPU)
				params["query"] = fallbackCPU
				if fallbackRaw, err := h.proxyPrometheus(c.Request.Context(), client, target, "/api/v1/query_range", params); err == nil {
					if series, err := parseMatrix(fallbackRaw); err == nil {
						for i := range series {
							series[i].Metric = "cpu_utilization_ratio"
						}
						cpuUtilSeries = series
					}
				}
			}
		} else {
			h.logger.Error("CPU utilization query failed", "error", err, "query", qCPUUtilization)
		}

		// Try Memory utilization query
		params["query"] = qMemoryUtilization
		if memUtilRaw, err := h.proxyPrometheus(c.Request.Context(), client, target, "/api/v1/query_range", params); err == nil {
			if series, err := parseMatrix(memUtilRaw); err == nil && len(series) > 0 {
				for i := range series {
					series[i].Metric = "memory_utilization_ratio"
				}
				memUtilSeries = series
			} else {
				// Fallback: try simpler memory query without node filtering
				fallbackMem := `sum(kube_pod_container_resource_requests{resource="memory"}) / sum(kube_node_status_allocatable{resource="memory"})`
				h.logger.Info("Trying memory fallback query:", "query", fallbackMem)
				params["query"] = fallbackMem
				if fallbackRaw, err := h.proxyPrometheus(c.Request.Context(), client, target, "/api/v1/query_range", params); err == nil {
					if series, err := parseMatrix(fallbackRaw); err == nil {
						for i := range series {
							series[i].Metric = "memory_utilization_ratio"
						}
						memUtilSeries = series
					}
				}
			}
		} else {
			h.logger.Error("Memory utilization query failed", "error", err, "query", qMemoryUtilization)
		}

		// 2. Node Disk Usage (time series) with fallbacks
		var diskUsedSeries, diskAvailSeries []series
		
		h.logger.Info("Disk usage queries:", "used", qDiskUsed, "available", qDiskAvailable)
		
		// Try disk used query
		params["query"] = qDiskUsed
		if diskUsedRaw, err := h.proxyPrometheus(c.Request.Context(), client, target, "/api/v1/query_range", params); err == nil {
			if series, err := parseMatrix(diskUsedRaw); err == nil && len(series) > 0 {
				for i := range series {
					series[i].Metric = "disk_used_bytes"
				}
				diskUsedSeries = series
			} else {
				// Fallback: try alternative disk used query
				fallbackDiskUsed := `sum(node_filesystem_size_bytes{job="node-exporter"}) - sum(node_filesystem_free_bytes{job="node-exporter"})`
				h.logger.Info("Trying disk used fallback query:", "query", fallbackDiskUsed)
				params["query"] = fallbackDiskUsed
				if fallbackRaw, err := h.proxyPrometheus(c.Request.Context(), client, target, "/api/v1/query_range", params); err == nil {
					if series, err := parseMatrix(fallbackRaw); err == nil {
						for i := range series {
							series[i].Metric = "disk_used_bytes"
						}
						diskUsedSeries = series
					}
				}
			}
		} else {
			h.logger.Error("Disk used query failed", "error", err, "query", qDiskUsed)
		}

		// Try disk available query
		params["query"] = qDiskAvailable
		if diskAvailRaw, err := h.proxyPrometheus(c.Request.Context(), client, target, "/api/v1/query_range", params); err == nil {
			if series, err := parseMatrix(diskAvailRaw); err == nil && len(series) > 0 {
				for i := range series {
					series[i].Metric = "disk_available_bytes"
				}
				diskAvailSeries = series
			} else {
				// Fallback: try alternative disk available query
				fallbackDiskAvail := `sum(node_filesystem_free_bytes{job="node-exporter"})`
				h.logger.Info("Trying disk available fallback query:", "query", fallbackDiskAvail)
				params["query"] = fallbackDiskAvail
				if fallbackRaw, err := h.proxyPrometheus(c.Request.Context(), client, target, "/api/v1/query_range", params); err == nil {
					if series, err := parseMatrix(fallbackRaw); err == nil {
						for i := range series {
							series[i].Metric = "disk_available_bytes"
						}
						diskAvailSeries = series
					}
				}
			}
		} else {
			h.logger.Error("Disk available query failed", "error", err, "query", qDiskAvailable)
		}

		// 3. Memory Usage Breakdown (time series)
		var memUsedSeries, memBufferedSeries, memCachedSeries, memFreeSeries []series
		
		h.logger.Info("Memory breakdown queries:", "used", qMemoryUsed, "buffered", qMemoryBuffered)
		
		params["query"] = qMemoryUsed
		if memUsedRaw, err := h.proxyPrometheus(c.Request.Context(), client, target, "/api/v1/query_range", params); err == nil {
			if series, err := parseMatrix(memUsedRaw); err == nil {
				for i := range series {
					series[i].Metric = "memory_used_bytes"
				}
				memUsedSeries = series
			}
		} else {
			h.logger.Error("Memory used query failed", "error", err, "query", qMemoryUsed)
		}

		params["query"] = qMemoryBuffered
		if memBufferedRaw, err := h.proxyPrometheus(c.Request.Context(), client, target, "/api/v1/query_range", params); err == nil {
			if series, err := parseMatrix(memBufferedRaw); err == nil {
				for i := range series {
					series[i].Metric = "memory_buffered_bytes"
				}
				memBufferedSeries = series
			}
		} else {
			h.logger.Error("Memory buffered query failed", "error", err, "query", qMemoryBuffered)
		}

		params["query"] = qMemoryCached
		if memCachedRaw, err := h.proxyPrometheus(c.Request.Context(), client, target, "/api/v1/query_range", params); err == nil {
			if series, err := parseMatrix(memCachedRaw); err == nil {
				for i := range series {
					series[i].Metric = "memory_cached_bytes"
				}
				memCachedSeries = series
			}
		} else {
			h.logger.Error("Memory cached query failed", "error", err, "query", qMemoryCached)
		}

		params["query"] = qMemoryFree
		if memFreeRaw, err := h.proxyPrometheus(c.Request.Context(), client, target, "/api/v1/query_range", params); err == nil {
			if series, err := parseMatrix(memFreeRaw); err == nil {
				for i := range series {
					series[i].Metric = "memory_free_bytes"
				}
				memFreeSeries = series
			}
		} else {
			h.logger.Error("Memory free query failed", "error", err, "query", qMemoryFree)
		}

		// 4. CPU Usage Aggregated (time series)
		var cpuAggSeries []series
		
		h.logger.Info("CPU aggregated query:", "query", qCPUAggregated)
		
		params["query"] = qCPUAggregated
		if cpuAggRaw, err := h.proxyPrometheus(c.Request.Context(), client, target, "/api/v1/query_range", params); err == nil {
			if series, err := parseMatrix(cpuAggRaw); err == nil {
				for i := range series {
					series[i].Metric = "cpu_usage_aggregated"
				}
				cpuAggSeries = series
			}
		} else {
			h.logger.Error("CPU aggregated query failed", "error", err, "query", qCPUAggregated)
		}

		// Legacy metrics for backward compatibility
		h.logger.Info("Legacy queries:", "cpu", qCPU, "mem", qMEM, "fs", qFS)
		
		params["query"] = qCPU
		cpuRaw, err := h.proxyPrometheus(c.Request.Context(), client, target, "/api/v1/query_range", params)
		if err != nil {
			h.logger.Error("Legacy CPU query failed", "error", err, "query", qCPU)
			return nil, err
		}
		cpuSeries, _ := parseMatrix(cpuRaw)

		params["query"] = qMEM
		memRaw, err := h.proxyPrometheus(c.Request.Context(), client, target, "/api/v1/query_range", params)
		if err != nil {
			h.logger.Error("Legacy Memory query failed", "error", err, "query", qMEM)
			return nil, err
		}
		memSeries, _ := parseMatrix(memRaw)

		params["query"] = qFS
		fsRaw, _ := h.proxyPrometheus(c.Request.Context(), client, target, "/api/v1/query_range", params)
		fsSeries, _ := parseMatrix(fsRaw)

		params["query"] = qRX
		rxRaw, _ := h.proxyPrometheus(c.Request.Context(), client, target, "/api/v1/query_range", params)
		rxSeries, _ := parseMatrix(rxRaw)

		params["query"] = qTX
		txRaw, _ := h.proxyPrometheus(c.Request.Context(), client, target, "/api/v1/query_range", params)
		txSeries, _ := parseMatrix(txRaw)

		// Instant values for current metrics
		instantMetrics := gin.H{}
		
		// Pods used/capacity
		pods := gin.H{"used": nil, "capacity": nil}
		capRaw, err := h.proxyPrometheus(c.Request.Context(), client, target, "/api/v1/query", map[string]string{"query": qPodsCap})
		if err == nil {
			pods["capacity"] = capRaw
		}
		usedRaw, err := h.proxyPrometheus(c.Request.Context(), client, target, "/api/v1/query", map[string]string{"query": qPodsUsed})
		if err == nil {
			pods["used"] = usedRaw
		}
		instantMetrics["pods"] = pods

		// Instant values for enhanced metrics with error handling
		if cpuUtilInstant, err := h.proxyPrometheus(c.Request.Context(), client, target, "/api/v1/query", map[string]string{"query": qCPUUtilization}); err == nil {
			instantMetrics["cpu_utilization"] = cpuUtilInstant
		}

		if memUtilInstant, err := h.proxyPrometheus(c.Request.Context(), client, target, "/api/v1/query", map[string]string{"query": qMemoryUtilization}); err == nil {
			instantMetrics["memory_utilization"] = memUtilInstant
		}

		if diskUsedInstant, err := h.proxyPrometheus(c.Request.Context(), client, target, "/api/v1/query", map[string]string{"query": qDiskUsed}); err == nil {
			instantMetrics["disk_used"] = diskUsedInstant
		}

		if diskAvailInstant, err := h.proxyPrometheus(c.Request.Context(), client, target, "/api/v1/query", map[string]string{"query": qDiskAvailable}); err == nil {
			instantMetrics["disk_available"] = diskAvailInstant
		}

		// Combine all series
		allSeries := append(append(append(cpuSeries, memSeries...), append(fsSeries, rxSeries...)...), txSeries...)
		allSeries = append(allSeries, append(append(cpuUtilSeries, memUtilSeries...), append(diskUsedSeries, diskAvailSeries...)...)...)
		allSeries = append(allSeries, append(append(memUsedSeries, memBufferedSeries...), append(memCachedSeries, memFreeSeries...)...)...)
		allSeries = append(allSeries, cpuAggSeries...)

		payload := gin.H{
			"series":  allSeries,
			"instant": instantMetrics,
		}

		// Cache the result
		h.setCache(cacheKey, payload, h.cacheTTL)
		h.logger.Debug("Cached node metrics", "node", nodeName, "range", rng, "ttl", h.cacheTTL)

		return payload, nil
	}

	initial, err := fetch()
	if err != nil {
		h.sseHandler.SendSSEError(c, http.StatusInternalServerError, err.Error())
		return
	}
	h.sseHandler.SendSSEResponseWithUpdates(c, initial, fetch)
}

// ---------- Cluster overview ----------

type promQueryResponse struct {
	Status string `json:"status"`
	Data   struct {
		ResultType string `json:"resultType"`
		Result     []struct {
			Metric map[string]string `json:"metric"`
			Value  []interface{}     `json:"value"`
		} `json:"result"`
	} `json:"data"`
}

func parseVectorSum(raw []byte) (float64, error) {
	var resp promQueryResponse
	if err := json.Unmarshal(raw, &resp); err != nil {
		return 0, err
	}
	if resp.Status != "success" {
		return 0, fmt.Errorf("prometheus query failed")
	}
	sum := 0.0
	for _, r := range resp.Data.Result {
		if len(r.Value) != 2 {
			continue
		}
		valStr := fmt.Sprintf("%v", r.Value[1])
		v, err := parseFloat(valStr)
		if err != nil {
			continue
		}
		sum += v
	}
	return sum, nil
}

// GetClusterOverviewSSE streams cluster-wide stats including node count, CPU packing, and memory packing
func (h *PrometheusHandler) GetClusterOverviewSSE(c *gin.Context) {
	client, err := h.getClient(c)
	if err != nil {
		h.sseHandler.SendSSEError(c, http.StatusBadRequest, err.Error())
		return
	}
	rng := c.DefaultQuery("range", "15m")
	step := c.DefaultQuery("step", "15s")
	configID := c.Query("config")
	cluster := c.Query("cluster")

	ctx, cancel := context.WithTimeout(c.Request.Context(), 4*time.Second)
	defer cancel()
	target, err := h.discoverPrometheus(ctx, client)
	if err != nil {
		h.sseHandler.SendSSEError(c, http.StatusNotFound, "prometheus not available")
		return
	}

	// New cluster stats queries
	// Node count: rely on kube-state-metrics condition for Ready nodes
	qNodeCount := "sum(kube_node_status_condition{condition=\"Ready\",status=\"true\"} == 1)"
	qCPUPacking := "sum(kube_pod_container_resource_requests{resource=\"cpu\", service=\"prometheus-operator-kube-state-metrics\"} * on (pod,instance,uid) group_left () kube_pod_status_phase{service=\"prometheus-operator-kube-state-metrics\", phase=\"Running\"})/sum(kube_node_status_allocatable{resource=\"cpu\",endpoint=\"http\"})*100"
	qMemoryPacking := "sum(kube_pod_container_resource_requests{resource=\"memory\", service=\"prometheus-operator-kube-state-metrics\"} * on (pod,instance,uid) group_left () kube_pod_status_phase{service=\"prometheus-operator-kube-state-metrics\", phase=\"Running\"})/sum(kube_node_status_allocatable{resource=\"memory\",endpoint=\"http\"})*100"

	// CPU allocation summary queries
	qTotalAllocatableCPU := "sum(kube_node_status_allocatable{resource=\"cpu\"})"
	qTotalCPURequests := "sum(kube_pod_container_resource_requests{resource=\"cpu\"})"

	// Memory allocation summary queries
	qTotalAllocatableMemory := "sum(kube_node_status_allocatable{resource=\"memory\"})"
	qTotalMemoryRequests := "sum(kube_pod_container_resource_requests{resource=\"memory\"})"

	fetch := func() (interface{}, error) {
		now := time.Now()
		start := now.Add(-parsePromRange(rng))
		params := map[string]string{
			"start": fmt.Sprintf("%d", start.Unix()),
			"end":   fmt.Sprintf("%d", now.Unix()),
			"step":  step,
		}

		// Node count series
		params["query"] = qNodeCount
		nodeCountRaw, err := h.proxyPrometheus(c.Request.Context(), client, target, "/api/v1/query_range", params)
		if err != nil {
			return nil, err
		}
		nodeCountSeries, _ := parseMatrix(nodeCountRaw)
		for i := range nodeCountSeries {
			nodeCountSeries[i].Metric = "node_count"
		}

		// CPU packing series
		params["query"] = qCPUPacking
		cpuPackingRaw, err := h.proxyPrometheus(c.Request.Context(), client, target, "/api/v1/query_range", params)
		if err != nil {
			return nil, err
		}
		cpuPackingSeries, _ := parseMatrix(cpuPackingRaw)

		// Memory packing series
		params["query"] = qMemoryPacking
		memoryPackingRaw, err := h.proxyPrometheus(c.Request.Context(), client, target, "/api/v1/query_range", params)
		if err != nil {
			return nil, err
		}
		memoryPackingSeries, _ := parseMatrix(memoryPackingRaw)

		// Instant values for current metrics
		nodeCountInstantRaw, _ := h.proxyPrometheus(c.Request.Context(), client, target, "/api/v1/query", map[string]string{"query": qNodeCount})
		nodeCountInstant, _ := parseVectorSum(nodeCountInstantRaw)
		cpuPackingInstantRaw, _ := h.proxyPrometheus(c.Request.Context(), client, target, "/api/v1/query", map[string]string{"query": qCPUPacking})
		cpuPackingInstant, _ := parseVectorSum(cpuPackingInstantRaw)
		memoryPackingInstantRaw, _ := h.proxyPrometheus(c.Request.Context(), client, target, "/api/v1/query", map[string]string{"query": qMemoryPacking})
		memoryPackingInstant, _ := parseVectorSum(memoryPackingInstantRaw)

		// CPU allocation summary metrics
		totalAllocatableCPURaw, _ := h.proxyPrometheus(c.Request.Context(), client, target, "/api/v1/query", map[string]string{"query": qTotalAllocatableCPU})
		totalAllocatableCPU, _ := parseVectorSum(totalAllocatableCPURaw)
		totalCPURequestsRaw, _ := h.proxyPrometheus(c.Request.Context(), client, target, "/api/v1/query", map[string]string{"query": qTotalCPURequests})
		totalCPURequests, _ := parseVectorSum(totalCPURequestsRaw)

		// Memory allocation summary metrics
		totalAllocatableMemoryRaw, _ := h.proxyPrometheus(c.Request.Context(), client, target, "/api/v1/query", map[string]string{"query": qTotalAllocatableMemory})
		totalAllocatableMemory, _ := parseVectorSum(totalAllocatableMemoryRaw)
		totalMemoryRequestsRaw, _ := h.proxyPrometheus(c.Request.Context(), client, target, "/api/v1/query", map[string]string{"query": qTotalMemoryRequests})
		totalMemoryRequests, _ := parseVectorSum(totalMemoryRequestsRaw)

		// Pods capacity (max accommodated) and present (any phase)
		qPodsCapacityWithUnit := `sum(kube_node_status_capacity{resource="pods",unit="integer"})`
		qPodsCapacity := `sum(kube_node_status_capacity{resource="pods"})`
		qPodsCapacityLegacy := `sum(kube_node_status_capacity_pods)`
		qPodsPresent := `sum(max by (namespace,pod) (kube_pod_status_phase == 1))`

		podsCapacity := 0.0
		if raw, err := h.proxyPrometheus(c.Request.Context(), client, target, "/api/v1/query", map[string]string{"query": qPodsCapacityWithUnit}); err == nil {
			podsCapacity, _ = parseVectorSum(raw)
		}
		if podsCapacity == 0 {
			if raw, err := h.proxyPrometheus(c.Request.Context(), client, target, "/api/v1/query", map[string]string{"query": qPodsCapacity}); err == nil {
				podsCapacity, _ = parseVectorSum(raw)
			}
		}
		if podsCapacity == 0 {
			if raw, err := h.proxyPrometheus(c.Request.Context(), client, target, "/api/v1/query", map[string]string{"query": qPodsCapacityLegacy}); err == nil {
				podsCapacity, _ = parseVectorSum(raw)
			}
		}

		podsPresentRaw, _ := h.proxyPrometheus(c.Request.Context(), client, target, "/api/v1/query", map[string]string{"query": qPodsPresent})
		podsPresent, _ := parseVectorSum(podsPresentRaw)

		// Kubernetes server version (best-effort)
		k8sVersion := ""
		if info, err := client.Discovery().ServerVersion(); err == nil && info != nil {
			if info.GitVersion != "" {
				k8sVersion = info.GitVersion
			} else if info.String() != "" {
				k8sVersion = info.String()
			}
		}

		// Metrics server availability (best-effort, short timeout)
		metricsServer := false
		if configID != "" {
			if cfg, err := h.store.GetKubeConfig(configID); err == nil {
				if mClient, err := h.clientFactory.GetMetricsClientForConfig(cfg, cluster); err == nil && mClient != nil {
					ctx2, cancel2 := context.WithTimeout(c.Request.Context(), 800*time.Millisecond)
					defer cancel2()
					if _, err := mClient.MetricsV1beta1().NodeMetricses().List(ctx2, metav1.ListOptions{Limit: 1}); err == nil {
						metricsServer = true
					}
				}
			}
		}

		payload := gin.H{
			"series": append(append(nodeCountSeries, cpuPackingSeries...), memoryPackingSeries...),
			"instant": gin.H{
				"node_count":               nodeCountInstant,
				"cpu_packing":              cpuPackingInstant,
				"memory_packing":           memoryPackingInstant,
				"total_allocatable_cpu":    totalAllocatableCPU,
				"total_cpu_requests":       totalCPURequests,
				"total_allocatable_memory": totalAllocatableMemory,
				"total_memory_requests":    totalMemoryRequests,
				"pods_capacity":            podsCapacity,
				"pods_present":             podsPresent,
				"kubernetes_version":       k8sVersion,
				"metrics_server":           metricsServer,
			},
		}
		return payload, nil
	}

	initial, err := fetch()
	if err != nil {
		h.sseHandler.SendSSEError(c, http.StatusInternalServerError, err.Error())
		return
	}
	h.sseHandler.SendSSEResponseWithUpdates(c, initial, fetch)
}

// ---------- utilities ----------

func escapeLabelValue(s string) string {
	// Escape quotes/backslashes for Prometheus label values
	s = strings.ReplaceAll(s, "\\", "\\\\")
	s = strings.ReplaceAll(s, "\"", "\\\"")
	return s
}

func parsePromRange(r string) time.Duration {
	// Very small parser for inputs like 15m, 1h, 6h
	if r == "" {
		return 15 * time.Minute
	}
	if strings.HasSuffix(r, "m") {
		n := strings.TrimSuffix(r, "m")
		if d, err := time.ParseDuration(n + "m"); err == nil {
			return d
		}
	}
	if strings.HasSuffix(r, "h") {
		n := strings.TrimSuffix(r, "h")
		if d, err := time.ParseDuration(n + "h"); err == nil {
			return d
		}
	}
	// Support days, e.g., 1d, 7d, 15d, 30d
	if strings.HasSuffix(r, "d") {
		n := strings.TrimSuffix(r, "d")
		if days, err := strconv.Atoi(n); err == nil {
			return time.Duration(days) * 24 * time.Hour
		}
	}
	// fallback
	return 15 * time.Minute
}
