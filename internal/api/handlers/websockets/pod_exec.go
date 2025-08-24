package websockets

import (
	"encoding/json"
	"fmt"
	"net/http"

	"github.com/Facets-cloud/kube-dash/internal/api/handlers/shared"
	"github.com/Facets-cloud/kube-dash/internal/k8s"
	"github.com/Facets-cloud/kube-dash/internal/storage"
	"github.com/Facets-cloud/kube-dash/internal/tracing"
	"github.com/Facets-cloud/kube-dash/pkg/logger"

	"github.com/gin-gonic/gin"
	"github.com/gorilla/websocket"
	v1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/client-go/kubernetes"
	"k8s.io/client-go/kubernetes/scheme"
	"k8s.io/client-go/rest"
	"k8s.io/client-go/tools/clientcmd"
	"k8s.io/client-go/tools/remotecommand"
)

// PodExecHandler handles WebSocket-based pod exec operations
type PodExecHandler struct {
	store         *storage.KubeConfigStore
	clientFactory *k8s.ClientFactory
	logger        *logger.Logger
	upgrader      websocket.Upgrader
	tracingHelper *tracing.TracingHelper
}

// NewPodExecHandler creates a new PodExecHandler
func NewPodExecHandler(store *storage.KubeConfigStore, clientFactory *k8s.ClientFactory, log *logger.Logger) *PodExecHandler {
	return &PodExecHandler{
		store:         store,
		clientFactory: clientFactory,
		logger:        log,
		upgrader: websocket.Upgrader{
			CheckOrigin: func(r *http.Request) bool {
				return true // Allow all origins for now
			},
		},
		tracingHelper: tracing.GetTracingHelper(),
	}
}

// getClientAndConfig gets the Kubernetes client and config for the given config ID and cluster
func (h *PodExecHandler) getClientAndConfig(c *gin.Context) (*kubernetes.Clientset, *rest.Config, error) {
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
		return nil, nil, fmt.Errorf("failed to create client config: %w", err)
	}

	return client, restConfig, nil
}

// HandlePodExec handles WebSocket-based pod exec
// @Summary Execute Commands in Pod via WebSocket
// @Description Execute interactive commands in a pod container via WebSocket connection
// @Tags WebSocket
// @Accept json
// @Produce json
// @Param namespace path string true "Namespace name"
// @Param name path string true "Pod name"
// @Param config query string true "Kubernetes configuration ID"
// @Param cluster query string false "Cluster name"
// @Param container query string false "Container name (defaults to first container)"
// @Param command query string false "Command to execute (default: /bin/sh)"
// @Success 101 {string} string "WebSocket connection established"
// @Failure 400 {object} map[string]string "Bad request"
// @Failure 404 {object} map[string]string "Pod not found"
// @Failure 500 {object} map[string]string "Internal server error"
// @Router /api/v1/pods/{namespace}/{name}/exec/ws [get]
// @Security BearerAuth
// @Security KubeConfig
func (h *PodExecHandler) HandlePodExec(c *gin.Context) {
	// Start main span for pod exec operation
	ctx, span := h.tracingHelper.StartAuthSpan(c.Request.Context(), "websocket.pod_exec")
	defer span.End()

	// Add resource attributes
	podName := c.Param("name")
	namespace := c.Param("namespace")
	h.tracingHelper.AddResourceAttributes(span, podName, "pod", 1)

	// Child span for WebSocket connection setup
	connCtx, connSpan := h.tracingHelper.StartKubernetesAPISpan(ctx, "connection_setup", "websocket", namespace)
	// Upgrade HTTP connection to WebSocket
	conn, err := h.upgrader.Upgrade(c.Writer, c.Request, nil)
	if err != nil {
		h.logger.WithError(err).Error("Failed to upgrade connection to WebSocket")
		h.tracingHelper.RecordError(connSpan, err, "Failed to upgrade WebSocket connection")
		connSpan.End()
		h.tracingHelper.RecordError(span, err, "Pod exec operation failed")
		return
	}
	defer conn.Close()
	h.tracingHelper.RecordSuccess(connSpan, "WebSocket connection established")
	connSpan.End()

	// Get parameters
	container := c.Query("container")
	command := c.Query("command")

	if command == "" {
		command = "/bin/sh"
	}

	// Child span for client acquisition
	clientCtx, clientSpan := h.tracingHelper.StartAuthSpan(connCtx, "client_acquisition")
	// Get Kubernetes client and config
	client, restConfig, err := h.getClientAndConfig(c)
	if err != nil {
		h.logger.WithError(err).Error("Failed to get Kubernetes client for pod exec")
		h.sendWebSocketError(conn, err.Error())
		h.tracingHelper.RecordError(clientSpan, err, "Failed to get Kubernetes client")
		clientSpan.End()
		h.tracingHelper.RecordError(span, err, "Pod exec operation failed")
		return
	}
	h.tracingHelper.RecordSuccess(clientSpan, "Kubernetes client acquired")
	clientSpan.End()

	// Child span for pod validation
	validationCtx, validationSpan := h.tracingHelper.StartKubernetesAPISpan(clientCtx, "pod_validation", "pod", namespace)
	// Verify pod exists
	pod, err := client.CoreV1().Pods(namespace).Get(c.Request.Context(), podName, metav1.GetOptions{})
	if err != nil {
		h.logger.WithError(err).WithField("pod", podName).WithField("namespace", namespace).Error("Failed to get pod for exec")
		h.sendWebSocketError(conn, fmt.Sprintf("Pod not found: %v", err))
		h.tracingHelper.RecordError(validationSpan, err, "Failed to get pod")
		validationSpan.End()
		h.tracingHelper.RecordError(span, err, "Pod exec operation failed")
		return
	}

	// Check if pod is running
	if pod.Status.Phase != v1.PodRunning {
		err := fmt.Errorf("pod is not running, current phase: %s", pod.Status.Phase)
		h.sendWebSocketError(conn, err.Error())
		h.tracingHelper.RecordError(validationSpan, err, "Pod not running")
		validationSpan.End()
		h.tracingHelper.RecordError(span, err, "Pod exec operation failed")
		return
	}
	h.tracingHelper.RecordSuccess(validationSpan, "Pod validation completed")
	validationSpan.End()

	// If no container specified, use the first one
	if container == "" && len(pod.Spec.Containers) > 0 {
		container = pod.Spec.Containers[0].Name
	}

	// Child span for stream processing
	_, streamSpan := h.tracingHelper.StartKubernetesAPISpan(validationCtx, "stream_processing", "pod", namespace)
	// Create exec request
	req := client.CoreV1().RESTClient().Post().
		Resource("pods").
		Name(podName).
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

	// Create SPDY executor
	exec, err := remotecommand.NewSPDYExecutor(restConfig, "POST", req.URL())
	if err != nil {
		h.logger.WithError(err).Error("Failed to create SPDY executor")
		h.sendWebSocketError(conn, fmt.Sprintf("Failed to create executor: %v", err))
		h.tracingHelper.RecordError(streamSpan, err, "Failed to create SPDY executor")
		streamSpan.End()
		h.tracingHelper.RecordError(span, err, "Pod exec operation failed")
		return
	}

	// Create enhanced terminal session for better performance
	session := shared.NewEnhancedTerminalSession(conn, h.logger)

	// Start the exec session
	err = exec.Stream(remotecommand.StreamOptions{
		Stdin:  session,
		Stdout: session,
		Stderr: session,
		Tty:    true,
	})

	if err != nil {
		h.logger.WithError(err).Error("Failed to start exec stream")
		h.sendWebSocketError(conn, fmt.Sprintf("Failed to start exec: %v", err))
		h.tracingHelper.RecordError(streamSpan, err, "Failed to start exec stream")
		streamSpan.End()
		h.tracingHelper.RecordError(span, err, "Pod exec operation failed")
		return
	}

	h.tracingHelper.RecordSuccess(streamSpan, "Stream processing completed")
	streamSpan.End()
	h.tracingHelper.RecordSuccess(span, "Pod exec operation completed")
}

// HandlePodExecByName handles WebSocket-based pod exec by name using namespace from query parameters
// @Summary Execute Commands in Pod by Name via WebSocket
// @Description Execute interactive commands in a pod container by name via WebSocket connection
// @Tags WebSocket
// @Accept json
// @Produce json
// @Param name path string true "Pod name"
// @Param namespace query string true "Namespace name"
// @Param config query string true "Kubernetes configuration ID"
// @Param cluster query string false "Cluster name"
// @Param container query string false "Container name (defaults to first container)"
// @Param command query string false "Command to execute (default: /bin/sh)"
// @Success 101 {string} string "WebSocket connection established"
// @Failure 400 {object} map[string]string "Bad request"
// @Failure 404 {object} map[string]string "Pod not found"
// @Failure 500 {object} map[string]string "Internal server error"
// @Router /api/v1/pod/{name}/exec/ws [get]
// @Security BearerAuth
// @Security KubeConfig
func (h *PodExecHandler) HandlePodExecByName(c *gin.Context) {
	// Start main span for pod exec by name operation
	ctx, span := h.tracingHelper.StartAuthSpan(c.Request.Context(), "websocket.pod_exec_by_name")
	defer span.End()

	// Add resource attributes
	podName := c.Param("name")
	namespace := c.Query("namespace")
	h.tracingHelper.AddResourceAttributes(span, podName, "pod", 1)

	// Child span for WebSocket connection setup
	_, connSpan := h.tracingHelper.StartKubernetesAPISpan(ctx, "connection_setup", "websocket", namespace)
	// Upgrade HTTP connection to WebSocket
	conn, err := h.upgrader.Upgrade(c.Writer, c.Request, nil)
	if err != nil {
		h.logger.WithError(err).Error("Failed to upgrade connection to WebSocket")
		h.tracingHelper.RecordError(connSpan, err, "Failed to upgrade WebSocket connection")
		connSpan.End()
		h.tracingHelper.RecordError(span, err, "Pod exec by name operation failed")
		return
	}
	defer conn.Close()
	h.tracingHelper.RecordSuccess(connSpan, "WebSocket connection established")
	connSpan.End()

	// Get parameters
	if namespace == "" {
		err := fmt.Errorf("namespace parameter is required")
		h.sendWebSocketError(conn, err.Error())
		h.tracingHelper.RecordError(span, err, "Missing namespace parameter")
		return
	}

	// Set the namespace in the context for the main handler
	c.Params = append(c.Params, gin.Param{Key: "namespace", Value: namespace})
	h.HandlePodExec(c)
	h.tracingHelper.RecordSuccess(span, "Pod exec by name operation completed")
}

// sendWebSocketError sends an error message through the WebSocket
func (h *PodExecHandler) sendWebSocketError(conn *websocket.Conn, message string) {
	errorMsg := map[string]interface{}{
		"error": message,
	}
	jsonData, _ := json.Marshal(errorMsg)
	conn.WriteMessage(websocket.TextMessage, jsonData)
}
