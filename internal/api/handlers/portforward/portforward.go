package portforward

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"math/rand"
	"net"
	"net/http"
	"strconv"
	"sync"
	"time"

	"github.com/Facets-cloud/kube-dash/internal/k8s"
	"github.com/Facets-cloud/kube-dash/internal/storage"
	"github.com/Facets-cloud/kube-dash/internal/tracing"
	"github.com/Facets-cloud/kube-dash/pkg/logger"

	"github.com/gin-gonic/gin"
	"github.com/gorilla/websocket"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/client-go/kubernetes"
	"k8s.io/client-go/rest"
	"k8s.io/client-go/tools/clientcmd"
	"k8s.io/client-go/tools/portforward"
	"k8s.io/client-go/transport/spdy"
)

// PortForwardOutput captures the output from the port forwarder
type PortForwardOutput struct {
	mu     sync.Mutex
	buffer bytes.Buffer
}

// findAvailablePort finds an available port starting from a high port number
func findAvailablePort() (int, error) {
	// Start from port 30000 to avoid common ports
	startPort := 30000
	maxAttempts := 1000

	// Try ports in a random order to avoid conflicts
	ports := make([]int, maxAttempts)
	for i := 0; i < maxAttempts; i++ {
		ports[i] = startPort + i
	}

	// Shuffle the ports
	rand.Seed(time.Now().UnixNano())
	rand.Shuffle(len(ports), func(i, j int) {
		ports[i], ports[j] = ports[j], ports[i]
	})

	for _, port := range ports {
		// Try to listen on the port to see if it's available
		listener, err := net.Listen("tcp", fmt.Sprintf(":%d", port))
		if err == nil {
			listener.Close()
			return port, nil
		}
	}

	return 0, fmt.Errorf("no available ports found in range %d-%d", startPort, startPort+maxAttempts-1)
}

func (pfo *PortForwardOutput) Write(p []byte) (n int, err error) {
	pfo.mu.Lock()
	defer pfo.mu.Unlock()
	return pfo.buffer.Write(p)
}

func (pfo *PortForwardOutput) String() string {
	pfo.mu.Lock()
	defer pfo.mu.Unlock()
	return pfo.buffer.String()
}

func (pfo *PortForwardOutput) Clear() {
	pfo.mu.Lock()
	defer pfo.mu.Unlock()
	pfo.buffer.Reset()
}

// PortForwardSession represents an active port forward session
type PortForwardSession struct {
	ID           string    `json:"id"`
	ResourceType string    `json:"resourceType"`
	ResourceName string    `json:"resourceName"`
	Namespace    string    `json:"namespace"`
	LocalPort    int       `json:"localPort"`
	RemotePort   int       `json:"remotePort"`
	Protocol     string    `json:"protocol"`
	Status       string    `json:"status"`
	CreatedAt    time.Time `json:"createdAt"`
	ConfigID     string    `json:"configId"`
	Cluster      string    `json:"cluster"`
	StopChan     chan struct{}
	Conn         *websocket.Conn
	LastActivity time.Time `json:"lastActivity"`
	stopOnce     sync.Once
}

// PortForwardSessionJSON represents a port forward session for JSON serialization
type PortForwardSessionJSON struct {
	ID           string    `json:"id"`
	ResourceType string    `json:"resourceType"`
	ResourceName string    `json:"resourceName"`
	Namespace    string    `json:"namespace"`
	LocalPort    int       `json:"localPort"`
	RemotePort   int       `json:"remotePort"`
	Protocol     string    `json:"protocol"`
	Status       string    `json:"status"`
	CreatedAt    time.Time `json:"createdAt"`
	ConfigID     string    `json:"configId"`
	Cluster      string    `json:"cluster"`
}

// ToJSON converts PortForwardSession to PortForwardSessionJSON
func (s *PortForwardSession) ToJSON() *PortForwardSessionJSON {
	return &PortForwardSessionJSON{
		ID:           s.ID,
		ResourceType: s.ResourceType,
		ResourceName: s.ResourceName,
		Namespace:    s.Namespace,
		LocalPort:    s.LocalPort,
		RemotePort:   s.RemotePort,
		Protocol:     s.Protocol,
		Status:       s.Status,
		CreatedAt:    s.CreatedAt,
		ConfigID:     s.ConfigID,
		Cluster:      s.Cluster,
	}
}

// SafeStop safely stops the session, preventing multiple channel closes
func (s *PortForwardSession) SafeStop() {
	s.stopOnce.Do(func() {
		select {
		case <-s.StopChan:
			// Channel already closed
		default:
			close(s.StopChan)
		}
	})
}

// UpdateActivity updates the last activity time
func (s *PortForwardSession) UpdateActivity() {
	s.LastActivity = time.Now()
}

// PortForwardHandler handles WebSocket-based port forward operations
type PortForwardHandler struct {
	store         *storage.KubeConfigStore
	clientFactory *k8s.ClientFactory
	logger        *logger.Logger
	upgrader      websocket.Upgrader
	sessions      map[string]*PortForwardSession
	sessionsMutex sync.RWMutex
	tracingHelper *tracing.TracingHelper
}

// NewPortForwardHandler creates a new PortForwardHandler
func NewPortForwardHandler(store *storage.KubeConfigStore, clientFactory *k8s.ClientFactory, log *logger.Logger) *PortForwardHandler {
	handler := &PortForwardHandler{
		store:         store,
		clientFactory: clientFactory,
		logger:        log,
		upgrader: websocket.Upgrader{
			CheckOrigin: func(r *http.Request) bool {
				return true // Allow all origins for now
			},
		},
		sessions:      make(map[string]*PortForwardSession),
		tracingHelper: tracing.GetTracingHelper(),
	}

	// Start inactivity monitor
	go handler.startInactivityMonitor()

	return handler
}

// startInactivityMonitor monitors sessions for inactivity and stops them after timeout
func (h *PortForwardHandler) startInactivityMonitor() {
	ticker := time.NewTicker(30 * time.Second) // Check every 30 seconds
	defer ticker.Stop()

	for range ticker.C {
		h.sessionsMutex.Lock()
		now := time.Now()
		sessionsToStop := []string{}

		for id, session := range h.sessions {
			// Stop sessions that have been inactive for more than 30 minutes
			if now.Sub(session.LastActivity) > 30*time.Minute {
				sessionsToStop = append(sessionsToStop, id)
				h.logger.WithField("sessionId", id).Info("Stopping inactive port forward session")
			}
		}

		// Stop sessions outside the lock to avoid deadlock
		for _, id := range sessionsToStop {
			if session, exists := h.sessions[id]; exists {
				session.SafeStop()
				delete(h.sessions, id)
			}
		}
		h.sessionsMutex.Unlock()
	}
}

// getClientAndConfig gets the Kubernetes client and config for the given config ID and cluster
func (h *PortForwardHandler) getClientAndConfig(c *gin.Context) (*kubernetes.Clientset, *rest.Config, error) {
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

// HandlePortForward handles WebSocket-based port forward
func (h *PortForwardHandler) HandlePortForward(c *gin.Context) {
	// Start main span for port forward operation
	ctx, span := h.tracingHelper.StartAuthSpan(c.Request.Context(), "portforward.websocket_connection")
	defer span.End()

	h.logger.Info("Port forward WebSocket request received")

	// Child span for WebSocket connection setup
	connCtx, connSpan := h.tracingHelper.StartKubernetesAPISpan(ctx, "connection_setup", "websocket", "")
	// Upgrade HTTP connection to WebSocket
	conn, err := h.upgrader.Upgrade(c.Writer, c.Request, nil)
	if err != nil {
		h.logger.WithError(err).Error("Failed to upgrade connection to WebSocket")
		h.tracingHelper.RecordError(connSpan, err, "Failed to upgrade WebSocket connection")
		connSpan.End()
		h.tracingHelper.RecordError(span, err, "Port forward operation failed")
		return
	}
	defer conn.Close()
	h.tracingHelper.RecordSuccess(connSpan, "WebSocket connection established")
	connSpan.End()

	// Child span for parameter validation
	validationCtx, validationSpan := h.tracingHelper.StartKubernetesAPISpan(connCtx, "parameter_validation", "portforward", "")
	// Get parameters
	resourceType := c.Query("resourceType")
	resourceName := c.Query("resourceName")
	namespace := c.Query("namespace")
	localPortStr := c.Query("localPort")
	remotePortStr := c.Query("remotePort")
	protocol := c.Query("protocol")
	configID := c.Query("config")
	cluster := c.Query("cluster")

	// Add resource attributes
	h.tracingHelper.AddResourceAttributes(span, resourceName, resourceType, 1)

	// Validate required parameters
	if resourceType == "" || resourceName == "" || namespace == "" || remotePortStr == "" {
		err := fmt.Errorf("resourceType, resourceName, namespace, and remotePort are required")
		h.sendWebSocketError(conn, err.Error())
		h.tracingHelper.RecordError(validationSpan, err, "Missing required parameters")
		validationSpan.End()
		h.tracingHelper.RecordError(span, err, "Port forward operation failed")
		return
	}

	// Parse ports
	remotePort, err := strconv.Atoi(remotePortStr)
	if err != nil {
		err := fmt.Errorf("invalid remotePort: %w", err)
		h.sendWebSocketError(conn, err.Error())
		h.tracingHelper.RecordError(validationSpan, err, "Invalid remote port")
		validationSpan.End()
		h.tracingHelper.RecordError(span, err, "Port forward operation failed")
		return
	}

	localPort := 0
	if localPortStr != "" {
		localPort, err = strconv.Atoi(localPortStr)
		if err != nil {
			err := fmt.Errorf("invalid localPort: %w", err)
			h.sendWebSocketError(conn, err.Error())
			h.tracingHelper.RecordError(validationSpan, err, "Invalid local port")
			validationSpan.End()
			h.tracingHelper.RecordError(span, err, "Port forward operation failed")
			return
		}
	}

	// Set default protocol
	if protocol == "" {
		protocol = "TCP"
	}
	h.tracingHelper.RecordSuccess(validationSpan, "Parameter validation completed")
	validationSpan.End()

	// Child span for client acquisition
	clientCtx, clientSpan := h.tracingHelper.StartKubernetesAPISpan(validationCtx, "client_acquisition", "kubernetes", namespace)
	// Get Kubernetes client and config
	client, restConfig, err := h.getClientAndConfig(c)
	if err != nil {
		h.logger.WithError(err).Error("Failed to get Kubernetes client for port forward")
		h.sendWebSocketError(conn, err.Error())
		h.tracingHelper.RecordError(clientSpan, err, "Failed to acquire Kubernetes client")
		clientSpan.End()
		h.tracingHelper.RecordError(span, err, "Port forward operation failed")
		return
	}
	h.tracingHelper.RecordSuccess(clientSpan, "Kubernetes client acquired")
	clientSpan.End()

	// Create port forward session
	session := &PortForwardSession{
		ID:           fmt.Sprintf("%s-%s-%s-%d", resourceType, resourceName, namespace, remotePort),
		ResourceType: resourceType,
		ResourceName: resourceName,
		Namespace:    namespace,
		LocalPort:    localPort,
		RemotePort:   remotePort,
		Protocol:     protocol,
		Status:       "connecting",
		CreatedAt:    time.Now(),
		ConfigID:     configID,
		Cluster:      cluster,
		StopChan:     make(chan struct{}),
		Conn:         conn,
		LastActivity: time.Now(),
	}

	// Add session to active sessions
	h.sessionsMutex.Lock()
	h.sessions[session.ID] = session
	h.sessionsMutex.Unlock()

	// Cleanup session when connection closes
	defer func() {
		h.sessionsMutex.Lock()
		delete(h.sessions, session.ID)
		h.sessionsMutex.Unlock()
		session.SafeStop()
	}()

	// Send session created message
	h.sendWebSocketMessage(conn, map[string]interface{}{
		"type":    "session_created",
		"session": session.ToJSON(),
	})

	// Child span for port forwarding operations
	forwardCtx, forwardSpan := h.tracingHelper.StartKubernetesAPISpan(clientCtx, "portforward_operation", resourceType, namespace)
	// Start port forward based on resource type
	switch resourceType {
	case "pod":
		err = h.startPodPortForward(session, client, restConfig)
	case "service":
		err = h.startServicePortForward(session, client, restConfig)
	default:
		err = fmt.Errorf("unsupported resource type: %s", resourceType)
	}

	if err != nil {
		h.logger.WithError(err).Error("Failed to start port forward")
		h.sendWebSocketError(conn, fmt.Sprintf("Failed to start port forward: %v", err))
		h.tracingHelper.RecordError(forwardSpan, err, "Port forward operation failed")
		forwardSpan.End()
		h.tracingHelper.RecordError(span, err, "Port forward operation failed")
		return
	}
	h.tracingHelper.RecordSuccess(forwardSpan, "Port forwarding started successfully")
	forwardSpan.End()

	// Child span for connection management
	_, managementSpan := h.tracingHelper.StartKubernetesAPISpan(forwardCtx, "connection_management", "portforward", namespace)
	defer func() {
		h.tracingHelper.RecordSuccess(managementSpan, "Connection management completed")
		managementSpan.End()
		h.tracingHelper.RecordSuccess(span, "Port forward operation completed")
	}()

	// Keep connection alive and handle messages
	heartbeatTicker := time.NewTicker(30 * time.Second)
	defer heartbeatTicker.Stop()

	for {
		select {
		case <-session.StopChan:
			return
		case <-heartbeatTicker.C:
			// Send heartbeat to keep connection alive and update activity
			session.UpdateActivity()
			h.sendWebSocketMessage(conn, map[string]interface{}{
				"type":      "heartbeat",
				"timestamp": time.Now().Unix(),
			})
		default:
			// Read messages from WebSocket (for future features like stopping port forward)
			_, message, err := conn.ReadMessage()
			if err != nil {
				h.logger.WithError(err).Debug("WebSocket read error, closing connection")
				return
			}

			// Update activity timestamp
			session.UpdateActivity()

			// Handle incoming messages
			var msg map[string]interface{}
			if err := json.Unmarshal(message, &msg); err != nil {
				h.logger.WithError(err).Debug("Failed to parse WebSocket message")
				continue
			}

			// Handle stop command
			if msgType, ok := msg["type"].(string); ok && msgType == "stop" {
				h.logger.Info("Received stop command for port forward session")
				return
			}
		}
	}
}

// startPodPortForward starts port forwarding for a pod
func (h *PortForwardHandler) startPodPortForward(session *PortForwardSession, client *kubernetes.Clientset, restConfig *rest.Config) error {
	// Verify pod exists and is running
	pod, err := client.CoreV1().Pods(session.Namespace).Get(context.Background(), session.ResourceName, metav1.GetOptions{})
	if err != nil {
		return fmt.Errorf("failed to get pod: %w", err)
	}

	if pod.Status.Phase != "Running" {
		return fmt.Errorf("pod is not running. Current phase: %s", pod.Status.Phase)
	}

	// Create port forward request
	req := client.CoreV1().RESTClient().Post().
		Resource("pods").
		Name(session.ResourceName).
		Namespace(session.Namespace).
		SubResource("portforward")

	// Create SPDY transport
	transport, upgrader, err := spdy.RoundTripperFor(restConfig)
	if err != nil {
		return fmt.Errorf("failed to create SPDY transport: %w", err)
	}

	// Create dialer
	dialer := spdy.NewDialer(upgrader, &http.Client{Transport: transport}, "POST", req.URL())

	// Create custom output capture
	output := &PortForwardOutput{}

	// If localPort is 0, find an available port ourselves
	if session.LocalPort == 0 {
		availablePort, err := findAvailablePort()
		if err != nil {
			return fmt.Errorf("failed to find available port: %w", err)
		}
		session.LocalPort = availablePort
		h.logger.WithField("localPort", availablePort).Info("Found available local port")

		// Immediately notify the client about the assigned port
		h.sendWebSocketMessage(session.Conn, map[string]interface{}{
			"type":      "port_assigned",
			"localPort": availablePort,
			"session":   session.ToJSON(),
		})
	}

	// Create port forwarder with our assigned port
	portString := fmt.Sprintf("%d:%d", session.LocalPort, session.RemotePort)
	ports := []string{portString}

	// Create ready channel for port forwarder
	readyChan := make(chan struct{})

	pf, err := portforward.New(dialer, ports, session.StopChan, readyChan, output, output)
	if err != nil {
		return fmt.Errorf("failed to create port forwarder: %w", err)
	}

	// Update session status to connecting
	session.Status = "connecting"
	h.sendWebSocketMessage(session.Conn, map[string]interface{}{
		"type":    "status_update",
		"session": session.ToJSON(),
	})

	// Start port forwarding in a goroutine
	go func() {
		h.logger.Info("Starting port forward goroutine")

		// Wait for port forwarder to be ready (with timeout)
		select {
		case <-readyChan:
			session.UpdateActivity()
			h.logger.Info("Port forwarder ready signal received")

			// Update session status to running
			session.Status = "running"
			h.sendWebSocketMessage(session.Conn, map[string]interface{}{
				"type":    "status_update",
				"session": session.ToJSON(),
			})

			// Send success message
			h.sendWebSocketMessage(session.Conn, map[string]interface{}{
				"type": "port_forward_started",
				"message": fmt.Sprintf("Port forward started: localhost:%d -> %s:%d",
					session.LocalPort, session.ResourceName, session.RemotePort),
				"session": session.ToJSON(),
			})

		case <-time.After(10 * time.Second):
			h.logger.Warn("Port forwarder ready signal timeout, but continuing")

			// Update session status to running
			session.Status = "running"
			h.sendWebSocketMessage(session.Conn, map[string]interface{}{
				"type":    "status_update",
				"session": session.ToJSON(),
			})

			// Send success message
			h.sendWebSocketMessage(session.Conn, map[string]interface{}{
				"type": "port_forward_started",
				"message": fmt.Sprintf("Port forward started: localhost:%d -> %s:%d",
					session.LocalPort, session.ResourceName, session.RemotePort),
				"session": session.ToJSON(),
			})

		case <-session.StopChan:
			h.logger.Info("Session stopped before port forwarder ready")
			return
		}

		// Start the actual port forwarding (this is blocking)
		h.logger.Info("Starting actual port forwarding")
		err := pf.ForwardPorts()
		if err != nil {
			h.logger.WithError(err).Error("Port forward error")
			session.Status = "error"
			h.sendWebSocketMessage(session.Conn, map[string]interface{}{
				"type":    "error",
				"message": fmt.Sprintf("Port forward error: %v", err),
			})
		} else {
			h.logger.Info("Port forwarding completed")
			session.Status = "stopped"
			h.sendWebSocketMessage(session.Conn, map[string]interface{}{
				"type":    "status_update",
				"session": session.ToJSON(),
			})
		}
	}()

	return nil
}

// startServicePortForward starts port forwarding for a service
func (h *PortForwardHandler) startServicePortForward(session *PortForwardSession, client *kubernetes.Clientset, restConfig *rest.Config) error {
	// For services, we need to find a pod to forward to
	// This is a simplified implementation - in practice, you might want to select a specific pod
	pods, err := client.CoreV1().Pods(session.Namespace).List(context.Background(), metav1.ListOptions{
		LabelSelector: fmt.Sprintf("app=%s", session.ResourceName), // This is a simplified selector
	})
	if err != nil {
		return fmt.Errorf("failed to list pods for service: %w", err)
	}

	if len(pods.Items) == 0 {
		return fmt.Errorf("no pods found for service %s", session.ResourceName)
	}

	// Use the first available pod
	podName := pods.Items[0].Name
	session.ResourceName = podName // Update session to reflect actual pod being used

	return h.startPodPortForward(session, client, restConfig)
}

// GetActiveSessions returns all active port forward sessions
func (h *PortForwardHandler) GetActiveSessions(c *gin.Context) {
	// Start main span for get active sessions operation
	ctx, span := h.tracingHelper.StartAuthSpan(c.Request.Context(), "portforward.get_active_sessions")
	defer span.End()

	// Child span for data processing
	_, dataSpan := h.tracingHelper.StartDataProcessingSpan(ctx, "portforward.process_sessions")
	h.sessionsMutex.RLock()
	defer h.sessionsMutex.RUnlock()

	sessions := make([]*PortForwardSessionJSON, 0, len(h.sessions))
	for _, session := range h.sessions {
		// Create a copy without the WebSocket connection and stop channel
		sessionCopy := session.ToJSON()
		sessions = append(sessions, sessionCopy)
	}
	h.tracingHelper.RecordSuccess(dataSpan, "Sessions processed successfully")
	dataSpan.End()

	c.JSON(http.StatusOK, gin.H{
		"sessions": sessions,
		"count":    len(sessions),
	})
	h.tracingHelper.RecordSuccess(span, "Get active sessions operation completed")
}

// StopSession stops a specific port forward session
func (h *PortForwardHandler) StopSession(c *gin.Context) {
	// Start main span for stop session operation
	ctx, span := h.tracingHelper.StartAuthSpan(c.Request.Context(), "portforward.stop_session")
	defer span.End()

	sessionID := c.Param("id")

	// Add resource attributes
	h.tracingHelper.AddResourceAttributes(span, sessionID, "portforward_session", 1)

	// Child span for session lookup
	_, lookupSpan := h.tracingHelper.StartDataProcessingSpan(ctx, "portforward.session_lookup")
	h.sessionsMutex.Lock()
	session, exists := h.sessions[sessionID]
	h.sessionsMutex.Unlock()

	if !exists {
		err := fmt.Errorf("session not found: %s", sessionID)
		c.JSON(http.StatusNotFound, gin.H{"error": "session not found"})
		h.tracingHelper.RecordError(lookupSpan, err, "Session not found")
		lookupSpan.End()
		h.tracingHelper.RecordError(span, err, "Stop session operation failed")
		return
	}
	h.tracingHelper.RecordSuccess(lookupSpan, "Session found successfully")
	lookupSpan.End()

	// Child span for session termination
	_, terminationSpan := h.tracingHelper.StartKubernetesAPISpan(ctx, "session_termination", "portforward", "")
	// Stop the session
	close(session.StopChan)

	// Remove from active sessions
	h.sessionsMutex.Lock()
	delete(h.sessions, sessionID)
	h.sessionsMutex.Unlock()
	h.tracingHelper.RecordSuccess(terminationSpan, "Session terminated successfully")
	terminationSpan.End()

	c.JSON(http.StatusOK, gin.H{"message": "session stopped successfully"})
	h.tracingHelper.RecordSuccess(span, "Stop session operation completed")
}

// sendWebSocketMessage sends a message through the WebSocket
func (h *PortForwardHandler) sendWebSocketMessage(conn *websocket.Conn, message interface{}) {
	jsonData, err := json.Marshal(message)
	if err != nil {
		h.logger.WithError(err).Error("Failed to marshal WebSocket message")
		return
	}

	err = conn.WriteMessage(websocket.TextMessage, jsonData)
	if err != nil {
		h.logger.WithError(err).Error("Failed to send WebSocket message")
	}
}

// sendWebSocketError sends an error message through the WebSocket
func (h *PortForwardHandler) sendWebSocketError(conn *websocket.Conn, message string) {
	errorMsg := map[string]interface{}{
		"type":  "error",
		"error": message,
	}
	h.sendWebSocketMessage(conn, errorMsg)
}
