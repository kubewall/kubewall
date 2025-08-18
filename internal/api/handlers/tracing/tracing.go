package tracing

import (
	"net/http"
	"strconv"
	"time"

	"github.com/Facets-cloud/kube-dash/internal/config"
	"github.com/Facets-cloud/kube-dash/internal/storage"
	"github.com/Facets-cloud/kube-dash/internal/tracing"
	"github.com/Facets-cloud/kube-dash/pkg/logger"
	"github.com/gin-gonic/gin"
)

// TracingHandler handles tracing-related API requests
type TracingHandler struct {
	store       *storage.KubeConfigStore
	traceStore  *tracing.TraceStore
	logger      *logger.Logger
	config      *config.TracingConfig
}

// NewTracingHandler creates a new tracing handler
func NewTracingHandler(store *storage.KubeConfigStore, traceStore *tracing.TraceStore, logger *logger.Logger, config *config.TracingConfig) *TracingHandler {
	return &TracingHandler{
		store:      store,
		traceStore: traceStore,
		logger:     logger,
		config:     config,
	}
}

// GetTraces handles GET /api/traces
func (h *TracingHandler) GetTraces(c *gin.Context) {
	// Parse query parameters
	filter := tracing.TraceFilter{
		Service:   c.Query("service"),
		Operation: c.Query("operation"),
		Status:    c.Query("status"),
		Limit:     100, // default
		Offset:    0,   // default
	}

	// Parse time filters
	if startTimeStr := c.Query("startTime"); startTimeStr != "" {
		if startTime, err := time.Parse(time.RFC3339, startTimeStr); err == nil {
			filter.StartTime = &startTime
		}
	}

	if endTimeStr := c.Query("endTime"); endTimeStr != "" {
		if endTime, err := time.Parse(time.RFC3339, endTimeStr); err == nil {
			filter.EndTime = &endTime
		}
	}

	// Parse duration filters
	if minDurationStr := c.Query("minDuration"); minDurationStr != "" {
		if minDuration, err := time.ParseDuration(minDurationStr); err == nil {
			filter.MinDuration = &minDuration
		}
	}

	if maxDurationStr := c.Query("maxDuration"); maxDurationStr != "" {
		if maxDuration, err := time.ParseDuration(maxDurationStr); err == nil {
			filter.MaxDuration = &maxDuration
		}
	}

	// Parse pagination
	if limitStr := c.Query("limit"); limitStr != "" {
		if limit, err := strconv.Atoi(limitStr); err == nil && limit > 0 {
			filter.Limit = limit
		}
	}

	if offsetStr := c.Query("offset"); offsetStr != "" {
		if offset, err := strconv.Atoi(offsetStr); err == nil && offset >= 0 {
			filter.Offset = offset
		}
	}

	// Query traces
	traces, total, err := h.traceStore.QueryTraces(filter)
	if err != nil {
		h.logger.WithError(err).Error("Failed to query traces")
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to query traces"})
		return
	}

	// Build response
	response := gin.H{
		"traces":  traces,
		"total":   total,
		"hasMore": filter.Offset+len(traces) < total,
	}

	c.JSON(http.StatusOK, response)
}

// GetTrace handles GET /api/traces/:traceId
func (h *TracingHandler) GetTrace(c *gin.Context) {
	traceID := c.Param("traceId")
	if traceID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Trace ID is required"})
		return
	}

	trace, err := h.traceStore.GetTrace(traceID)
	if err != nil {
		h.logger.WithError(err).Error("Failed to get trace")
		c.JSON(http.StatusNotFound, gin.H{"error": "Trace not found"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"trace": trace,
		"spans": trace.Spans,
	})
}

// GetServiceMap handles GET /api/traces/service-map
func (h *TracingHandler) GetServiceMap(c *gin.Context) {
	timeRange := c.DefaultQuery("timeRange", "1h")

	services, connections, err := h.traceStore.GetServiceMap(timeRange)
	if err != nil {
		h.logger.WithError(err).Error("Failed to get service map")
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get service map"})
		return
	}

	// Convert services map to slice
	var serviceList []*tracing.ServiceMapNode
	for _, service := range services {
		serviceList = append(serviceList, service)
	}

	c.JSON(http.StatusOK, gin.H{
		"services":    serviceList,
		"connections": connections,
	})
}

// GetTracingConfig handles GET /api/tracing/config
func (h *TracingHandler) GetTracingConfig(c *gin.Context) {
	c.JSON(http.StatusOK, h.config)
}

// UpdateTracingConfig handles PUT /api/tracing/config
func (h *TracingHandler) UpdateTracingConfig(c *gin.Context) {
	var newConfig config.TracingConfig
	if err := c.ShouldBindJSON(&newConfig); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid configuration"})
		return
	}

	// Validate configuration
	if newConfig.SamplingRate < 0 || newConfig.SamplingRate > 1 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Sampling rate must be between 0 and 1"})
		return
	}

	if newConfig.MaxTraces <= 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Max traces must be greater than 0"})
		return
	}

	if newConfig.RetentionHours <= 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Retention hours must be greater than 0"})
		return
	}

	// Update configuration (in a real implementation, you might want to persist this)
	h.config.SamplingRate = newConfig.SamplingRate
	h.config.MaxTraces = newConfig.MaxTraces
	h.config.RetentionHours = newConfig.RetentionHours
	h.config.ExportEnabled = newConfig.ExportEnabled
	h.config.JaegerEndpoint = newConfig.JaegerEndpoint

	h.logger.Info("Tracing configuration updated")
	c.JSON(http.StatusOK, h.config)
}

// ExportTraces handles GET /api/traces/export
func (h *TracingHandler) ExportTraces(c *gin.Context) {
	data, err := h.traceStore.ExportTraces(c.Request.Context())
	if err != nil {
		h.logger.WithError(err).Error("Failed to export traces")
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to export traces"})
		return
	}

	c.Header("Content-Type", "application/json")
	c.Header("Content-Disposition", "attachment; filename=traces.json")
	c.Data(http.StatusOK, "application/json", data)
}

// GetTracingStats handles GET /api/tracing/stats
func (h *TracingHandler) GetTracingStats(c *gin.Context) {
	// Get basic statistics about stored traces
	filter := tracing.TraceFilter{
		Limit:  10000, // Get all traces for stats
		Offset: 0,
	}

	traces, total, err := h.traceStore.QueryTraces(filter)
	if err != nil {
		h.logger.WithError(err).Error("Failed to get tracing stats")
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get tracing stats"})
		return
	}

	// Calculate statistics
	var totalDuration time.Duration
	errorCount := 0
	serviceCount := make(map[string]bool)

	for _, trace := range traces {
		totalDuration += trace.Duration
		if trace.Status == "error" {
			errorCount++
		}
		for _, service := range trace.Services {
			serviceCount[service] = true
		}
	}

	avgDuration := float64(0)
	if len(traces) > 0 {
		avgDuration = float64(totalDuration.Nanoseconds()) / float64(len(traces)) / 1e6 // Convert to milliseconds
	}

	errorRate := float64(0)
	if total > 0 {
		errorRate = float64(errorCount) / float64(total) * 100
	}

	stats := gin.H{
		"totalTraces":    total,
		"totalServices":  len(serviceCount),
		"avgDuration":    avgDuration,
		"errorRate":      errorRate,
		"tracingEnabled": h.config.Enabled,
		"samplingRate":   h.config.SamplingRate,
	}

	c.JSON(http.StatusOK, stats)
}