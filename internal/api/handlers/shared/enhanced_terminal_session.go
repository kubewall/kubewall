package shared

import (
	"context"
	"encoding/json"
	"fmt"
	"sync"
	"time"

	"github.com/Facets-cloud/kube-dash/pkg/logger"
	"github.com/gorilla/websocket"
)

// EnhancedTerminalSession represents an optimized terminal session for WebSocket-based terminal operations
type EnhancedTerminalSession struct {
	conn           *websocket.Conn
	logger         *logger.Logger
	ctx            context.Context
	cancel         context.CancelFunc
	writeBuffer    chan []byte
	writeMutex     sync.Mutex
	readBuffer     []byte
	readMutex      sync.Mutex
	bufferSize     int
	flushInterval  time.Duration
	lastActivity   time.Time
	activityMutex  sync.RWMutex
	closed         bool
	closeMutex     sync.RWMutex
}

// TerminalMessage represents the structure of terminal WebSocket messages
type TerminalMessage struct {
	Type   string `json:"type"`
	Data   string `json:"data,omitempty"`
	Input  string `json:"input,omitempty"`
	Error  string `json:"error,omitempty"`
	Resize *struct {
		Cols uint16 `json:"cols"`
		Rows uint16 `json:"rows"`
	} `json:"resize,omitempty"`
}

// NewEnhancedTerminalSession creates a new EnhancedTerminalSession with optimizations
func NewEnhancedTerminalSession(conn *websocket.Conn, logger *logger.Logger) *EnhancedTerminalSession {
	ctx, cancel := context.WithCancel(context.Background())
	
	session := &EnhancedTerminalSession{
		conn:          conn,
		logger:        logger,
		ctx:           ctx,
		cancel:        cancel,
		writeBuffer:   make(chan []byte, 1000), // Buffered channel for better performance
		readBuffer:    make([]byte, 0, 4096),   // Pre-allocated read buffer
		bufferSize:    4096,
		flushInterval: 10 * time.Millisecond, // Low latency flush interval
		lastActivity:  time.Now(),
	}

	// Configure WebSocket for better performance
	conn.SetReadLimit(32768) // 32KB read limit
	conn.SetReadDeadline(time.Now().Add(60 * time.Second))
	conn.SetWriteDeadline(time.Now().Add(10 * time.Second))
	
	// Enable compression for better bandwidth usage
	conn.EnableWriteCompression(true)
	
	// Set ping/pong handlers for connection health
	conn.SetPingHandler(func(appData string) error {
		session.updateActivity()
		return conn.WriteControl(websocket.PongMessage, []byte(appData), time.Now().Add(time.Second))
	})
	
	conn.SetPongHandler(func(appData string) error {
		session.updateActivity()
		return nil
	})

	// Start the write buffer processor
	go session.processWriteBuffer()
	
	// Start connection health monitor
	go session.monitorConnection()

	return session
}

// updateActivity updates the last activity timestamp
func (t *EnhancedTerminalSession) updateActivity() {
	t.activityMutex.Lock()
	t.lastActivity = time.Now()
	t.activityMutex.Unlock()
}

// isClosed checks if the session is closed
func (t *EnhancedTerminalSession) isClosed() bool {
	t.closeMutex.RLock()
	defer t.closeMutex.RUnlock()
	return t.closed
}

// setClosed marks the session as closed
func (t *EnhancedTerminalSession) setClosed() {
	t.closeMutex.Lock()
	t.closed = true
	t.closeMutex.Unlock()
}

// processWriteBuffer processes the write buffer for batched writes
func (t *EnhancedTerminalSession) processWriteBuffer() {
	ticker := time.NewTicker(t.flushInterval)
	defer ticker.Stop()
	
	var buffer []byte
	var lastFlush time.Time
	
	for {
		select {
		case <-t.ctx.Done():
			return
		case data := <-t.writeBuffer:
			if t.isClosed() {
				return
			}
			
			buffer = append(buffer, data...)
			
			// Flush immediately if buffer is large or enough time has passed
			if len(buffer) >= t.bufferSize || time.Since(lastFlush) >= t.flushInterval {
				if err := t.flushBuffer(buffer); err != nil {
					t.logger.Error("Failed to flush write buffer", "error", err)
					return
				}
				buffer = buffer[:0] // Reset buffer
				lastFlush = time.Now()
			}
			
		case <-ticker.C:
			if len(buffer) > 0 {
				if err := t.flushBuffer(buffer); err != nil {
					t.logger.Error("Failed to flush write buffer on timer", "error", err)
					return
				}
				buffer = buffer[:0] // Reset buffer
				lastFlush = time.Now()
			}
		}
	}
}

// flushBuffer sends buffered data to the WebSocket
func (t *EnhancedTerminalSession) flushBuffer(data []byte) error {
	if len(data) == 0 {
		return nil
	}
	
	msg := TerminalMessage{
		Type: "stdout",
		Data: string(data),
	}
	
	jsonData, err := json.Marshal(msg)
	if err != nil {
		return fmt.Errorf("failed to marshal message: %w", err)
	}
	
	t.writeMutex.Lock()
	defer t.writeMutex.Unlock()
	
	if t.isClosed() {
		return fmt.Errorf("session is closed")
	}
	
	// Set write deadline for responsiveness
	t.conn.SetWriteDeadline(time.Now().Add(5 * time.Second))
	err = t.conn.WriteMessage(websocket.TextMessage, jsonData)
	if err != nil {
		return fmt.Errorf("failed to write message: %w", err)
	}
	
	t.updateActivity()
	return nil
}

// monitorConnection monitors the WebSocket connection health
func (t *EnhancedTerminalSession) monitorConnection() {
	ticker := time.NewTicker(30 * time.Second)
	defer ticker.Stop()
	
	for {
		select {
		case <-t.ctx.Done():
			return
		case <-ticker.C:
			t.activityMutex.RLock()
			lastActivity := t.lastActivity
			t.activityMutex.RUnlock()
			
			// Send ping if no activity for 30 seconds
			if time.Since(lastActivity) > 30*time.Second {
				t.writeMutex.Lock()
				if !t.isClosed() {
					err := t.conn.WriteControl(websocket.PingMessage, []byte("ping"), time.Now().Add(time.Second))
					if err != nil {
						t.logger.Error("Failed to send ping", "error", err)
						t.writeMutex.Unlock()
						return
					}
				}
				t.writeMutex.Unlock()
			}
		}
	}
}

// Read reads from the WebSocket and writes to stdin
func (t *EnhancedTerminalSession) Read(p []byte) (int, error) {
	if t.isClosed() {
		return 0, fmt.Errorf("session is closed")
	}
	
	// Set read deadline
	t.conn.SetReadDeadline(time.Now().Add(60 * time.Second))
	
	_, message, err := t.conn.ReadMessage()
	if err != nil {
		return 0, fmt.Errorf("failed to read message: %w", err)
	}
	
	t.updateActivity()
	
	// Parse the message
	var msg TerminalMessage
	if err := json.Unmarshal(message, &msg); err != nil {
		return 0, fmt.Errorf("failed to unmarshal message: %w", err)
	}
	
	// Handle different message types
	switch msg.Type {
	case "input":
		if msg.Input != "" {
			inputBytes := []byte(msg.Input)
			n := copy(p, inputBytes)
			return n, nil
		}
	case "resize":
		// Handle resize messages (this would be processed by the caller)
		if msg.Resize != nil {
			// For now, we'll just log it. The caller should handle resize logic.
			t.logger.Debug("Terminal resize requested", "cols", msg.Resize.Cols, "rows", msg.Resize.Rows)
		}
		return 0, nil
	default:
		// Handle legacy format for backward compatibility
		var legacyMsg map[string]interface{}
		if err := json.Unmarshal(message, &legacyMsg); err == nil {
			if input, ok := legacyMsg["input"].(string); ok && input != "" {
				inputBytes := []byte(input)
				n := copy(p, inputBytes)
				return n, nil
			}
		}
	}
	
	return 0, nil
}

// Write writes from stdout/stderr to the WebSocket with buffering
func (t *EnhancedTerminalSession) Write(p []byte) (int, error) {
	if t.isClosed() {
		return 0, fmt.Errorf("session is closed")
	}
	
	if len(p) == 0 {
		return 0, nil
	}
	
	// Make a copy of the data to avoid race conditions
	data := make([]byte, len(p))
	copy(data, p)
	
	// Send to write buffer for batched processing
	select {
	case t.writeBuffer <- data:
		return len(p), nil
	case <-t.ctx.Done():
		return 0, fmt.Errorf("session context cancelled")
	default:
		// Buffer is full, try to send directly (fallback)
		t.logger.Warn("Write buffer full, sending directly")
		return len(p), t.flushBuffer(data)
	}
}

// WriteError writes an error message to the WebSocket
func (t *EnhancedTerminalSession) WriteError(p []byte) (int, error) {
	if t.isClosed() {
		return 0, fmt.Errorf("session is closed")
	}
	
	msg := TerminalMessage{
		Type: "stderr",
		Data: string(p),
	}
	
	jsonData, err := json.Marshal(msg)
	if err != nil {
		return 0, fmt.Errorf("failed to marshal error message: %w", err)
	}
	
	t.writeMutex.Lock()
	defer t.writeMutex.Unlock()
	
	if t.isClosed() {
		return 0, fmt.Errorf("session is closed")
	}
	
	t.conn.SetWriteDeadline(time.Now().Add(5 * time.Second))
	err = t.conn.WriteMessage(websocket.TextMessage, jsonData)
	if err != nil {
		return 0, fmt.Errorf("failed to write error message: %w", err)
	}
	
	t.updateActivity()
	return len(p), nil
}

// Close closes the WebSocket connection and cleans up resources
func (t *EnhancedTerminalSession) Close() error {
	if t.isClosed() {
		return nil
	}
	
	t.setClosed()
	t.cancel() // Cancel context to stop goroutines
	
	// Close write buffer channel
	close(t.writeBuffer)
	
	// Send close message
	t.writeMutex.Lock()
	err := t.conn.WriteMessage(websocket.CloseMessage, websocket.FormatCloseMessage(websocket.CloseNormalClosure, ""))
	t.writeMutex.Unlock()
	
	if err != nil {
		t.logger.Error("Failed to send close message", "error", err)
	}
	
	// Close the connection
	return t.conn.Close()
}

// SendError sends an error message through the WebSocket
func (t *EnhancedTerminalSession) SendError(message string) error {
	if t.isClosed() {
		return fmt.Errorf("session is closed")
	}
	
	errorMsg := TerminalMessage{
		Type:  "error",
		Error: message,
	}
	
	jsonData, err := json.Marshal(errorMsg)
	if err != nil {
		return fmt.Errorf("failed to marshal error message: %w", err)
	}
	
	t.writeMutex.Lock()
	defer t.writeMutex.Unlock()
	
	if t.isClosed() {
		return fmt.Errorf("session is closed")
	}
	
	t.conn.SetWriteDeadline(time.Now().Add(5 * time.Second))
	err = t.conn.WriteMessage(websocket.TextMessage, jsonData)
	if err != nil {
		return fmt.Errorf("failed to send error message: %w", err)
	}
	
	t.updateActivity()
	return nil
}

// SendResize sends a resize notification (for terminal resize events)
func (t *EnhancedTerminalSession) SendResize(cols, rows uint16) error {
	if t.isClosed() {
		return fmt.Errorf("session is closed")
	}
	
	resizeMsg := TerminalMessage{
		Type: "resize",
		Resize: &struct {
			Cols uint16 `json:"cols"`
			Rows uint16 `json:"rows"`
		}{
			Cols: cols,
			Rows: rows,
		},
	}
	
	jsonData, err := json.Marshal(resizeMsg)
	if err != nil {
		return fmt.Errorf("failed to marshal resize message: %w", err)
	}
	
	t.writeMutex.Lock()
	defer t.writeMutex.Unlock()
	
	if t.isClosed() {
		return fmt.Errorf("session is closed")
	}
	
	t.conn.SetWriteDeadline(time.Now().Add(5 * time.Second))
	err = t.conn.WriteMessage(websocket.TextMessage, jsonData)
	if err != nil {
		return fmt.Errorf("failed to send resize message: %w", err)
	}
	
	t.updateActivity()
	return nil
}

// GetStats returns session statistics
func (t *EnhancedTerminalSession) GetStats() map[string]interface{} {
	t.activityMutex.RLock()
	lastActivity := t.lastActivity
	t.activityMutex.RUnlock()
	
	return map[string]interface{}{
		"last_activity": lastActivity,
		"buffer_size":   len(t.writeBuffer),
		"is_closed":     t.isClosed(),
	}
}