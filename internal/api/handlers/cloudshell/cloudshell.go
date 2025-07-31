package cloudshell

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"time"

	"kubewall-backend/internal/api/handlers/shared"
	"kubewall-backend/internal/api/utils"
	"kubewall-backend/internal/k8s"
	"kubewall-backend/internal/storage"
	"kubewall-backend/pkg/logger"

	"github.com/gin-gonic/gin"
	"github.com/gorilla/websocket"
	authorizationv1 "k8s.io/api/authorization/v1"
	v1 "k8s.io/api/core/v1"
	"k8s.io/apimachinery/pkg/api/resource"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/client-go/kubernetes"
	"k8s.io/client-go/kubernetes/scheme"
	"k8s.io/client-go/rest"
	"k8s.io/client-go/tools/clientcmd"
	"k8s.io/client-go/tools/remotecommand"
)

const (
	MaxCloudShellSessions = 2
	// CloudShellCleanupInterval is how often to run the cleanup routine
	CloudShellCleanupInterval = 1 * time.Hour
	// CloudShellMaxAge is the maximum age of a cloud shell session before cleanup
	CloudShellMaxAge = 24 * time.Hour
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

// getActiveSessions gets the count of active cloud shell sessions for the given config, cluster, and namespace
func (h *CloudShellHandler) getActiveSessions(client *kubernetes.Clientset, configID, cluster, namespace string) ([]*CloudShellSession, error) {
	// List pods with cloudshell label
	pods, err := client.CoreV1().Pods(namespace).List(context.Background(), metav1.ListOptions{
		LabelSelector: "app=cloudshell",
	})
	if err != nil {
		return nil, err
	}

	var activeSessions []*CloudShellSession
	for _, pod := range pods.Items {
		// Only include pods for the specified config and cluster
		if pod.Labels["config-id"] == configID && pod.Labels["cluster"] == cluster {
			// Check if pod is active (not being terminated and not in terminal states)
			if pod.DeletionTimestamp == nil &&
				pod.Status.Phase != v1.PodSucceeded &&
				pod.Status.Phase != v1.PodFailed {
				session := &CloudShellSession{
					ID:           pod.Name,
					ConfigID:     configID,
					Cluster:      cluster,
					Namespace:    pod.Namespace,
					PodName:      pod.Name,
					CreatedAt:    pod.CreationTimestamp.Time,
					LastActivity: pod.CreationTimestamp.Time,
					Status:       string(pod.Status.Phase),
				}
				activeSessions = append(activeSessions, session)
			}
		}
	}

	return activeSessions, nil
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

// checkCloudShellPermissions checks if the user has permissions to create, list, and delete cloud shell resources
func (h *CloudShellHandler) checkCloudShellPermissions(client *kubernetes.Clientset, namespace string) error {
	// Define the permissions we need to check
	permissions := []struct {
		resource string
		verbs    []string
	}{
		{"configmaps", []string{"create", "list", "delete"}},
		{"pods", []string{"create", "list", "delete"}},
	}

	for _, perm := range permissions {
		for _, verb := range perm.verbs {
			accessReview := &authorizationv1.SelfSubjectAccessReview{
				Spec: authorizationv1.SelfSubjectAccessReviewSpec{
					ResourceAttributes: &authorizationv1.ResourceAttributes{
						Namespace: namespace,
						Verb:      verb,
						Group:     "",
						Version:   "v1",
						Resource:  perm.resource,
					},
				},
			}

			result, err := client.AuthorizationV1().SelfSubjectAccessReviews().Create(context.Background(), accessReview, metav1.CreateOptions{})
			if err != nil {
				return fmt.Errorf("failed to check %s %s permissions: %w", perm.resource, verb, err)
			}

			if !result.Status.Allowed {
				return fmt.Errorf("insufficient permissions: cannot %s %s in namespace %s", verb, perm.resource, namespace)
			}
		}
	}

	return nil
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

	// Check permissions before proceeding
	if err := h.checkCloudShellPermissions(client, namespace); err != nil {
		h.logger.WithError(err).Error("Permission check failed for cloud shell creation")

		// Check if this is a permission error and return appropriate response
		if utils.IsPermissionError(err) {
			permissionResponse := utils.CreatePermissionErrorResponse(err)
			c.JSON(http.StatusForbidden, permissionResponse)
		} else {
			c.JSON(http.StatusInternalServerError, gin.H{"error": fmt.Sprintf("Failed to check permissions: %v", err)})
		}
		return
	}

	// Check for active sessions limit
	activeSessions, err := h.getActiveSessions(client, configID, cluster, namespace)
	if err != nil {
		h.logger.WithError(err).Error("Failed to get active sessions for limit check")

		// Check if this is a permission error
		if utils.IsPermissionError(err) {
			permissionResponse := utils.CreatePermissionErrorResponse(err)
			c.JSON(http.StatusForbidden, permissionResponse)
		} else {
			c.JSON(http.StatusInternalServerError, gin.H{"error": fmt.Sprintf("Failed to check session limit: %v", err)})
		}
		return
	}

	if len(activeSessions) >= MaxCloudShellSessions {
		h.logger.WithFields(map[string]interface{}{
			"config_id": configID,
			"cluster":   cluster,
			"namespace": namespace,
			"current":   len(activeSessions),
			"max":       MaxCloudShellSessions,
		}).Warn("Cloud shell session limit reached")
		c.JSON(http.StatusTooManyRequests, gin.H{
			"error":   fmt.Sprintf("Maximum number of active sessions (%d) reached. Please terminate an existing session before creating a new one.", MaxCloudShellSessions),
			"limit":   MaxCloudShellSessions,
			"current": len(activeSessions),
		})
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

			// Check if this is a permission error
			if utils.IsPermissionError(err) {
				permissionResponse := utils.CreatePermissionErrorResponse(err)
				c.JSON(http.StatusForbidden, permissionResponse)
			} else {
				c.JSON(http.StatusInternalServerError, gin.H{"error": fmt.Sprintf("Failed to create kubeconfig ConfigMap: %v", err)})
			}
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

		// Check if this is a permission error
		if utils.IsPermissionError(err) {
			permissionResponse := utils.CreatePermissionErrorResponse(err)
			c.JSON(http.StatusForbidden, permissionResponse)
		} else {
			c.JSON(http.StatusInternalServerError, gin.H{"error": fmt.Sprintf("Failed to create cloud shell: %v", err)})
		}
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

// HandleCloudShellWebSocket handles WebSocket-based cloud shell terminal
func (h *CloudShellHandler) HandleCloudShellWebSocket(c *gin.Context) {
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

	// Check if pod is being terminated
	if pod.DeletionTimestamp != nil {
		h.sendWebSocketError(conn, "Pod is being terminated and cannot accept new connections")
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

	// Create terminal session using shared implementation
	session := shared.NewTerminalSession(conn, h.logger)

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

		// Check if this is a permission error
		if utils.IsPermissionError(err) {
			permissionResponse := utils.CreatePermissionErrorResponse(err)
			c.JSON(http.StatusForbidden, permissionResponse)
		} else {
			c.JSON(http.StatusInternalServerError, gin.H{"error": fmt.Sprintf("Failed to list sessions: %v", err)})
		}
		return
	}

	sessions := []*CloudShellSession{}
	for _, pod := range pods.Items {
		// Only include pods for the specified config and cluster
		if pod.Labels["config-id"] == configID && pod.Labels["cluster"] == cluster {
			status := "terminated"

			// Check if pod is being terminated (has deletion timestamp)
			if pod.DeletionTimestamp != nil {
				status = "terminating"
			} else {
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
				"pod_name":           pod.Name,
				"namespace":          pod.Namespace,
				"phase":              pod.Status.Phase,
				"status":             status,
				"deletion_timestamp": pod.DeletionTimestamp,
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
		"limit":    MaxCloudShellSessions,
		"current":  len(sessions),
	})
}

// DeleteCloudShell deletes a cloud shell session
func (h *CloudShellHandler) DeleteCloudShell(c *gin.Context) {
	podName := c.Param("name")
	namespace := c.Query("namespace")
	configID := c.Query("config")
	cluster := c.Query("cluster")

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

		// Check if this is a permission error
		if utils.IsPermissionError(err) {
			permissionResponse := utils.CreatePermissionErrorResponse(err)
			c.JSON(http.StatusForbidden, permissionResponse)
		} else {
			c.JSON(http.StatusInternalServerError, gin.H{"error": fmt.Sprintf("Failed to delete cloud shell: %v", err)})
		}
		return
	}

	// Also clean up the associated ConfigMap if configID and cluster are provided
	if configID != "" && cluster != "" {
		configMapName := fmt.Sprintf("kubeconfig-%s-%s", configID, cluster)
		err = client.CoreV1().ConfigMaps(namespace).Delete(c.Request.Context(), configMapName, metav1.DeleteOptions{})
		if err != nil {
			// Log but don't fail - ConfigMap might not exist or might be used by other sessions
			h.logger.WithError(err).WithFields(map[string]interface{}{
				"config_map_name": configMapName,
				"namespace":       namespace,
				"cluster":         cluster,
				"config_id":       configID,
			}).Debug("Failed to delete cloud shell ConfigMap (this is usually not critical)")
		} else {
			h.logger.WithFields(map[string]interface{}{
				"config_map_name": configMapName,
				"namespace":       namespace,
				"cluster":         cluster,
				"config_id":       configID,
			}).Info("Successfully deleted cloud shell ConfigMap")
		}
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

// CleanupOldSessions cleans up cloud shell sessions that are older than the maximum age
func (h *CloudShellHandler) CleanupOldSessions() {
	h.logger.Info("Starting cloud shell cleanup routine")

	// Get all kubeconfig metadata from the store
	configMetadata := h.store.ListKubeConfigs()

	cutoffTime := time.Now().Add(-CloudShellMaxAge)
	cleanedCount := 0

	for configID := range configMetadata {
		// Get the full kubeconfig for this ID
		config, err := h.store.GetKubeConfig(configID)
		if err != nil {
			h.logger.WithError(err).WithField("config_id", configID).Error("Failed to get kubeconfig for cleanup")
			continue
		}

		// For each config, we need to check all clusters
		for _, ctx := range config.Contexts {
			clusterName := ctx.Cluster

			// Get client for this config and cluster
			client, err := h.clientFactory.GetClientForConfig(config, clusterName)
			if err != nil {
				h.logger.WithError(err).WithFields(map[string]interface{}{
					"config_id": configID,
					"cluster":   clusterName,
				}).Error("Failed to get client for cleanup")
				continue
			}

			// List all namespaces to check for cloud shell pods
			namespaces, err := client.CoreV1().Namespaces().List(context.Background(), metav1.ListOptions{})
			if err != nil {
				h.logger.WithError(err).WithFields(map[string]interface{}{
					"config_id": configID,
					"cluster":   clusterName,
				}).Error("Failed to list namespaces for cleanup")
				continue
			}

			for _, namespace := range namespaces.Items {
				// List pods with cloudshell label in this namespace
				pods, err := client.CoreV1().Pods(namespace.Name).List(context.Background(), metav1.ListOptions{
					LabelSelector: "app=cloudshell",
				})
				if err != nil {
					h.logger.WithError(err).WithFields(map[string]interface{}{
						"config_id": configID,
						"cluster":   clusterName,
						"namespace": namespace.Name,
					}).Error("Failed to list cloud shell pods for cleanup")
					continue
				}

				for _, pod := range pods.Items {
					// Only process pods for this config and cluster
					if pod.Labels["config-id"] == configID && pod.Labels["cluster"] == clusterName {
						// Check if pod is older than the cutoff time
						if pod.CreationTimestamp.Time.Before(cutoffTime) {
							h.logger.WithFields(map[string]interface{}{
								"pod_name":  pod.Name,
								"namespace": pod.Namespace,
								"cluster":   clusterName,
								"config_id": configID,
								"age":       time.Since(pod.CreationTimestamp.Time).String(),
							}).Info("Cleaning up old cloud shell session")

							// Delete the pod
							err := client.CoreV1().Pods(pod.Namespace).Delete(context.Background(), pod.Name, metav1.DeleteOptions{})
							if err != nil {
								h.logger.WithError(err).WithFields(map[string]interface{}{
									"pod_name":  pod.Name,
									"namespace": pod.Namespace,
									"cluster":   clusterName,
									"config_id": configID,
								}).Error("Failed to delete old cloud shell pod")
							} else {
								cleanedCount++
							}

							// Also clean up the associated ConfigMap if it exists
							configMapName := fmt.Sprintf("kubeconfig-%s-%s", configID, clusterName)
							err = client.CoreV1().ConfigMaps(pod.Namespace).Delete(context.Background(), configMapName, metav1.DeleteOptions{})
							if err != nil {
								// Log but don't fail - ConfigMap might not exist or might be used by other sessions
								h.logger.WithError(err).WithFields(map[string]interface{}{
									"config_map_name": configMapName,
									"namespace":       pod.Namespace,
									"cluster":         clusterName,
									"config_id":       configID,
								}).Debug("Failed to delete cloud shell ConfigMap (this is usually not critical)")
							} else {
								h.logger.WithFields(map[string]interface{}{
									"config_map_name": configMapName,
									"namespace":       pod.Namespace,
									"cluster":         clusterName,
									"config_id":       configID,
								}).Info("Successfully deleted cloud shell ConfigMap during cleanup")
							}
						}
					}
				}
			}
		}
	}

	h.logger.WithField("cleaned_count", cleanedCount).Info("Cloud shell cleanup routine completed")
}

// cleanupOrphanedConfigMaps cleans up ConfigMaps that don't have associated pods
func (h *CloudShellHandler) cleanupOrphanedConfigMaps() {
	h.logger.Info("Starting orphaned ConfigMap cleanup routine")

	// Get all kubeconfig metadata from the store
	configMetadata := h.store.ListKubeConfigs()
	cleanedCount := 0

	for configID := range configMetadata {
		// Get the full kubeconfig for this ID
		config, err := h.store.GetKubeConfig(configID)
		if err != nil {
			h.logger.WithError(err).WithField("config_id", configID).Error("Failed to get kubeconfig for orphaned ConfigMap cleanup")
			continue
		}

		// For each config, we need to check all clusters
		for _, ctx := range config.Contexts {
			clusterName := ctx.Cluster

			// Get client for this config and cluster
			client, err := h.clientFactory.GetClientForConfig(config, clusterName)
			if err != nil {
				h.logger.WithError(err).WithFields(map[string]interface{}{
					"config_id": configID,
					"cluster":   clusterName,
				}).Error("Failed to get client for orphaned ConfigMap cleanup")
				continue
			}

			// List all namespaces to check for orphaned ConfigMaps
			namespaces, err := client.CoreV1().Namespaces().List(context.Background(), metav1.ListOptions{})
			if err != nil {
				h.logger.WithError(err).WithFields(map[string]interface{}{
					"config_id": configID,
					"cluster":   clusterName,
				}).Error("Failed to list namespaces for orphaned ConfigMap cleanup")
				continue
			}

			for _, namespace := range namespaces.Items {
				// Check if there are any cloud shell pods for this config and cluster
				pods, err := client.CoreV1().Pods(namespace.Name).List(context.Background(), metav1.ListOptions{
					LabelSelector: fmt.Sprintf("app=cloudshell,config-id=%s,cluster=%s", configID, clusterName),
				})
				if err != nil {
					h.logger.WithError(err).WithFields(map[string]interface{}{
						"config_id": configID,
						"cluster":   clusterName,
						"namespace": namespace.Name,
					}).Error("Failed to list cloud shell pods for orphaned ConfigMap cleanup")
					continue
				}

				// If no pods exist, check for and delete the ConfigMap
				if len(pods.Items) == 0 {
					configMapName := fmt.Sprintf("kubeconfig-%s-%s", configID, clusterName)

					// Check if the ConfigMap exists
					_, err := client.CoreV1().ConfigMaps(namespace.Name).Get(context.Background(), configMapName, metav1.GetOptions{})
					if err == nil {
						// ConfigMap exists, delete it
						err = client.CoreV1().ConfigMaps(namespace.Name).Delete(context.Background(), configMapName, metav1.DeleteOptions{})
						if err != nil {
							h.logger.WithError(err).WithFields(map[string]interface{}{
								"config_map_name": configMapName,
								"namespace":       namespace.Name,
								"cluster":         clusterName,
								"config_id":       configID,
							}).Error("Failed to delete orphaned cloud shell ConfigMap")
						} else {
							h.logger.WithFields(map[string]interface{}{
								"config_map_name": configMapName,
								"namespace":       namespace.Name,
								"cluster":         clusterName,
								"config_id":       configID,
							}).Info("Successfully deleted orphaned cloud shell ConfigMap")
							cleanedCount++
						}
					}
				}
			}
		}
	}

	h.logger.WithField("cleaned_count", cleanedCount).Info("Orphaned ConfigMap cleanup routine completed")
}

// StartCleanupRoutine starts a background goroutine that periodically cleans up old cloud shell sessions
func (h *CloudShellHandler) StartCleanupRoutine() {
	go func() {
		ticker := time.NewTicker(CloudShellCleanupInterval)
		defer ticker.Stop()

		// Run initial cleanup
		h.CleanupOldSessions()
		h.cleanupOrphanedConfigMaps()

		// Run periodic cleanup
		for range ticker.C {
			h.CleanupOldSessions()
			h.cleanupOrphanedConfigMaps()
		}
	}()

	h.logger.WithField("interval", CloudShellCleanupInterval).Info("Cloud shell cleanup routine started")
}

// ManualCleanup allows manual triggering of the cleanup routine
func (h *CloudShellHandler) ManualCleanup(c *gin.Context) {
	h.logger.Info("Manual cloud shell cleanup triggered")

	// Run cleanup in a goroutine to avoid blocking the request
	go func() {
		h.CleanupOldSessions()
		h.cleanupOrphanedConfigMaps()
	}()

	c.JSON(http.StatusOK, gin.H{
		"message": "Cloud shell cleanup started",
		"status":  "initiated",
	})
}
