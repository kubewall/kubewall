package cloudshell

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"time"

	"github.com/Facets-cloud/kube-dash/internal/api/handlers/shared"
	"github.com/Facets-cloud/kube-dash/internal/api/utils"
	"github.com/Facets-cloud/kube-dash/internal/k8s"
	"github.com/Facets-cloud/kube-dash/internal/storage"
	"github.com/Facets-cloud/kube-dash/internal/tracing"
	"github.com/Facets-cloud/kube-dash/pkg/logger"

	"github.com/gin-gonic/gin"
	"github.com/gorilla/websocket"
	"go.opentelemetry.io/otel/attribute"
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
	tracingHelper *tracing.TracingHelper
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
		tracingHelper: tracing.GetTracingHelper(),
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
		h.logger.WithFields(map[string]interface{}{
			"request_path": c.Request.URL.Path,
			"query_params": c.Request.URL.RawQuery,
			"client_ip":    c.ClientIP(),
		}).Warn("CloudShell request missing required config parameter")
		return nil, nil, fmt.Errorf("config parameter is required")
	}

	config, err := h.store.GetKubeConfig(configID)
	if err != nil {
		h.logger.WithFields(map[string]interface{}{
			"config_id":    configID,
			"cluster":      cluster,
			"error":        err.Error(),
			"client_ip":    c.ClientIP(),
		}).Error("CloudShell config not found in store")
		return nil, nil, fmt.Errorf("config not found: %w", err)
	}

	client, err := h.clientFactory.GetClientForConfig(config, cluster)
	if err != nil {
		h.logger.WithFields(map[string]interface{}{
			"config_id":    configID,
			"cluster":      cluster,
			"error":        err.Error(),
			"client_ip":    c.ClientIP(),
		}).Error("CloudShell failed to create Kubernetes client")
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

// checkCloudShellConnectionPermissions checks if the user has permissions to connect to a specific cloud shell pod
func (h *CloudShellHandler) checkCloudShellConnectionPermissions(client *kubernetes.Clientset, podName, namespace string) error {
	// Check if user can get the specific pod
	getAccessReview := &authorizationv1.SelfSubjectAccessReview{
		Spec: authorizationv1.SelfSubjectAccessReviewSpec{
			ResourceAttributes: &authorizationv1.ResourceAttributes{
				Namespace: namespace,
				Verb:      "get",
				Group:     "",
				Version:   "v1",
				Resource:  "pods",
				Name:      podName,
			},
		},
	}

	result, err := client.AuthorizationV1().SelfSubjectAccessReviews().Create(context.Background(), getAccessReview, metav1.CreateOptions{})
	if err != nil {
		return fmt.Errorf("failed to check pod get permissions: %w", err)
	}

	if !result.Status.Allowed {
		return fmt.Errorf("insufficient permissions: cannot get pod %s in namespace %s", podName, namespace)
	}

	// Check if user can exec into the pod
	execAccessReview := &authorizationv1.SelfSubjectAccessReview{
		Spec: authorizationv1.SelfSubjectAccessReviewSpec{
			ResourceAttributes: &authorizationv1.ResourceAttributes{
				Namespace: namespace,
				Verb:      "create",
				Group:     "",
				Version:   "v1",
				Resource:  "pods/exec",
				Name:      podName,
			},
		},
	}

	result, err = client.AuthorizationV1().SelfSubjectAccessReviews().Create(context.Background(), execAccessReview, metav1.CreateOptions{})
	if err != nil {
		return fmt.Errorf("failed to check pod exec permissions: %w", err)
	}

	if !result.Status.Allowed {
		return fmt.Errorf("insufficient permissions: cannot exec into pod %s in namespace %s", podName, namespace)
	}

	return nil
}

// CreateCloudShell creates a new cloud shell pod
// CreateCloudShell creates a new cloud shell session
// @Summary Create Cloud Shell Session
// @Description Create a new cloud shell session with kubectl and helm access
// @Tags Cloud Shell
// @Accept json
// @Produce json
// @Param config query string true "Kubernetes configuration ID"
// @Param cluster query string false "Cluster name"
// @Param namespace query string false "Namespace (default: default)"
// @Success 201 {object} map[string]interface{} "Cloud shell session created"
// @Failure 400 {object} map[string]string "Bad request"
// @Failure 403 {object} map[string]string "Forbidden - insufficient permissions"
// @Failure 429 {object} map[string]string "Too many requests - session limit reached"
// @Failure 500 {object} map[string]string "Internal server error"
// @Router /api/v1/cloudshell [post]
// @Security BearerAuth
// @Security KubeConfig
func (h *CloudShellHandler) CreateCloudShell(c *gin.Context) {
	// Start main span for create cloud shell operation
	ctx, span := h.tracingHelper.StartAuthSpan(c.Request.Context(), "create_session")
	defer span.End()

	configID := c.Query("config")
	cluster := c.Query("cluster")
	namespace := c.Query("namespace")

	if namespace == "" {
		namespace = "default"
	}

	// Add resource attributes
	span.SetAttributes(
		attribute.String("cloudshell.config_id", configID),
		attribute.String("cloudshell.cluster", cluster),
		attribute.String("cloudshell.namespace", namespace),
	)

	// Child span for client acquisition
	clientCtx, clientSpan := h.tracingHelper.StartAuthSpan(ctx, "client_acquisition")
	client, _, err := h.getClientAndConfig(c)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		h.tracingHelper.RecordError(clientSpan, err, "Failed to get client config")
		clientSpan.End()
		h.tracingHelper.RecordError(span, err, "CloudShell creation failed")
		return
	}
	h.tracingHelper.RecordSuccess(clientSpan, "Kubernetes client acquired")
	clientSpan.End()

	// Child span for permission checking
	permissionCtx, permissionSpan := h.tracingHelper.StartKubernetesAPISpan(clientCtx, "permission_check", "pods", namespace)
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
		h.tracingHelper.RecordError(permissionSpan, err, "Permission check failed")
		permissionSpan.End()
		h.tracingHelper.RecordError(span, err, "CloudShell creation failed")
		return
	}
	h.tracingHelper.RecordSuccess(permissionSpan, "Permission check completed")
	permissionSpan.End()

	// Child span for session limit validation
	validationCtx, validationSpan := h.tracingHelper.StartDataProcessingSpan(permissionCtx, "session_validation")
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
		h.tracingHelper.RecordError(validationSpan, err, "Session validation failed")
		validationSpan.End()
		h.tracingHelper.RecordError(span, err, "CloudShell creation failed")
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
		err := fmt.Errorf("session limit reached: %d/%d", len(activeSessions), MaxCloudShellSessions)
		h.tracingHelper.RecordError(validationSpan, err, "Session limit exceeded")
		validationSpan.End()
		h.tracingHelper.RecordError(span, err, "CloudShell creation failed")
		return
	}
	h.tracingHelper.RecordSuccess(validationSpan, "Session validation completed")
	validationSpan.End()

	// Child span for resource preparation
	prepCtx, prepSpan := h.tracingHelper.StartDataProcessingSpan(validationCtx, "resource_preparation")
	// Get the kubeconfig from store
	kubeconfig, err := h.store.GetKubeConfig(configID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": fmt.Sprintf("Failed to get kubeconfig: %v", err)})
		h.tracingHelper.RecordError(prepSpan, err, "Failed to get kubeconfig")
		prepSpan.End()
		h.tracingHelper.RecordError(span, err, "CloudShell creation failed")
		return
	}

	// Convert kubeconfig to YAML
	kubeconfigYAML, err := clientcmd.Write(*kubeconfig)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": fmt.Sprintf("Failed to serialize kubeconfig: %v", err)})
		h.tracingHelper.RecordError(prepSpan, err, "Failed to serialize kubeconfig")
		prepSpan.End()
		h.tracingHelper.RecordError(span, err, "CloudShell creation failed")
		return
	}

	// Generate unique pod name
	podName := fmt.Sprintf("cloudshell-%s-%d", cluster, time.Now().Unix())
	configMapName := fmt.Sprintf("kubeconfig-%s-%s", configID, cluster)
	h.tracingHelper.RecordSuccess(prepSpan, "Resource preparation completed")
	prepSpan.End()

	// Create ConfigMap with kubeconfig
	configMap := &v1.ConfigMap{
		ObjectMeta: metav1.ObjectMeta{
			Name:      configMapName,
			Namespace: namespace,
			Labels: map[string]string{
				"app":        "cloudshell",
				"cluster":    cluster,
				"config-id":  configID,
				"created-by": "kube-dash",
			},
		},
		Data: map[string]string{
			"config": string(kubeconfigYAML),
		},
	}

	// Child span for ConfigMap creation
	configMapCtx, configMapSpan := h.tracingHelper.StartKubernetesAPISpan(prepCtx, "create", "configmaps", namespace)
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
			h.tracingHelper.RecordError(configMapSpan, err, "Failed to create/update ConfigMap")
			configMapSpan.End()
			h.tracingHelper.RecordError(span, err, "CloudShell creation failed")
			return
		}
	}
	h.tracingHelper.RecordSuccess(configMapSpan, "ConfigMap created/updated successfully")
	configMapSpan.End()

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
					Command: []string{"/bin/sh", "-c", "sleep infinity"},
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

	// Child span for Pod creation
	_, podSpan := h.tracingHelper.StartKubernetesAPISpan(configMapCtx, "create", "pods", namespace)
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
		h.tracingHelper.RecordError(podSpan, err, "Failed to create pod")
		podSpan.End()
		h.tracingHelper.RecordError(span, err, "CloudShell creation failed")
		return
	}
	h.tracingHelper.RecordSuccess(podSpan, "Pod created successfully")
	podSpan.End()

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
	h.tracingHelper.RecordSuccess(span, "Cloud shell creation operation completed")
}

// HandleCloudShellWebSocket handles WebSocket-based cloud shell terminal
// This function checks if the user has permissions to connect to the specific cloud shell pod
// before allowing the WebSocket connection. Users must have:
// 1. Permission to get the specific pod
// 2. Permission to exec into the pod
// @Summary Connect to Cloud Shell via WebSocket
// @Description Connect to an interactive cloud shell terminal via WebSocket
// @Tags WebSocket
// @Accept json
// @Produce json
// @Param pod query string true "Cloud shell pod name"
// @Param namespace query string true "Namespace name"
// @Param config query string true "Kubernetes configuration ID"
// @Param cluster query string true "Cluster name"
// @Success 101 {string} string "WebSocket connection established"
// @Failure 400 {object} map[string]string "Bad request"
// @Failure 403 {object} map[string]string "Forbidden - insufficient permissions"
// @Failure 404 {object} map[string]string "Pod not found"
// @Failure 500 {object} map[string]string "Internal server error"
// @Router /api/v1/cloudshell/ws [get]
// @Security BearerAuth
// @Security KubeConfig
func (h *CloudShellHandler) HandleCloudShellWebSocket(c *gin.Context) {
	// Start main span for cloud shell WebSocket operation
	ctx, span := h.tracingHelper.StartAuthSpan(c.Request.Context(), "websocket_connection")
	defer span.End()

	// Child span for WebSocket connection setup
	connCtx, connSpan := h.tracingHelper.StartKubernetesAPISpan(ctx, "connection_setup", "websocket", "")
	// Upgrade HTTP connection to WebSocket
	conn, err := h.upgrader.Upgrade(c.Writer, c.Request, nil)
	if err != nil {
		h.logger.WithError(err).Error("Failed to upgrade connection to WebSocket")
		h.tracingHelper.RecordError(connSpan, err, "Failed to upgrade to WebSocket")
		connSpan.End()
		h.tracingHelper.RecordError(span, err, "CloudShell WebSocket connection failed")
		return
	}
	defer conn.Close()
	h.tracingHelper.RecordSuccess(connSpan, "WebSocket connection established")
	connSpan.End()

	// Get parameters
	podName := c.Query("pod")
	namespace := c.Query("namespace")
	configID := c.Query("config")
	cluster := c.Query("cluster")

	// Add resource attributes
	span.SetAttributes(
		attribute.String("cloudshell.pod", podName),
		attribute.String("cloudshell.namespace", namespace),
	)

	if podName == "" || namespace == "" || configID == "" || cluster == "" {
		err := fmt.Errorf("pod, namespace, config, and cluster parameters are required")
		h.sendWebSocketError(conn, err.Error())
		h.tracingHelper.RecordError(span, err, "Missing required parameters")
		return
	}

	// Child span for client acquisition
	clientCtx, clientSpan := h.tracingHelper.StartAuthSpan(connCtx, "client_acquisition")
	// Get Kubernetes client and config
	client, restConfig, err := h.getClientAndConfig(c)
	if err != nil {
		h.logger.WithError(err).Error("Failed to get Kubernetes client for cloud shell")
		h.sendWebSocketError(conn, err.Error())
		h.tracingHelper.RecordError(clientSpan, err, "Failed to get Kubernetes client")
		clientSpan.End()
		h.tracingHelper.RecordError(span, err, "Client acquisition failed")
		return
	}
	h.tracingHelper.RecordSuccess(clientSpan, "Kubernetes client acquired")
	clientSpan.End()

	// Child span for permission checks
	permissionCtx, permissionSpan := h.tracingHelper.StartKubernetesAPISpan(clientCtx, "permission_check", "pods", namespace)
	// Check permissions to connect to this specific cloud shell pod
	if err := h.checkCloudShellConnectionPermissions(client, podName, namespace); err != nil {
		h.logger.WithError(err).WithFields(map[string]interface{}{
			"pod":       podName,
			"namespace": namespace,
			"config_id": configID,
			"cluster":   cluster,
		}).Error("Permission check failed for cloud shell connection")

		// Check if this is a permission error and return appropriate response
		if utils.IsPermissionError(err) {
			h.sendWebSocketError(conn, fmt.Sprintf("Permission denied: %v", err))
		} else {
			h.sendWebSocketError(conn, fmt.Sprintf("Failed to check permissions: %v", err))
		}
		h.tracingHelper.RecordError(permissionSpan, err, "Permission check failed")
		permissionSpan.End()
		h.tracingHelper.RecordError(span, err, "Permission denied")
		return
	}
	h.tracingHelper.RecordSuccess(permissionSpan, "Permission check completed")
	permissionSpan.End()

	// Child span for pod validation
	validationCtx, validationSpan := h.tracingHelper.StartKubernetesAPISpan(permissionCtx, "pod_validation", "pods", namespace)
	// Verify pod exists and is running
	pod, err := client.CoreV1().Pods(namespace).Get(c.Request.Context(), podName, metav1.GetOptions{})
	if err != nil {
		h.logger.WithError(err).WithField("pod", podName).WithField("namespace", namespace).Error("Failed to get cloud shell pod")
		h.sendWebSocketError(conn, fmt.Sprintf("Pod not found: %v", err))
		h.tracingHelper.RecordError(validationSpan, err, "Failed to get pod")
		validationSpan.End()
		h.tracingHelper.RecordError(span, err, "Pod validation failed")
		return
	}

	// Check if pod is being terminated
	if pod.DeletionTimestamp != nil {
		err := fmt.Errorf("pod is being terminated and cannot accept new connections")
		h.sendWebSocketError(conn, err.Error())
		h.tracingHelper.RecordError(validationSpan, err, "Pod being terminated")
		validationSpan.End()
		h.tracingHelper.RecordError(span, err, "Pod not available")
		return
	}

	// Check if pod is running
	if pod.Status.Phase != v1.PodRunning {
		err := fmt.Errorf("pod is not running, current phase: %s", pod.Status.Phase)
		h.sendWebSocketError(conn, err.Error())
		h.tracingHelper.RecordError(validationSpan, err, "Pod not running")
		validationSpan.End()
		h.tracingHelper.RecordError(span, err, "Pod not ready")
		return
	}
	h.tracingHelper.RecordSuccess(validationSpan, "Pod validation completed")
	validationSpan.End()

	// Child span for interactive session management
	_, sessionSpan := h.tracingHelper.StartKubernetesAPISpan(validationCtx, "session_management", "pods/exec", namespace)
	defer func() {
		h.tracingHelper.RecordSuccess(sessionSpan, "Interactive session completed")
		sessionSpan.End()
		h.tracingHelper.RecordSuccess(span, "Cloud shell WebSocket operation completed")
	}()

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
		h.tracingHelper.RecordError(sessionSpan, err, "Failed to create SPDY executor")
		sessionSpan.End()
		h.tracingHelper.RecordError(span, err, "Executor creation failed")
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
		h.logger.WithError(err).Error("Failed to start cloud shell exec stream")
		h.sendWebSocketError(conn, fmt.Sprintf("Failed to start exec: %v", err))
		h.tracingHelper.RecordError(sessionSpan, err, "Failed to start exec stream")
		sessionSpan.End()
		h.tracingHelper.RecordError(span, err, "Exec stream failed")
		return
	}
}

// ListCloudShellSessions lists all cloud shell sessions
// This function checks if the user has permissions to list pods in the namespace
// before returning the session list. Users must have permission to list pods.
// @Summary List Cloud Shell Sessions
// @Description List all active cloud shell sessions for a specific configuration and cluster
// @Tags Cloud Shell
// @Accept json
// @Produce json
// @Param config query string true "Kubernetes configuration ID"
// @Param cluster query string false "Cluster name"
// @Param namespace query string false "Namespace (default: default)"
// @Success 200 {object} map[string]interface{} "List of cloud shell sessions with limits"
// @Failure 400 {object} map[string]string "Bad request"
// @Failure 403 {object} map[string]string "Forbidden - insufficient permissions"
// @Failure 500 {object} map[string]string "Internal server error"
// @Router /api/v1/cloudshell [get]
// @Security BearerAuth
// @Security KubeConfig
func (h *CloudShellHandler) ListCloudShellSessions(c *gin.Context) {
	// Start main span for list cloud shell sessions operation
	ctx, span := h.tracingHelper.StartAuthSpan(c.Request.Context(), "list_sessions")
	defer span.End()

	configID := c.Query("config")
	cluster := c.Query("cluster")
	namespace := c.Query("namespace")

	if namespace == "" {
		namespace = "default"
	}

	// Add resource attributes
	span.SetAttributes(
		attribute.String("cloudshell.config_id", configID),
		attribute.String("cloudshell.cluster", cluster),
		attribute.String("cloudshell.namespace", namespace),
	)

	// Child span for client acquisition
	clientCtx, clientSpan := h.tracingHelper.StartAuthSpan(ctx, "client_acquisition")
	client, _, err := h.getClientAndConfig(c)
	if err != nil {
		// Enhanced error logging for 400 errors
		h.logger.WithFields(map[string]interface{}{
			"config_id":    configID,
			"cluster":      cluster,
			"namespace":    namespace,
			"error":        err.Error(),
			"user_agent":   c.GetHeader("User-Agent"),
			"client_ip":    c.ClientIP(),
			"request_path": c.Request.URL.Path,
			"query_params": c.Request.URL.RawQuery,
		}).Error("CloudShell client acquisition failed - returning 400")
		
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		h.tracingHelper.RecordError(clientSpan, err, "Failed to get Kubernetes client")
		clientSpan.End()
		h.tracingHelper.RecordError(span, err, "Client acquisition failed")
		return
	}
	h.tracingHelper.RecordSuccess(clientSpan, "Kubernetes client acquired")
	clientSpan.End()

	// Child span for permission checking
	_, permissionSpan := h.tracingHelper.StartKubernetesAPISpan(clientCtx, "permission_check", "pods", namespace)
	// Check permissions to list pods in the namespace
	if err := h.checkCloudShellPermissions(client, namespace); err != nil {
		h.logger.WithError(err).Error("Permission check failed for listing cloud shell sessions")

		// Check if this is a permission error and return appropriate response
		if utils.IsPermissionError(err) {
			permissionResponse := utils.CreatePermissionErrorResponse(err)
			c.JSON(http.StatusForbidden, permissionResponse)
		} else {
			c.JSON(http.StatusInternalServerError, gin.H{"error": fmt.Sprintf("Failed to check permissions: %v", err)})
		}
		h.tracingHelper.RecordError(permissionSpan, err, "Permission check failed")
		permissionSpan.End()
		h.tracingHelper.RecordError(span, err, "Permission denied")
		return
	}
	h.tracingHelper.RecordSuccess(permissionSpan, "Permission check completed")
	permissionSpan.End()

	// Child span for pod listing
	listCtx, listSpan := h.tracingHelper.StartKubernetesAPISpan(clientCtx, "list_pods", "pods", namespace)
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
		h.tracingHelper.RecordError(listSpan, err, "Failed to list pods")
		listSpan.End()
		h.tracingHelper.RecordError(span, err, "Pod listing failed")
		return
	}
	h.tracingHelper.RecordSuccess(listSpan, "Pods listed successfully")
	listSpan.End()

	// Child span for data processing
	_, dataSpan := h.tracingHelper.StartDataProcessingSpan(listCtx, "process_sessions")
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
	h.tracingHelper.RecordSuccess(dataSpan, "Sessions processed successfully")
	dataSpan.End()

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
	h.tracingHelper.RecordSuccess(span, "List cloud shell sessions operation completed")
}

// DeleteCloudShell deletes a cloud shell session
// This function checks if the user has permissions to delete pods in the namespace
// before allowing the deletion. Users must have permission to delete pods.
// @Summary Delete Cloud Shell Session
// @Description Delete a specific cloud shell session by name
// @Tags Cloud Shell
// @Accept json
// @Produce json
// @Param name path string true "Cloud shell session name"
// @Param namespace query string false "Namespace (default: default)"
// @Param config query string true "Kubernetes configuration ID"
// @Param cluster query string false "Cluster name"
// @Success 200 {object} map[string]string "Session deleted successfully"
// @Failure 400 {object} map[string]string "Bad request"
// @Failure 403 {object} map[string]string "Forbidden - insufficient permissions"
// @Failure 404 {object} map[string]string "Session not found"
// @Failure 500 {object} map[string]string "Internal server error"
// @Router /api/v1/cloudshell/{name} [delete]
// @Security BearerAuth
// @Security KubeConfig
func (h *CloudShellHandler) DeleteCloudShell(c *gin.Context) {
	// Start main span for delete cloud shell operation
	ctx, span := h.tracingHelper.StartAuthSpan(c.Request.Context(), "delete_session")
	defer span.End()

	podName := c.Param("name")
	namespace := c.Query("namespace")
	configID := c.Query("config")
	cluster := c.Query("cluster")

	if namespace == "" {
		namespace = "default"
	}

	// Add resource attributes
	span.SetAttributes(
		attribute.String("cloudshell.pod", podName),
		attribute.String("cloudshell.namespace", namespace),
	)

	// Child span for client acquisition
	clientCtx, clientSpan := h.tracingHelper.StartAuthSpan(ctx, "client_acquisition")
	client, _, err := h.getClientAndConfig(c)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		h.tracingHelper.RecordError(clientSpan, err, "Failed to get Kubernetes client")
		clientSpan.End()
		h.tracingHelper.RecordError(span, err, "Client acquisition failed")
		return
	}
	h.tracingHelper.RecordSuccess(clientSpan, "Kubernetes client acquired")
	clientSpan.End()

	// Child span for permission checking
	_, permissionSpan := h.tracingHelper.StartKubernetesAPISpan(clientCtx, "permission_check", "pods", namespace)
	// Check permissions to delete pods in the namespace
	if err := h.checkCloudShellPermissions(client, namespace); err != nil {
		h.logger.WithError(err).Error("Permission check failed for deleting cloud shell")

		// Check if this is a permission error and return appropriate response
		if utils.IsPermissionError(err) {
			permissionResponse := utils.CreatePermissionErrorResponse(err)
			c.JSON(http.StatusForbidden, permissionResponse)
		} else {
			c.JSON(http.StatusInternalServerError, gin.H{"error": fmt.Sprintf("Failed to check permissions: %v", err)})
		}
		h.tracingHelper.RecordError(permissionSpan, err, "Permission check failed")
		permissionSpan.End()
		h.tracingHelper.RecordError(span, err, "Permission denied")
		return
	}
	h.tracingHelper.RecordSuccess(permissionSpan, "Permission check completed")
	permissionSpan.End()

	// Child span for pod deletion
	podDeleteCtx, podDeleteSpan := h.tracingHelper.StartKubernetesAPISpan(clientCtx, "delete_pod", "pods", namespace)
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
		h.tracingHelper.RecordError(podDeleteSpan, err, "Failed to delete pod")
		podDeleteSpan.End()
		h.tracingHelper.RecordError(span, err, "Pod deletion failed")
		return
	}
	h.tracingHelper.RecordSuccess(podDeleteSpan, "Pod deleted successfully")
	podDeleteSpan.End()

	// Child span for ConfigMap cleanup
	_, cleanupSpan := h.tracingHelper.StartKubernetesAPISpan(podDeleteCtx, "cleanup_configmap", "configmaps", namespace)
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
			h.tracingHelper.RecordSuccess(cleanupSpan, "ConfigMap cleanup attempted (not critical if failed)")
		} else {
			h.logger.WithFields(map[string]interface{}{
				"config_map_name": configMapName,
				"namespace":       namespace,
				"cluster":         cluster,
				"config_id":       configID,
			}).Info("Successfully deleted cloud shell ConfigMap")
			h.tracingHelper.RecordSuccess(cleanupSpan, "ConfigMap deleted successfully")
		}
	} else {
		h.tracingHelper.RecordSuccess(cleanupSpan, "ConfigMap cleanup skipped (no config info provided)")
	}
	cleanupSpan.End()

	c.JSON(http.StatusOK, gin.H{
		"message": "Cloud shell deleted successfully",
	})
	h.tracingHelper.RecordSuccess(span, "Delete cloud shell operation completed")
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
// @Summary Manual Cloud Shell Cleanup
// @Description Manually trigger cleanup of old cloud shell sessions and orphaned resources
// @Tags Cloud Shell
// @Accept json
// @Produce json
// @Success 200 {object} map[string]string "Cleanup initiated successfully"
// @Router /api/v1/cloudshell/cleanup [post]
// @Security BearerAuth
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
