package utils

import (
	"encoding/base64"
	"net/http"

	"kubewall-backend/pkg/logger"

	"github.com/gin-gonic/gin"
	"gopkg.in/yaml.v3"
)

// YAMLHandler provides utility functions for YAML operations
type YAMLHandler struct {
	logger *logger.Logger
}

// NewYAMLHandler creates a new YAML handler
func NewYAMLHandler(log *logger.Logger) *YAMLHandler {
	return &YAMLHandler{
		logger: log,
	}
}

// SendYAMLResponse sends a YAML response in the appropriate format based on the Accept header
func (h *YAMLHandler) SendYAMLResponse(c *gin.Context, resource interface{}, resourceName string) {
	// Convert to YAML
	yamlData, err := yaml.Marshal(resource)
	if err != nil {
		h.logger.WithError(err).Error("Failed to marshal resource to YAML")
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to convert to YAML"})
		return
	}

	// Check if this is an SSE request (EventSource expects SSE format)
	acceptHeader := c.GetHeader("Accept")
	if acceptHeader == "text/event-stream" {
		// For EventSource, send proper SSE format
		c.Header("Content-Type", "text/event-stream")
		c.Header("Cache-Control", "no-cache")
		c.Header("Connection", "keep-alive")
		c.Header("Access-Control-Allow-Origin", "*")
		c.Header("Access-Control-Allow-Headers", "Cache-Control")

		// Send the YAML data as base64 encoded string in SSE format
		encodedYAML := base64.StdEncoding.EncodeToString(yamlData)
		c.SSEvent("message", gin.H{"data": encodedYAML})
		c.Writer.Flush()
		return
	}

	// Return as base64 encoded string to match frontend expectations
	encodedYAML := base64.StdEncoding.EncodeToString(yamlData)
	c.JSON(http.StatusOK, gin.H{"data": encodedYAML})
}

// SendYAMLResponseWithSSE sends a YAML response with SSE support
func (h *YAMLHandler) SendYAMLResponseWithSSE(c *gin.Context, resource interface{}, sseHandler func(*gin.Context, interface{})) {
	// Convert to YAML
	yamlData, err := yaml.Marshal(resource)
	if err != nil {
		h.logger.WithError(err).Error("Failed to marshal resource to YAML")
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to convert to YAML"})
		return
	}

	// Check if this is an SSE request
	acceptHeader := c.GetHeader("Accept")
	if acceptHeader == "text/event-stream" {
		// For EventSource, send the YAML data as base64 encoded string
		encodedYAML := base64.StdEncoding.EncodeToString(yamlData)
		sseHandler(c, gin.H{"data": encodedYAML})
		return
	}

	// Return as base64 encoded string to match frontend expectations
	encodedYAML := base64.StdEncoding.EncodeToString(yamlData)
	c.JSON(http.StatusOK, gin.H{"data": encodedYAML})
}
