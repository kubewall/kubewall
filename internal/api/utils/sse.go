package utils

import (
	"encoding/json"
	"net/http"
	"strings"
	"sync"
	"time"

	"kubewall-backend/pkg/logger"

	"github.com/gin-gonic/gin"
)

// SSEHandler provides utility functions for Server-Sent Events operations
type SSEHandler struct {
	logger *logger.Logger
	// Connection pool for managing active SSE connections
	connections sync.Map
}

// SSEConnection represents an active SSE connection
type SSEConnection struct {
	ID        string
	CreatedAt time.Time
	LastPing  time.Time
	Context   *gin.Context
}

// NewSSEHandler creates a new SSE handler
func NewSSEHandler(log *logger.Logger) *SSEHandler {
	handler := &SSEHandler{
		logger: log,
	}

	// Start connection cleanup goroutine
	go handler.cleanupConnections()

	return handler
}

// cleanupConnections periodically removes stale connections
func (h *SSEHandler) cleanupConnections() {
	ticker := time.NewTicker(5 * time.Minute)
	defer ticker.Stop()

	for range ticker.C {
		now := time.Now()
		h.connections.Range(func(key, value interface{}) bool {
			if conn, ok := value.(*SSEConnection); ok {
				// Remove connections older than 10 minutes or with no ping in 5 minutes
				if now.Sub(conn.CreatedAt) > 10*time.Minute || now.Sub(conn.LastPing) > 5*time.Minute {
					h.connections.Delete(key)
					h.logger.Info("Cleaned up stale SSE connection", "id", conn.ID)
				}
			}
			return true
		})
	}
}

// SendSSEResponse sends a Server-Sent Events response with real-time updates
func (h *SSEHandler) SendSSEResponse(c *gin.Context, data interface{}) {
	// Set proper headers for SSE with improved performance
	c.Header("Content-Type", "text/event-stream")
	c.Header("Cache-Control", "no-cache, no-store, must-revalidate")
	c.Header("Connection", "keep-alive")
	c.Header("Access-Control-Allow-Origin", "*")
	c.Header("Access-Control-Allow-Headers", "Cache-Control")
	c.Header("X-Accel-Buffering", "no")   // Disable nginx buffering if present
	c.Header("Keep-Alive", "timeout=300") // 5 minute keep-alive

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

	// Send data and close connection immediately for non-updating endpoints
	c.Data(http.StatusOK, "text/event-stream", []byte("data: "+string(jsonData)+"\n\n"))
	c.Writer.Flush()

	// Set up periodic keep-alive (reduced frequency for better performance)
	ticker := time.NewTicker(60 * time.Second) // Increased to 60 seconds
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
	// Set proper headers for SSE with improved performance
	c.Header("Content-Type", "text/event-stream")
	c.Header("Cache-Control", "no-cache, no-store, must-revalidate")
	c.Header("Connection", "keep-alive")
	c.Header("Access-Control-Allow-Origin", "*")
	c.Header("Access-Control-Allow-Headers", "Cache-Control")
	c.Header("X-Accel-Buffering", "no")   // Disable nginx buffering if present
	c.Header("Keep-Alive", "timeout=300") // 5 minute keep-alive

	// Create connection ID for tracking
	connID := c.ClientIP() + ":" + c.Request.URL.Path
	conn := &SSEConnection{
		ID:        connID,
		CreatedAt: time.Now(),
		LastPing:  time.Now(),
		Context:   c,
	}
	h.connections.Store(connID, conn)

	// Ensure we always send a valid array, never null
	if data == nil {
		data = []interface{}{}
	}

	// Send initial data
	jsonData, err := json.Marshal(data)
	if err != nil {
		h.logger.WithError(err).Error("Failed to marshal SSE data")
		h.connections.Delete(connID)
		return
	}

	// Send data directly without event wrapper
	c.Data(http.StatusOK, "text/event-stream", []byte("data: "+string(jsonData)+"\n\n"))
	c.Writer.Flush()

	// Determine update frequency based on endpoint type
	updateInterval := 60 * time.Second // Default 60 seconds
	if c.Request.URL.Path == "/api/v1/helmreleases" {
		updateInterval = 120 * time.Second // 2 minutes for Helm releases list
	} else if strings.HasPrefix(c.Request.URL.Path, "/api/v1/helmreleases/") && !strings.Contains(c.Request.URL.Path, "/history") {
		updateInterval = 180 * time.Second // 3 minutes for Helm release details
	}

	// Set up periodic updates with optimized frequency
	ticker := time.NewTicker(updateInterval)
	defer ticker.Stop()

	// Keep connection alive with periodic updates
	for {
		select {
		case <-c.Request.Context().Done():
			h.logger.Info("SSE connection closed by client")
			h.connections.Delete(connID)
			return
		case <-ticker.C:
			// Update last ping time
			if connValue, exists := h.connections.Load(connID); exists {
				if conn, ok := connValue.(*SSEConnection); ok {
					conn.LastPing = time.Now()
				}
			}

			// Fetch fresh data and send update with optimized timeout
			if updateFunc != nil {
				// Create a channel for the update result
				resultChan := make(chan struct {
					data interface{}
					err  error
				}, 1)

				// Run the update function in a goroutine with optimized timeout
				go func() {
					freshData, err := updateFunc()
					resultChan <- struct {
						data interface{}
						err  error
					}{freshData, err}
				}()

				// Wait for result with optimized timeout based on endpoint
				timeout := 45 * time.Second // Default timeout
				if c.Request.URL.Path == "/api/v1/helmreleases" {
					timeout = 60 * time.Second // 60 seconds for Helm releases list
				} else if strings.HasPrefix(c.Request.URL.Path, "/api/v1/helmreleases/") && !strings.Contains(c.Request.URL.Path, "/history") {
					timeout = 90 * time.Second // 90 seconds for Helm release details
				}

				select {
				case result := <-resultChan:
					if result.err != nil {
						h.logger.WithError(result.err).Error("Failed to fetch fresh data for SSE update")
						// Send keep-alive instead of failing
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
						// Send keep-alive instead of failing
						c.Data(http.StatusOK, "text/event-stream", []byte(": keep-alive\n\n"))
						c.Writer.Flush()
						continue
					}

					// Send data directly without event wrapper
					c.Data(http.StatusOK, "text/event-stream", []byte("data: "+string(jsonData)+"\n\n"))
					c.Writer.Flush()

				case <-time.After(timeout):
					h.logger.Warn("Update function timed out, sending keep-alive", "timeout", timeout)
					// Send keep-alive instead of failing
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
