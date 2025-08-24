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

// HPAsHandler handles HorizontalPodAutoscaler-related API requests
type HPAsHandler struct {
	store         *storage.KubeConfigStore
	clientFactory *k8s.ClientFactory
	logger        *logger.Logger
	sseHandler    *utils.SSEHandler
	yamlHandler   *utils.YAMLHandler
	eventsHandler *utils.EventsHandler
	tracingHelper *tracing.TracingHelper
}

// NewHPAsHandler creates a new HPAsHandler
func NewHPAsHandler(store *storage.KubeConfigStore, clientFactory *k8s.ClientFactory, log *logger.Logger) *HPAsHandler {
	return &HPAsHandler{
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
func (h *HPAsHandler) getClientAndConfig(c *gin.Context) (*kubernetes.Clientset, error) {
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

// GetHPA returns a specific HPA
// @Summary Get a specific HPA
// @Description Retrieves a specific HorizontalPodAutoscaler by name and namespace
// @Tags HPAs
// @Accept json
// @Produce json
// @Produce text/event-stream
// @Param config query string true "Kubernetes config ID"
// @Param cluster query string false "Cluster name"
// @Param namespace path string true "Namespace name"
// @Param name path string true "HPA name"
// @Success 200 {object} map[string]interface{} "HPA details"
// @Failure 400 {object} map[string]string "Bad request"
// @Failure 404 {object} map[string]string "HPA not found"
// @Security BearerAuth
// @Security KubeConfig
// @Router /api/v1/hpas/{namespace}/{name} [get]
func (h *HPAsHandler) GetHPA(c *gin.Context) {
	// Start child span for client setup
	ctx, clientSpan := h.tracingHelper.StartAuthSpan(c.Request.Context(), "get-client-config")
	defer clientSpan.End()

	client, err := h.getClientAndConfig(c)
	if err != nil {
		h.logger.WithError(err).Error("Failed to get client for HPA")
		h.tracingHelper.RecordError(clientSpan, err, "Failed to get Kubernetes client")
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	h.tracingHelper.RecordSuccess(clientSpan, "Client setup completed")

	namespace := c.Param("namespace")
	name := c.Param("name")

	// Start child span for Kubernetes API call
	_, k8sSpan := h.tracingHelper.StartKubernetesAPISpan(ctx, "get", "hpa", namespace)
	defer k8sSpan.End()

	hpa, err := client.AutoscalingV2().HorizontalPodAutoscalers(namespace).Get(ctx, name, metav1.GetOptions{})
	if err != nil {
		h.logger.WithError(err).WithField("hpa", name).WithField("namespace", namespace).Error("Failed to get HPA")
		h.tracingHelper.RecordError(k8sSpan, err, "Failed to get HPA")
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}
	h.tracingHelper.RecordSuccess(k8sSpan, "Successfully retrieved HPA")
	h.tracingHelper.AddResourceAttributes(k8sSpan, name, "hpa", 1)

	// Check if this is an SSE request (EventSource expects SSE format)
	acceptHeader := c.GetHeader("Accept")
	if acceptHeader == "text/event-stream" {
		h.sseHandler.SendSSEResponse(c, hpa)
		return
	}

	c.JSON(http.StatusOK, hpa)
}

// GetHPAByName returns a specific HPA by name using namespace from query parameters
// @Summary Get a specific HPA by name
// @Description Retrieves a specific HorizontalPodAutoscaler by name with namespace from query parameters
// @Tags HPAs
// @Accept json
// @Produce json
// @Produce text/event-stream
// @Param config query string true "Kubernetes config ID"
// @Param cluster query string false "Cluster name"
// @Param namespace query string true "Namespace name"
// @Param name path string true "HPA name"
// @Success 200 {object} map[string]interface{} "HPA details"
// @Failure 400 {object} map[string]string "Bad request"
// @Failure 404 {object} map[string]string "HPA not found"
// @Security BearerAuth
// @Security KubeConfig
// @Router /api/v1/hpas/{name} [get]
func (h *HPAsHandler) GetHPAByName(c *gin.Context) {
	// Start child span for client setup
	ctx, clientSpan := h.tracingHelper.StartAuthSpan(c.Request.Context(), "get-client-config")
	defer clientSpan.End()

	client, err := h.getClientAndConfig(c)
	if err != nil {
		h.logger.WithError(err).Error("Failed to get client for HPA")
		h.tracingHelper.RecordError(clientSpan, err, "Failed to get Kubernetes client")
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	name := c.Param("name")
	namespace := c.Query("namespace")

	if namespace == "" {
		h.logger.WithField("hpa", name).Error("Namespace is required for HPA lookup")
		h.tracingHelper.RecordError(clientSpan, fmt.Errorf("namespace parameter is required"), "Namespace parameter is required")
		c.JSON(http.StatusBadRequest, gin.H{"error": "namespace parameter is required"})
		return
	}
	h.tracingHelper.RecordSuccess(clientSpan, "Client setup completed")

	// Start child span for Kubernetes API call
	_, k8sSpan := h.tracingHelper.StartKubernetesAPISpan(ctx, "get", "hpa", namespace)
	defer k8sSpan.End()

	hpa, err := client.AutoscalingV2().HorizontalPodAutoscalers(namespace).Get(ctx, name, metav1.GetOptions{})
	if err != nil {
		h.logger.WithError(err).WithField("hpa", name).WithField("namespace", namespace).Error("Failed to get HPA")
		h.tracingHelper.RecordError(k8sSpan, err, "Failed to get HPA")
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}
	h.tracingHelper.RecordSuccess(k8sSpan, "Successfully retrieved HPA")
	h.tracingHelper.AddResourceAttributes(k8sSpan, name, "hpa", 1)

	// Check if this is an SSE request (EventSource expects SSE format)
	acceptHeader := c.GetHeader("Accept")
	if acceptHeader == "text/event-stream" {
		h.sseHandler.SendSSEResponse(c, hpa)
		return
	}

	c.JSON(http.StatusOK, hpa)
}

// GetHPAYAMLByName returns the YAML representation of a specific HPA by name using namespace from query parameters
// @Summary Get HPA YAML by name
// @Description Retrieves the YAML representation of a specific HorizontalPodAutoscaler by name with namespace from query parameters
// @Tags HPAs
// @Accept json
// @Produce text/plain
// @Param config query string true "Kubernetes config ID"
// @Param cluster query string false "Cluster name"
// @Param namespace query string true "Namespace name"
// @Param name path string true "HPA name"
// @Success 200 {string} string "HPA YAML"
// @Failure 400 {object} map[string]string "Bad request"
// @Failure 404 {object} map[string]string "HPA not found"
// @Security BearerAuth
// @Security KubeConfig
// @Router /api/v1/hpas/{name}/yaml [get]
func (h *HPAsHandler) GetHPAYAMLByName(c *gin.Context) {
	// Start child span for client setup
	ctx, clientSpan := h.tracingHelper.StartAuthSpan(c.Request.Context(), "get-client-config")
	defer clientSpan.End()

	client, err := h.getClientAndConfig(c)
	if err != nil {
		h.logger.WithError(err).Error("Failed to get client for HPA YAML")
		h.tracingHelper.RecordError(clientSpan, err, "Failed to get Kubernetes client")
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	name := c.Param("name")
	namespace := c.Query("namespace")

	if namespace == "" {
		h.logger.WithField("hpa", name).Error("Namespace is required for HPA YAML lookup")
		h.tracingHelper.RecordError(clientSpan, fmt.Errorf("namespace parameter is required"), "Namespace parameter is required")
		c.JSON(http.StatusBadRequest, gin.H{"error": "namespace parameter is required"})
		return
	}
	h.tracingHelper.RecordSuccess(clientSpan, "Client setup completed")

	// Start child span for Kubernetes API call
	_, k8sSpan := h.tracingHelper.StartKubernetesAPISpan(ctx, "get", "hpa", namespace)
	defer k8sSpan.End()

	hpa, err := client.AutoscalingV2().HorizontalPodAutoscalers(namespace).Get(ctx, name, metav1.GetOptions{})
	if err != nil {
		h.logger.WithError(err).WithField("hpa", name).WithField("namespace", namespace).Error("Failed to get HPA for YAML")
		h.tracingHelper.RecordError(k8sSpan, err, "Failed to get HPA for YAML")
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}
	h.tracingHelper.RecordSuccess(k8sSpan, "Successfully retrieved HPA for YAML")
	h.tracingHelper.AddResourceAttributes(k8sSpan, name, "hpa", 1)

	// Start child span for YAML generation
	_, yamlSpan := h.tracingHelper.StartDataProcessingSpan(ctx, "generate-yaml")
	defer yamlSpan.End()

	h.yamlHandler.SendYAMLResponse(c, hpa, name)
	h.tracingHelper.RecordSuccess(yamlSpan, "Successfully generated YAML response")
}

// GetHPAYAML returns the YAML representation of a specific HPA
// @Summary Get HPA YAML
// @Description Retrieves the YAML representation of a specific HorizontalPodAutoscaler
// @Tags HPAs
// @Accept json
// @Produce text/plain
// @Param config query string true "Kubernetes config ID"
// @Param cluster query string false "Cluster name"
// @Param namespace path string true "Namespace name"
// @Param name path string true "HPA name"
// @Success 200 {string} string "HPA YAML"
// @Failure 400 {object} map[string]string "Bad request"
// @Failure 404 {object} map[string]string "HPA not found"
// @Security BearerAuth
// @Security KubeConfig
// @Router /api/v1/hpas/{namespace}/{name}/yaml [get]
func (h *HPAsHandler) GetHPAYAML(c *gin.Context) {
	// Start child span for client setup
	ctx, clientSpan := h.tracingHelper.StartAuthSpan(c.Request.Context(), "get-client-config")
	defer clientSpan.End()

	client, err := h.getClientAndConfig(c)
	if err != nil {
		h.logger.WithError(err).Error("Failed to get client for HPA YAML")
		h.tracingHelper.RecordError(clientSpan, err, "Failed to get Kubernetes client")
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	h.tracingHelper.RecordSuccess(clientSpan, "Client setup completed")

	namespace := c.Param("namespace")
	name := c.Param("name")

	// Start child span for Kubernetes API call
	_, k8sSpan := h.tracingHelper.StartKubernetesAPISpan(ctx, "get", "hpa", namespace)
	defer k8sSpan.End()

	hpa, err := client.AutoscalingV2().HorizontalPodAutoscalers(namespace).Get(ctx, name, metav1.GetOptions{})
	if err != nil {
		h.logger.WithError(err).WithField("hpa", name).WithField("namespace", namespace).Error("Failed to get HPA for YAML")
		h.tracingHelper.RecordError(k8sSpan, err, "Failed to get HPA for YAML")
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}
	h.tracingHelper.RecordSuccess(k8sSpan, "Successfully retrieved HPA for YAML")
	h.tracingHelper.AddResourceAttributes(k8sSpan, name, "hpa", 1)

	// Start child span for YAML generation
	_, yamlSpan := h.tracingHelper.StartDataProcessingSpan(ctx, "generate-yaml")
	defer yamlSpan.End()

	h.yamlHandler.SendYAMLResponse(c, hpa, name)
	h.tracingHelper.RecordSuccess(yamlSpan, "Successfully generated YAML response")
}

// GetHPAEventsByName returns events for a specific HPA by name using namespace from query parameters
// @Summary Get HPA events by name
// @Description Retrieves events related to a specific HorizontalPodAutoscaler by name with namespace from query parameters
// @Tags HPAs
// @Accept json
// @Produce json
// @Produce text/event-stream
// @Param config query string true "Kubernetes config ID"
// @Param cluster query string false "Cluster name"
// @Param namespace query string true "Namespace name"
// @Param name path string true "HPA name"
// @Success 200 {array} map[string]interface{} "List of events"
// @Failure 400 {object} map[string]string "Bad request"
// @Failure 500 {object} map[string]string "Internal server error"
// @Security BearerAuth
// @Security KubeConfig
// @Router /api/v1/hpas/{name}/events [get]
func (h *HPAsHandler) GetHPAEventsByName(c *gin.Context) {
	name := c.Param("name")
	namespace := c.Query("namespace")

	if namespace == "" {
		h.logger.WithField("hpa", name).Error("Namespace is required for HPA events lookup")
		c.JSON(http.StatusBadRequest, gin.H{"error": "namespace parameter is required"})
		return
	}

	// Start child span for client setup
	ctx, clientSpan := h.tracingHelper.StartAuthSpan(c.Request.Context(), "get-client-config")
	defer clientSpan.End()

	client, err := h.getClientAndConfig(c)
	if err != nil {
		h.logger.WithError(err).Error("Failed to get client for HPA events")
		h.tracingHelper.RecordError(clientSpan, err, "Failed to get Kubernetes client")
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	h.tracingHelper.RecordSuccess(clientSpan, "Client setup completed")

	// Start child span for events retrieval
	_, eventsSpan := h.tracingHelper.StartKubernetesAPISpan(ctx, "list", "events", namespace)
	defer eventsSpan.End()

	h.eventsHandler.GetResourceEventsWithNamespace(c, client, "HorizontalPodAutoscaler", name, namespace, h.sseHandler.SendSSEResponse)
	h.tracingHelper.RecordSuccess(eventsSpan, "Successfully retrieved HPA events")
	h.tracingHelper.AddResourceAttributes(eventsSpan, name, "hpa-events", 1)
}

// GetHPAEvents returns events for a specific HPA
// @Summary Get HPA events
// @Description Retrieves events related to a specific HorizontalPodAutoscaler
// @Tags HPAs
// @Accept json
// @Produce json
// @Produce text/event-stream
// @Param config query string true "Kubernetes config ID"
// @Param cluster query string false "Cluster name"
// @Param namespace path string true "Namespace name"
// @Param name path string true "HPA name"
// @Success 200 {array} map[string]interface{} "List of events"
// @Failure 400 {object} map[string]string "Bad request"
// @Failure 500 {object} map[string]string "Internal server error"
// @Security BearerAuth
// @Security KubeConfig
// @Router /api/v1/hpas/{namespace}/{name}/events [get]
func (h *HPAsHandler) GetHPAEvents(c *gin.Context) {
	name := c.Param("name")
	namespace := c.Param("namespace")

	// Start child span for client setup
	ctx, clientSpan := h.tracingHelper.StartAuthSpan(c.Request.Context(), "get-client-config")
	defer clientSpan.End()

	client, err := h.getClientAndConfig(c)
	if err != nil {
		h.logger.WithError(err).Error("Failed to get client for HPA events")
		h.tracingHelper.RecordError(clientSpan, err, "Failed to get Kubernetes client")
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	h.tracingHelper.RecordSuccess(clientSpan, "Client setup completed")

	// Start child span for events retrieval
	_, eventsSpan := h.tracingHelper.StartKubernetesAPISpan(ctx, "list", "events", namespace)
	defer eventsSpan.End()

	h.eventsHandler.GetResourceEventsWithNamespace(c, client, "HorizontalPodAutoscaler", name, namespace, h.sseHandler.SendSSEResponse)
	h.tracingHelper.RecordSuccess(eventsSpan, "Successfully retrieved HPA events")
	h.tracingHelper.AddResourceAttributes(eventsSpan, name, "hpa-events", 1)
}

// GetHPAs returns all HPAs in a namespace
// @Summary Get all HPAs in a namespace
// @Description Retrieves all HorizontalPodAutoscalers in the specified namespace with transformed response format
// @Tags HPAs
// @Accept json
// @Produce json
// @Param config query string true "Kubernetes config ID"
// @Param cluster query string false "Cluster name"
// @Param namespace query string true "Namespace name"
// @Success 200 {array} types.HPAListResponse "List of transformed HPAs"
// @Failure 400 {object} map[string]string "Bad request"
// @Failure 500 {object} map[string]string "Internal server error"
// @Security BearerAuth
// @Security KubeConfig
// @Router /api/v1/hpas [get]
func (h *HPAsHandler) GetHPAs(c *gin.Context) {
	// Start child span for client setup
	ctx, clientSpan := h.tracingHelper.StartAuthSpan(c.Request.Context(), "get-client-config")
	defer clientSpan.End()

	client, err := h.getClientAndConfig(c)
	if err != nil {
		h.logger.WithError(err).Error("Failed to get client for HPAs")
		h.tracingHelper.RecordError(clientSpan, err, "Failed to get Kubernetes client")
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	h.tracingHelper.RecordSuccess(clientSpan, "Client setup completed")

	namespace := c.Query("namespace")

	// Start child span for Kubernetes API call
	_, k8sSpan := h.tracingHelper.StartKubernetesAPISpan(ctx, "list", "hpas", namespace)
	defer k8sSpan.End()

	hpaList, err := client.AutoscalingV2().HorizontalPodAutoscalers(namespace).List(ctx, metav1.ListOptions{})
	if err != nil {
		h.logger.WithError(err).Error("Failed to list HPAs")
		h.tracingHelper.RecordError(k8sSpan, err, "Failed to list HPAs")
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	h.tracingHelper.RecordSuccess(k8sSpan, "Successfully listed HPAs")
	h.tracingHelper.AddResourceAttributes(k8sSpan, "hpas", "hpa", len(hpaList.Items))

	// Start child span for data processing
	_, processSpan := h.tracingHelper.StartDataProcessingSpan(ctx, "transform-hpas")
	defer processSpan.End()

	// Transform HPAs to the expected format
	var transformedHPAs []types.HPAListResponse
	for _, hpa := range hpaList.Items {
		transformedHPAs = append(transformedHPAs, transformers.TransformHPAToResponse(&hpa))
	}
	h.tracingHelper.RecordSuccess(processSpan, "Successfully transformed HPAs")
	h.tracingHelper.AddResourceAttributes(processSpan, "transformed-hpas", "hpa", len(transformedHPAs))

	c.JSON(http.StatusOK, transformedHPAs)
}

// GetHPAsSSE returns HPAs as Server-Sent Events with real-time updates
// @Summary Get HPAs with real-time updates
// @Description Retrieves HorizontalPodAutoscalers in the specified namespace with Server-Sent Events for real-time updates
// @Tags HPAs
// @Accept json
// @Produce text/event-stream
// @Produce json
// @Param config query string true "Kubernetes config ID"
// @Param cluster query string false "Cluster name"
// @Param namespace query string true "Namespace name"
// @Success 200 {array} types.HPAListResponse "Stream of transformed HPAs or JSON array"
// @Failure 400 {object} map[string]string "Bad request"
// @Failure 500 {object} map[string]string "Internal server error"
// @Security BearerAuth
// @Security KubeConfig
// @Router /api/v1/hpas/sse [get]
func (h *HPAsHandler) GetHPAsSSE(c *gin.Context) {
	// Start child span for client setup with HTTP context
	ctx, clientSpan := h.tracingHelper.StartAuthSpanWithHTTP(c, "setup-client-for-sse")
	defer clientSpan.End()

	client, err := h.getClientAndConfig(c)
	if err != nil {
		h.logger.WithError(err).Error("Failed to get client for HPAs SSE")
		h.tracingHelper.RecordError(clientSpan, err, "Failed to get client for HPAs SSE")
		h.sseHandler.SendSSEError(c, http.StatusBadRequest, err.Error())
		return
	}
	h.tracingHelper.RecordSuccess(clientSpan, "Client setup completed for HPAs SSE")

	namespace := c.Query("namespace")

	// Function to fetch and transform HPAs data
	fetchHPAs := func() (interface{}, error) {
		// Start child span for data fetching
		_, fetchSpan := h.tracingHelper.StartKubernetesAPISpan(ctx, "list", "hpas", namespace)
		defer fetchSpan.End()

		// Use context.Background() with timeout instead of request context to avoid cancellation
		fetchCtx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
		defer cancel()

		hpaList, err := client.AutoscalingV2().HorizontalPodAutoscalers(namespace).List(fetchCtx, metav1.ListOptions{})
		if err != nil {
			h.tracingHelper.RecordError(fetchSpan, err, "Failed to fetch HPAs for SSE")
			return nil, err
		}
		h.tracingHelper.RecordSuccess(fetchSpan, "Successfully fetched HPAs for SSE")
		h.tracingHelper.AddResourceAttributes(fetchSpan, "hpas", "hpa", len(hpaList.Items))

		// Start child span for data transformation
		_, transformSpan := h.tracingHelper.StartDataProcessingSpanWithHTTP(c, "transform-hpas-sse")
		defer transformSpan.End()

		// Transform HPAs to the expected format
		var transformedHPAs []types.HPAListResponse
		for _, hpa := range hpaList.Items {
			transformedHPAs = append(transformedHPAs, transformers.TransformHPAToResponse(&hpa))
		}
		h.tracingHelper.RecordSuccess(transformSpan, "Successfully transformed HPAs for SSE")
		h.tracingHelper.AddResourceAttributes(transformSpan, "transformed-hpas", "hpa", len(transformedHPAs))

		return transformedHPAs, nil
	}

	// Get initial data
	initialData, err := fetchHPAs()
	if err != nil {
		h.logger.WithError(err).Error("Failed to list HPAs for SSE")
		// Check if this is a permission error
		if utils.IsPermissionError(err) {
			h.sseHandler.SendSSEPermissionError(c, err)
		} else {
			h.sseHandler.SendSSEError(c, http.StatusInternalServerError, err.Error())
		}
		return
	}

	// Send SSE response with periodic updates
	h.sseHandler.SendSSEResponseWithUpdates(c, initialData, fetchHPAs)
}
