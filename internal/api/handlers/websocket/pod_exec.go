package websocket

import (
	"encoding/json"
	"fmt"
	"net/http"

	"kubewall-backend/internal/k8s"
	"kubewall-backend/internal/storage"
	"kubewall-backend/pkg/logger"

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
func (h *PodExecHandler) HandlePodExec(c *gin.Context) {
	h.logger.Info("Pod exec WebSocket request received")

	// Log request details
	podName := c.Param("name")
	namespace := c.Param("namespace")
	h.logger.WithFields(map[string]interface{}{
		"pod":       podName,
		"namespace": namespace,
		"method":    c.Request.Method,
		"url":       c.Request.URL.String(),
	}).Info("Pod exec request details")

	// Upgrade HTTP connection to WebSocket
	conn, err := h.upgrader.Upgrade(c.Writer, c.Request, nil)
	if err != nil {
		h.logger.WithError(err).Error("Failed to upgrade connection to WebSocket")
		return
	}
	defer conn.Close()

	// Get parameters (reuse the variables from above)
	container := c.Query("container")
	command := c.Query("command")

	if command == "" {
		command = "/bin/sh"
	}

	// Get Kubernetes client and config
	client, restConfig, err := h.getClientAndConfig(c)
	if err != nil {
		h.logger.WithError(err).Error("Failed to get Kubernetes client for pod exec")
		h.sendWebSocketError(conn, err.Error())
		return
	}

	// Verify pod exists
	pod, err := client.CoreV1().Pods(namespace).Get(c.Request.Context(), podName, metav1.GetOptions{})
	if err != nil {
		h.logger.WithError(err).WithField("pod", podName).WithField("namespace", namespace).Error("Failed to get pod for exec")
		h.sendWebSocketError(conn, fmt.Sprintf("Pod not found: %v", err))
		return
	}

	// Check if pod is running
	if pod.Status.Phase != v1.PodRunning {
		h.sendWebSocketError(conn, fmt.Sprintf("Pod is not running. Current phase: %s", pod.Status.Phase))
		return
	}

	// If no container specified, use the first one
	if container == "" && len(pod.Spec.Containers) > 0 {
		container = pod.Spec.Containers[0].Name
	}

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
		return
	}

	// Create terminal session
	session := &TerminalSession{
		conn:   conn,
		logger: h.logger,
	}

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
		return
	}
}

// HandlePodExecByName handles WebSocket-based pod exec by name using namespace from query parameters
func (h *PodExecHandler) HandlePodExecByName(c *gin.Context) {
	h.logger.Info("Pod exec by name WebSocket request received")

	// Upgrade HTTP connection to WebSocket
	conn, err := h.upgrader.Upgrade(c.Writer, c.Request, nil)
	if err != nil {
		h.logger.WithError(err).Error("Failed to upgrade connection to WebSocket")
		return
	}
	defer conn.Close()

	// Get parameters
	namespace := c.Query("namespace")

	if namespace == "" {
		h.sendWebSocketError(conn, "namespace parameter is required")
		return
	}

	// Set the namespace in the context for the main handler
	c.Params = append(c.Params, gin.Param{Key: "namespace", Value: namespace})
	h.HandlePodExec(c)
}

// sendWebSocketError sends an error message through the WebSocket
func (h *PodExecHandler) sendWebSocketError(conn *websocket.Conn, message string) {
	errorMsg := map[string]interface{}{
		"error": message,
	}
	jsonData, _ := json.Marshal(errorMsg)
	conn.WriteMessage(websocket.TextMessage, jsonData)
}

// TerminalSession represents a terminal session for pod exec
type TerminalSession struct {
	conn   *websocket.Conn
	logger *logger.Logger
}

// Read reads from the WebSocket and writes to stdin
func (t *TerminalSession) Read(p []byte) (int, error) {
	_, message, err := t.conn.ReadMessage()
	if err != nil {
		return 0, err
	}

	// Parse the message
	var msg map[string]interface{}
	if err := json.Unmarshal(message, &msg); err != nil {
		return 0, err
	}

	// Extract input data
	if input, ok := msg["input"].(string); ok {
		copy(p, []byte(input))
		return len(input), nil
	}

	return 0, nil
}

// Write writes from stdout/stderr to the WebSocket
func (t *TerminalSession) Write(p []byte) (int, error) {
	// Send stdout data
	msg := map[string]interface{}{
		"type": "stdout",
		"data": string(p),
	}
	jsonData, err := json.Marshal(msg)
	if err != nil {
		return 0, err
	}

	err = t.conn.WriteMessage(websocket.TextMessage, jsonData)
	if err != nil {
		return 0, err
	}

	return len(p), nil
}

// Close closes the WebSocket connection
func (t *TerminalSession) Close() error {
	return t.conn.Close()
}
