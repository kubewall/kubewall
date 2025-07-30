package utils

import (
	"encoding/json"
	"net/http"
	"time"

	"kubewall-backend/pkg/logger"

	"github.com/gin-gonic/gin"
)

// SSEHandler provides utility functions for Server-Sent Events operations
type SSEHandler struct {
	logger *logger.Logger
}

// NewSSEHandler creates a new SSE handler
func NewSSEHandler(log *logger.Logger) *SSEHandler {
	return &SSEHandler{
		logger: log,
	}
}

// SendSSEResponse sends a Server-Sent Events response with real-time updates
func (h *SSEHandler) SendSSEResponse(c *gin.Context, data interface{}) {
	c.Header("Content-Type", "text/event-stream")
	c.Header("Cache-Control", "no-cache")
	c.Header("Connection", "keep-alive")
	c.Header("Access-Control-Allow-Origin", "*")
	c.Header("Access-Control-Allow-Headers", "Cache-Control")

	// Ensure we always send a valid array, never null
	if data == nil {
		data = []interface{}{}
	}

	// Send data directly without event wrapper
	jsonData, err := json.Marshal(data)
	if err != nil {
		h.logger.WithError(err).Error("Failed to marshal SSE data")
		return
	}

	// Send data and close connection immediately
	c.Data(http.StatusOK, "text/event-stream", []byte("data: "+string(jsonData)+"\n\n"))
	c.Writer.Flush()

	// Set up periodic updates (every 10 seconds for real-time updates)
	ticker := time.NewTicker(10 * time.Second)
	defer ticker.Stop()

	// Keep connection alive with periodic updates
	for {
		select {
		case <-c.Request.Context().Done():
			h.logger.Info("SSE connection closed by client")
			return
		case <-ticker.C:
			// Send a keep-alive comment to prevent connection timeout
			c.Data(http.StatusOK, "text/event-stream", []byte(": keep-alive\n\n"))
			c.Writer.Flush()
		}
	}
}

// SendSSEResponseWithUpdates sends a Server-Sent Events response with periodic data updates
func (h *SSEHandler) SendSSEResponseWithUpdates(c *gin.Context, data interface{}, updateFunc func() (interface{}, error)) {
	// Set proper headers for SSE
	c.Header("Content-Type", "text/event-stream")
	c.Header("Cache-Control", "no-cache, no-store, must-revalidate")
	c.Header("Connection", "keep-alive")
	c.Header("Access-Control-Allow-Origin", "*")
	c.Header("Access-Control-Allow-Headers", "Cache-Control")
	c.Header("X-Accel-Buffering", "no") // Disable nginx buffering if present

	// Ensure we always send a valid array, never null
	if data == nil {
		data = []interface{}{}
	}

	// Send initial data
	jsonData, err := json.Marshal(data)
	if err != nil {
		h.logger.WithError(err).Error("Failed to marshal SSE data")
		return
	}

	// Send data directly without event wrapper
	c.Data(http.StatusOK, "text/event-stream", []byte("data: "+string(jsonData)+"\n\n"))
	c.Writer.Flush()

	// Set up periodic updates (every 10 seconds for real-time updates)
	ticker := time.NewTicker(10 * time.Second)
	defer ticker.Stop()

	// Keep connection alive with periodic updates
	for {
		select {
		case <-c.Request.Context().Done():
			h.logger.Info("SSE connection closed by client")
			return
		case <-ticker.C:
			// Fetch fresh data and send update with timeout
			if updateFunc != nil {
				// Create a channel for the update result
				resultChan := make(chan struct {
					data interface{}
					err  error
				}, 1)

				// Run the update function in a goroutine with timeout
				go func() {
					freshData, err := updateFunc()
					resultChan <- struct {
						data interface{}
						err  error
					}{freshData, err}
				}()

				// Wait for result with timeout
				select {
				case result := <-resultChan:
					if result.err != nil {
						h.logger.WithError(result.err).Error("Failed to fetch fresh data for SSE update")
						// Send keep-alive
						c.Data(http.StatusOK, "text/event-stream", []byte(": keep-alive\n\n"))
						c.Writer.Flush()
						continue
					}

					// Ensure we always send a valid array, never null
					if result.data == nil {
						result.data = []interface{}{}
					}

					jsonData, err := json.Marshal(result.data)
					if err != nil {
						h.logger.WithError(err).Error("Failed to marshal fresh SSE data")
						// Send keep-alive
						c.Data(http.StatusOK, "text/event-stream", []byte(": keep-alive\n\n"))
						c.Writer.Flush()
						continue
					}

					// Send data directly without event wrapper
					c.Data(http.StatusOK, "text/event-stream", []byte("data: "+string(jsonData)+"\n\n"))
					c.Writer.Flush()

				case <-time.After(30 * time.Second): // 30 second timeout for update function (increased for Helm operations)
					h.logger.Warn("Update function timed out, sending keep-alive")
					// Send keep-alive
					c.Data(http.StatusOK, "text/event-stream", []byte(": keep-alive\n\n"))
					c.Writer.Flush()
				}
			} else {
				// Send a keep-alive
				c.Data(http.StatusOK, "text/event-stream", []byte(": keep-alive\n\n"))
				c.Writer.Flush()
			}
		}
	}
}

// SendSSEError sends a Server-Sent Events error response
func (h *SSEHandler) SendSSEError(c *gin.Context, statusCode int, message string) {
	c.Header("Content-Type", "text/event-stream")
	c.Header("Cache-Control", "no-cache")
	c.Header("Connection", "keep-alive")
	c.Header("Access-Control-Allow-Origin", "*")
	c.Header("Access-Control-Allow-Headers", "Cache-Control")

	errorData := gin.H{"error": message}
	jsonData, err := json.Marshal(errorData)
	if err != nil {
		h.logger.WithError(err).Error("Failed to marshal SSE error data")
		return
	}

	c.SSEvent("error", string(jsonData))
	c.Writer.Flush()
}
