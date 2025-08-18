package configurations

import (
	"context"
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
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/client-go/kubernetes"
)

// SecretsHandler handles Secret-related API requests
type SecretsHandler struct {
	store         *storage.KubeConfigStore
	clientFactory *k8s.ClientFactory
	logger        *logger.Logger
	sseHandler    *utils.SSEHandler
	yamlHandler   *utils.YAMLHandler
	eventsHandler *utils.EventsHandler
	tracingHelper *tracing.TracingHelper
}

// NewSecretsHandler creates a new SecretsHandler
func NewSecretsHandler(store *storage.KubeConfigStore, clientFactory *k8s.ClientFactory, log *logger.Logger) *SecretsHandler {
	return &SecretsHandler{
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
func (h *SecretsHandler) getClientAndConfig(c *gin.Context) (*kubernetes.Clientset, error) {
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

// GetSecrets returns all secrets in a namespace
func (h *SecretsHandler) GetSecrets(c *gin.Context) {
	// Start child span for client setup
	ctx, clientSpan := h.tracingHelper.StartAuthSpan(c.Request.Context(), "get-client-config")
	defer clientSpan.End()

	client, err := h.getClientAndConfig(c)
	if err != nil {
		h.logger.WithError(err).Error("Failed to get client for secrets")
		h.tracingHelper.RecordError(clientSpan, err, "Failed to get Kubernetes client")
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	h.tracingHelper.RecordSuccess(clientSpan, "Client setup completed")

	namespace := c.Query("namespace")

	// Start child span for Kubernetes API call
	_, k8sSpan := h.tracingHelper.StartKubernetesAPISpan(ctx, "list", "secrets", namespace)
	defer k8sSpan.End()

	secretList, err := client.CoreV1().Secrets(namespace).List(ctx, metav1.ListOptions{})
	if err != nil {
		h.logger.WithError(err).Error("Failed to list secrets")
		h.tracingHelper.RecordError(k8sSpan, err, "Failed to list secrets")
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	h.tracingHelper.RecordSuccess(k8sSpan, "Successfully listed secrets")
	h.tracingHelper.AddResourceAttributes(k8sSpan, "secrets", "secret", len(secretList.Items))

	// Start child span for data processing
	_, processSpan := h.tracingHelper.StartDataProcessingSpan(ctx, "transform-secrets")
	defer processSpan.End()

	// Transform secrets to the expected format
	var transformedSecrets []types.SecretListResponse
	for _, secret := range secretList.Items {
		transformedSecrets = append(transformedSecrets, transformers.TransformSecretToResponse(&secret))
	}
	h.tracingHelper.RecordSuccess(processSpan, "Successfully transformed secrets")
	h.tracingHelper.AddResourceAttributes(processSpan, "transformed-secrets", "secret", len(transformedSecrets))

	c.JSON(http.StatusOK, transformedSecrets)
}

// GetSecretsSSE returns secrets as Server-Sent Events with real-time updates
func (h *SecretsHandler) GetSecretsSSE(c *gin.Context) {
	// Start child span for client setup
	ctx, clientSpan := h.tracingHelper.StartAuthSpan(c.Request.Context(), "setup-client-for-sse")
	defer clientSpan.End()

	client, err := h.getClientAndConfig(c)
	if err != nil {
		h.logger.WithError(err).Error("Failed to get client for secrets SSE")
		h.tracingHelper.RecordError(clientSpan, err, "Failed to get client for secrets SSE")
		h.sseHandler.SendSSEError(c, http.StatusBadRequest, err.Error())
		return
	}
	h.tracingHelper.RecordSuccess(clientSpan, "Client setup completed for secrets SSE")

	namespace := c.Query("namespace")

	// Function to fetch and transform secrets data
	fetchSecrets := func() (interface{}, error) {
		// Start child span for data fetching
		_, fetchSpan := h.tracingHelper.StartKubernetesAPISpan(ctx, "list", "secrets", namespace)
		defer fetchSpan.End()

		// Use context.Background() with timeout instead of request context to avoid cancellation
		fetchCtx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
		defer cancel()

		secretList, err := client.CoreV1().Secrets(namespace).List(fetchCtx, metav1.ListOptions{})
		if err != nil {
			h.tracingHelper.RecordError(fetchSpan, err, "Failed to fetch secrets for SSE")
			return nil, err
		}
		h.tracingHelper.RecordSuccess(fetchSpan, "Successfully fetched secrets for SSE")
		h.tracingHelper.AddResourceAttributes(fetchSpan, "secrets", "secret", len(secretList.Items))

		// Start child span for data transformation
		_, transformSpan := h.tracingHelper.StartDataProcessingSpan(ctx, "transform-secrets-sse")
		defer transformSpan.End()

		// Transform secrets to the expected format
		var transformedSecrets []types.SecretListResponse
		for _, secret := range secretList.Items {
			transformedSecrets = append(transformedSecrets, transformers.TransformSecretToResponse(&secret))
		}
		h.tracingHelper.RecordSuccess(transformSpan, "Successfully transformed secrets for SSE")
		h.tracingHelper.AddResourceAttributes(transformSpan, "transformed-secrets", "secret", len(transformedSecrets))

		return transformedSecrets, nil
	}

	// Get initial data
	initialData, err := fetchSecrets()
	if err != nil {
		h.logger.WithError(err).Error("Failed to list secrets for SSE")

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
		h.sseHandler.SendSSEResponseWithUpdates(c, initialData, fetchSecrets)
		return
	}

	// For non-SSE requests, return JSON
	c.JSON(http.StatusOK, initialData)
}

// GetSecret returns a specific secret
func (h *SecretsHandler) GetSecret(c *gin.Context) {
	// Start child span for client setup
	ctx, clientSpan := h.tracingHelper.StartAuthSpan(c.Request.Context(), "get-client-config")
	defer clientSpan.End()

	client, err := h.getClientAndConfig(c)
	if err != nil {
		h.logger.WithError(err).Error("Failed to get client for secret")
		h.tracingHelper.RecordError(clientSpan, err, "Failed to get Kubernetes client")
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	h.tracingHelper.RecordSuccess(clientSpan, "Client setup completed")

	namespace := c.Param("namespace")
	name := c.Param("name")

	// Start child span for Kubernetes API call
	_, k8sSpan := h.tracingHelper.StartKubernetesAPISpan(ctx, "get", "secret", namespace)
	defer k8sSpan.End()

	secret, err := client.CoreV1().Secrets(namespace).Get(ctx, name, metav1.GetOptions{})
	if err != nil {
		h.logger.WithError(err).WithField("secret", name).WithField("namespace", namespace).Error("Failed to get secret")
		h.tracingHelper.RecordError(k8sSpan, err, "Failed to get secret")
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}
	h.tracingHelper.RecordSuccess(k8sSpan, "Successfully retrieved secret")
	h.tracingHelper.AddResourceAttributes(k8sSpan, name, "secret", 1)

	// Check if this is an SSE request (EventSource expects SSE format)
	acceptHeader := c.GetHeader("Accept")
	if acceptHeader == "text/event-stream" {
		h.sseHandler.SendSSEResponse(c, secret)
		return
	}

	c.JSON(http.StatusOK, secret)
}

// GetSecretByName returns a specific secret by name using namespace from query parameters
func (h *SecretsHandler) GetSecretByName(c *gin.Context) {
	// Start child span for client setup
	ctx, clientSpan := h.tracingHelper.StartAuthSpan(c.Request.Context(), "get-client-config")
	defer clientSpan.End()

	client, err := h.getClientAndConfig(c)
	if err != nil {
		h.logger.WithError(err).Error("Failed to get client for secret")
		h.tracingHelper.RecordError(clientSpan, err, "Failed to get Kubernetes client")
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	h.tracingHelper.RecordSuccess(clientSpan, "Client setup completed")

	name := c.Param("name")
	namespace := c.Query("namespace")

	if namespace == "" {
		h.logger.WithField("secret", name).Error("Namespace is required for secret lookup")
		c.JSON(http.StatusBadRequest, gin.H{"error": "namespace parameter is required"})
		return
	}

	// Start child span for Kubernetes API call
	_, k8sSpan := h.tracingHelper.StartKubernetesAPISpan(ctx, "get", "secret", namespace)
	defer k8sSpan.End()

	secret, err := client.CoreV1().Secrets(namespace).Get(ctx, name, metav1.GetOptions{})
	if err != nil {
		h.logger.WithError(err).WithField("secret", name).WithField("namespace", namespace).Error("Failed to get secret")
		h.tracingHelper.RecordError(k8sSpan, err, "Failed to get secret")
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}
	h.tracingHelper.RecordSuccess(k8sSpan, "Successfully retrieved secret")
	h.tracingHelper.AddResourceAttributes(k8sSpan, name, "secret", 1)

	// Check if this is an SSE request (EventSource expects SSE format)
	acceptHeader := c.GetHeader("Accept")
	if acceptHeader == "text/event-stream" {
		h.sseHandler.SendSSEResponse(c, secret)
		return
	}

	c.JSON(http.StatusOK, secret)
}

// GetSecretYAMLByName returns the YAML representation of a specific secret by name using namespace from query parameters
func (h *SecretsHandler) GetSecretYAMLByName(c *gin.Context) {
	// Start child span for client setup
	ctx, clientSpan := h.tracingHelper.StartAuthSpan(c.Request.Context(), "get-client-config")
	defer clientSpan.End()

	client, err := h.getClientAndConfig(c)
	if err != nil {
		h.logger.WithError(err).Error("Failed to get client for secret YAML")
		h.tracingHelper.RecordError(clientSpan, err, "Failed to get Kubernetes client")
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	h.tracingHelper.RecordSuccess(clientSpan, "Client setup completed")

	name := c.Param("name")
	namespace := c.Query("namespace")

	if namespace == "" {
		h.logger.WithField("secret", name).Error("Namespace is required for secret YAML lookup")
		c.JSON(http.StatusBadRequest, gin.H{"error": "namespace parameter is required"})
		return
	}

	// Start child span for Kubernetes API call
	_, k8sSpan := h.tracingHelper.StartKubernetesAPISpan(ctx, "get", "secret", namespace)
	defer k8sSpan.End()

	secret, err := client.CoreV1().Secrets(namespace).Get(ctx, name, metav1.GetOptions{})
	if err != nil {
		h.logger.WithError(err).WithField("secret", name).WithField("namespace", namespace).Error("Failed to get secret for YAML")
		h.tracingHelper.RecordError(k8sSpan, err, "Failed to get secret for YAML")
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}
	h.tracingHelper.RecordSuccess(k8sSpan, "Successfully retrieved secret for YAML")
	h.tracingHelper.AddResourceAttributes(k8sSpan, name, "secret", 1)

	// Start child span for YAML generation
	_, yamlSpan := h.tracingHelper.StartDataProcessingSpan(ctx, "generate-yaml")
	defer yamlSpan.End()

	h.yamlHandler.SendYAMLResponse(c, secret, name)
	h.tracingHelper.RecordSuccess(yamlSpan, "Successfully generated YAML response")
}

// GetSecretYAML returns the YAML representation of a specific secret
func (h *SecretsHandler) GetSecretYAML(c *gin.Context) {
	// Start child span for client setup
	ctx, clientSpan := h.tracingHelper.StartAuthSpan(c.Request.Context(), "get-client-config")
	defer clientSpan.End()

	client, err := h.getClientAndConfig(c)
	if err != nil {
		h.logger.WithError(err).Error("Failed to get client for secret YAML")
		h.tracingHelper.RecordError(clientSpan, err, "Failed to get Kubernetes client")
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	h.tracingHelper.RecordSuccess(clientSpan, "Client setup completed")

	namespace := c.Param("namespace")
	name := c.Param("name")

	// Start child span for Kubernetes API call
	_, k8sSpan := h.tracingHelper.StartKubernetesAPISpan(ctx, "get", "secret", namespace)
	defer k8sSpan.End()

	secret, err := client.CoreV1().Secrets(namespace).Get(ctx, name, metav1.GetOptions{})
	if err != nil {
		h.logger.WithError(err).WithField("secret", name).WithField("namespace", namespace).Error("Failed to get secret for YAML")
		h.tracingHelper.RecordError(k8sSpan, err, "Failed to get secret for YAML")
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}
	h.tracingHelper.RecordSuccess(k8sSpan, "Successfully retrieved secret for YAML")
	h.tracingHelper.AddResourceAttributes(k8sSpan, name, "secret", 1)

	// Start child span for YAML generation
	_, yamlSpan := h.tracingHelper.StartDataProcessingSpan(ctx, "generate-yaml")
	defer yamlSpan.End()

	h.yamlHandler.SendYAMLResponse(c, secret, name)
	h.tracingHelper.RecordSuccess(yamlSpan, "Successfully generated YAML response")
}

// GetSecretEventsByName returns events for a specific secret by name using namespace from query parameters
func (h *SecretsHandler) GetSecretEventsByName(c *gin.Context) {
	name := c.Param("name")
	namespace := c.Query("namespace")

	if namespace == "" {
		h.logger.WithField("secret", name).Error("Namespace is required for secret events lookup")
		c.JSON(http.StatusBadRequest, gin.H{"error": "namespace parameter is required"})
		return
	}

	// Start child span for client setup
	ctx, clientSpan := h.tracingHelper.StartAuthSpan(c.Request.Context(), "get-client-config")
	defer clientSpan.End()

	client, err := h.getClientAndConfig(c)
	if err != nil {
		h.logger.WithError(err).Error("Failed to get client for secret events")
		h.tracingHelper.RecordError(clientSpan, err, "Failed to get Kubernetes client")
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	h.tracingHelper.RecordSuccess(clientSpan, "Client setup completed")

	// Start child span for events retrieval
	_, eventsSpan := h.tracingHelper.StartKubernetesAPISpan(ctx, "list", "events", namespace)
	defer eventsSpan.End()

	h.eventsHandler.GetResourceEventsWithNamespace(c, client, "Secret", name, namespace, h.sseHandler.SendSSEResponse)
	h.tracingHelper.RecordSuccess(eventsSpan, "Successfully retrieved secret events")
	h.tracingHelper.AddResourceAttributes(eventsSpan, name, "secret-events", 1)
}

// GetSecretEvents returns events for a specific secret
func (h *SecretsHandler) GetSecretEvents(c *gin.Context) {
	name := c.Param("name")
	namespace := c.Param("namespace")

	// Start child span for client setup
	ctx, clientSpan := h.tracingHelper.StartAuthSpan(c.Request.Context(), "get-client-config")
	defer clientSpan.End()

	client, err := h.getClientAndConfig(c)
	if err != nil {
		h.logger.WithError(err).Error("Failed to get client for secret events")
		h.tracingHelper.RecordError(clientSpan, err, "Failed to get Kubernetes client")
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	h.tracingHelper.RecordSuccess(clientSpan, "Client setup completed")

	// Start child span for events retrieval
	_, eventsSpan := h.tracingHelper.StartKubernetesAPISpan(ctx, "list", "events", namespace)
	defer eventsSpan.End()

	h.eventsHandler.GetResourceEventsWithNamespace(c, client, "Secret", name, namespace, h.sseHandler.SendSSEResponse)
	h.tracingHelper.RecordSuccess(eventsSpan, "Successfully retrieved secret events")
	h.tracingHelper.AddResourceAttributes(eventsSpan, name, "secret-events", 1)
}
