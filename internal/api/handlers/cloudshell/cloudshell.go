package cloudshell

import (
	"encoding/json"
	"fmt"
	"net/http"
	"time"

	"kubewall-backend/internal/k8s"
	"kubewall-backend/internal/storage"
	"kubewall-backend/pkg/logger"

	"github.com/gin-gonic/gin"
	"github.com/gorilla/websocket"
	v1 "k8s.io/api/core/v1"
	"k8s.io/apimachinery/pkg/api/resource"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/client-go/kubernetes"
	"k8s.io/client-go/kubernetes/scheme"
	"k8s.io/client-go/rest"
	"k8s.io/client-go/tools/clientcmd"
	"k8s.io/client-go/tools/remotecommand"
)

// CloudShellHandler handles cloud shell operations
type CloudShellHandler struct {
	store         *storage.KubeConfigStore
	clientFactory *k8s.ClientFactory
	helmFactory   *k8s.HelmClientFactory
	logger        *logger.Logger
	upgrader      websocket.Upgrader
}

// CloudShellSession represents a cloud shell session
type CloudShellSession struct {
	ID           string    `json:"id"`
	ConfigID     string    `json:"configId"`
	Cluster      string    `json:"cluster"`
	Namespace    string    `json:"namespace"`
	PodName      string    `json:"podName"`
	CreatedAt    time.Time `json:"createdAt"`
	LastActivity time.Time `json:"lastActivity"`
	Status       string    `json:"status"` // "creating", "ready", "terminated"
}

// NewCloudShellHandler creates a new CloudShellHandler
func NewCloudShellHandler(store *storage.KubeConfigStore, clientFactory *k8s.ClientFactory, helmFactory *k8s.HelmClientFactory, log *logger.Logger) *CloudShellHandler {
	return &CloudShellHandler{
		store:         store,
		clientFactory: clientFactory,
		helmFactory:   helmFactory,
		logger:        log,
		upgrader: websocket.Upgrader{
			CheckOrigin: func(r *http.Request) bool {
				return true // Allow all origins for now
			},
		},
	}
}

// getClientAndConfig gets the Kubernetes client and config for the given config ID and cluster
func (h *CloudShellHandler) getClientAndConfig(c *gin.Context) (*kubernetes.Clientset, *rest.Config, error) {
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

// CreateCloudShell creates a new cloud shell pod
func (h *CloudShellHandler) CreateCloudShell(c *gin.Context) {
	configID := c.Query("config")
	cluster := c.Query("cluster")
	namespace := c.Query("namespace")

	if namespace == "" {
		namespace = "default"
	}

	client, _, err := h.getClientAndConfig(c)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Get the kubeconfig from store
	kubeconfig, err := h.store.GetKubeConfig(configID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": fmt.Sprintf("Failed to get kubeconfig: %v", err)})
		return
	}

	// Convert kubeconfig to YAML
	kubeconfigYAML, err := clientcmd.Write(*kubeconfig)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": fmt.Sprintf("Failed to serialize kubeconfig: %v", err)})
		return
	}

	// Generate unique pod name
	podName := fmt.Sprintf("cloudshell-%s-%d", cluster, time.Now().Unix())
	configMapName := fmt.Sprintf("kubeconfig-%s-%s", configID, cluster)

	// Create ConfigMap with kubeconfig
	configMap := &v1.ConfigMap{
		ObjectMeta: metav1.ObjectMeta{
			Name:      configMapName,
			Namespace: namespace,
			Labels: map[string]string{
				"app":        "cloudshell",
				"cluster":    cluster,
				"config-id":  configID,
				"created-by": "kubewall",
			},
		},
		Data: map[string]string{
			"config": string(kubeconfigYAML),
		},
	}

	// Create or update the ConfigMap
	_, err = client.CoreV1().ConfigMaps(namespace).Create(c.Request.Context(), configMap, metav1.CreateOptions{})
	if err != nil {
		// If ConfigMap already exists, update it
		_, err = client.CoreV1().ConfigMaps(namespace).Update(c.Request.Context(), configMap, metav1.UpdateOptions{})
		if err != nil {
			h.logger.WithError(err).Error("Failed to create/update kubeconfig ConfigMap")
			c.JSON(http.StatusInternalServerError, gin.H{"error": fmt.Sprintf("Failed to create kubeconfig ConfigMap: %v", err)})
			return
		}
	}

	// Create cloud shell pod
	pod := &v1.Pod{
		ObjectMeta: metav1.ObjectMeta{
			Name:      podName,
			Namespace: namespace,
			Labels: map[string]string{
				"app":        "cloudshell",
				"cluster":    cluster,
				"config-id":  configID,
				"created-by": "facets",
			},
		},
		Spec: v1.PodSpec{
			Containers: []v1.Container{
				{
					Name:  "shell",
					Image: "dtzar/helm-kubectl:latest",
					Stdin: true,
					TTY:   true,
					Resources: v1.ResourceRequirements{
						Requests: v1.ResourceList{
							v1.ResourceCPU:    resource.MustParse("100m"),
							v1.ResourceMemory: resource.MustParse("256Mi"),
						},
						Limits: v1.ResourceList{
							v1.ResourceCPU:    resource.MustParse("1000m"),
							v1.ResourceMemory: resource.MustParse("1Gi"),
						},
					},
					Env: []v1.EnvVar{
						{
							Name:  "KUBECONFIG",
							Value: "/tmp/kubeconfig",
						},
						{
							Name:  "PATH",
							Value: "/usr/local/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin",
						},
					},
					VolumeMounts: []v1.VolumeMount{
						{
							Name:      "kubeconfig",
							MountPath: "/tmp/kubeconfig",
							SubPath:   "config",
						},
					},
				},
			},
			Volumes: []v1.Volume{
				{
					Name: "kubeconfig",
					VolumeSource: v1.VolumeSource{
						ConfigMap: &v1.ConfigMapVolumeSource{
							LocalObjectReference: v1.LocalObjectReference{
								Name: configMapName,
							},
						},
					},
				},
			},
			RestartPolicy: v1.RestartPolicyNever,
		},
	}

	// Create the pod
	createdPod, err := client.CoreV1().Pods(namespace).Create(c.Request.Context(), pod, metav1.CreateOptions{})
	if err != nil {
		h.logger.WithError(err).Error("Failed to create cloud shell pod")
		c.JSON(http.StatusInternalServerError, gin.H{"error": fmt.Sprintf("Failed to create cloud shell: %v", err)})
		return
	}

	h.logger.WithFields(map[string]interface{}{
		"pod_name":  createdPod.Name,
		"namespace": createdPod.Namespace,
		"cluster":   cluster,
		"config_id": configID,
	}).Info("Cloud shell pod created successfully")

	// Create session info
	session := &CloudShellSession{
		ID:           podName,
		ConfigID:     configID,
		Cluster:      cluster,
		Namespace:    namespace,
		PodName:      podName,
		CreatedAt:    time.Now(),
		LastActivity: time.Now(),
		Status:       "creating",
	}

	h.logger.WithField("session_id", session.ID).Info("Cloud shell session created")

	c.JSON(http.StatusOK, gin.H{
		"session": session,
		"message": "Cloud shell created successfully",
	})
}

// HandleCloudShellWebSocket handles WebSocket-based cloud shell
func (h *CloudShellHandler) HandleCloudShellWebSocket(c *gin.Context) {
	h.logger.Info("Cloud shell WebSocket request received")

	// Upgrade HTTP connection to WebSocket
	conn, err := h.upgrader.Upgrade(c.Writer, c.Request, nil)
	if err != nil {
		h.logger.WithError(err).Error("Failed to upgrade connection to WebSocket")
		return
	}
	defer conn.Close()

	// Get parameters
	podName := c.Query("pod")
	namespace := c.Query("namespace")
	configID := c.Query("config")
	cluster := c.Query("cluster")

	if podName == "" || namespace == "" || configID == "" || cluster == "" {
		h.sendWebSocketError(conn, "pod, namespace, config, and cluster parameters are required")
		return
	}

	// Get Kubernetes client and config
	client, restConfig, err := h.getClientAndConfig(c)
	if err != nil {
		h.logger.WithError(err).Error("Failed to get Kubernetes client for cloud shell")
		h.sendWebSocketError(conn, err.Error())
		return
	}

	// Verify pod exists and is running
	pod, err := client.CoreV1().Pods(namespace).Get(c.Request.Context(), podName, metav1.GetOptions{})
	if err != nil {
		h.logger.WithError(err).WithField("pod", podName).WithField("namespace", namespace).Error("Failed to get cloud shell pod")
		h.sendWebSocketError(conn, fmt.Sprintf("Pod not found: %v", err))
		return
	}

	// Check if pod is running
	if pod.Status.Phase != v1.PodRunning {
		h.sendWebSocketError(conn, fmt.Sprintf("Pod is not running. Current phase: %s", pod.Status.Phase))
		return
	}

	// Create exec request
	req := client.CoreV1().RESTClient().Post().
		Resource("pods").
		Name(podName).
		Namespace(namespace).
		SubResource("exec").
		VersionedParams(&v1.PodExecOptions{
			Container: "shell",
			Command:   []string{"/bin/bash"},
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
	session := &CloudShellTerminalSession{
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
		h.logger.WithError(err).Error("Failed to start cloud shell exec stream")
		h.sendWebSocketError(conn, fmt.Sprintf("Failed to start exec: %v", err))
		return
	}
}

// ListCloudShellSessions lists all cloud shell sessions
func (h *CloudShellHandler) ListCloudShellSessions(c *gin.Context) {
	configID := c.Query("config")
	cluster := c.Query("cluster")
	namespace := c.Query("namespace")

	if namespace == "" {
		namespace = "default"
	}

	client, _, err := h.getClientAndConfig(c)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// List pods with cloudshell label
	pods, err := client.CoreV1().Pods(namespace).List(c.Request.Context(), metav1.ListOptions{
		LabelSelector: "app=cloudshell",
	})
	if err != nil {
		h.logger.WithError(err).Error("Failed to list cloud shell pods")
		c.JSON(http.StatusInternalServerError, gin.H{"error": fmt.Sprintf("Failed to list sessions: %v", err)})
		return
	}

	sessions := []*CloudShellSession{}
	for _, pod := range pods.Items {
		// Only include pods for the specified config and cluster
		if pod.Labels["config-id"] == configID && pod.Labels["cluster"] == cluster {
			status := "terminated"

			// Determine status based on pod phase and conditions
			switch pod.Status.Phase {
			case v1.PodRunning:
				// Check if all containers are ready
				allReady := true
				for _, containerStatus := range pod.Status.ContainerStatuses {
					if !containerStatus.Ready {
						allReady = false
						break
					}
				}
				if allReady {
					status = "ready"
				} else {
					status = "creating"
				}
			case v1.PodPending:
				status = "creating"
			case v1.PodSucceeded, v1.PodFailed:
				status = "terminated"
			}

			// Check for specific error conditions
			for _, condition := range pod.Status.Conditions {
				if condition.Type == v1.PodScheduled && condition.Status == v1.ConditionFalse {
					status = "terminated"
					break
				}
			}

			session := &CloudShellSession{
				ID:           pod.Name,
				ConfigID:     configID,
				Cluster:      cluster,
				Namespace:    pod.Namespace,
				PodName:      pod.Name,
				CreatedAt:    pod.CreationTimestamp.Time,
				LastActivity: pod.CreationTimestamp.Time, // TODO: track actual last activity
				Status:       status,
			}
			sessions = append(sessions, session)

			h.logger.WithFields(map[string]interface{}{
				"pod_name":  pod.Name,
				"namespace": pod.Namespace,
				"phase":     pod.Status.Phase,
				"status":    status,
			}).Debug("Cloud shell session status")
		}
	}

	h.logger.WithFields(map[string]interface{}{
		"config_id": configID,
		"cluster":   cluster,
		"namespace": namespace,
		"count":     len(sessions),
	}).Info("Listed cloud shell sessions")

	c.JSON(http.StatusOK, gin.H{
		"sessions": sessions,
	})
}

// DeleteCloudShell deletes a cloud shell session
func (h *CloudShellHandler) DeleteCloudShell(c *gin.Context) {
	podName := c.Param("name")
	namespace := c.Query("namespace")

	if namespace == "" {
		namespace = "default"
	}

	client, _, err := h.getClientAndConfig(c)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Delete the pod
	err = client.CoreV1().Pods(namespace).Delete(c.Request.Context(), podName, metav1.DeleteOptions{})
	if err != nil {
		h.logger.WithError(err).Error("Failed to delete cloud shell pod")
		c.JSON(http.StatusInternalServerError, gin.H{"error": fmt.Sprintf("Failed to delete cloud shell: %v", err)})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "Cloud shell deleted successfully",
	})
}

// sendWebSocketError sends an error message through the WebSocket
func (h *CloudShellHandler) sendWebSocketError(conn *websocket.Conn, message string) {
	errorMsg := map[string]interface{}{
		"error": message,
	}
	jsonData, _ := json.Marshal(errorMsg)
	conn.WriteMessage(websocket.TextMessage, jsonData)
}

// CloudShellTerminalSession represents a terminal session for cloud shell
type CloudShellTerminalSession struct {
	conn   *websocket.Conn
	logger *logger.Logger
}

// Read reads from the WebSocket and writes to stdin
func (t *CloudShellTerminalSession) Read(p []byte) (int, error) {
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
func (t *CloudShellTerminalSession) Write(p []byte) (int, error) {
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
func (t *CloudShellTerminalSession) Close() error {
	return t.conn.Close()
}
