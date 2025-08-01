package shared

import (
	"encoding/json"

	"github.com/Facets-cloud/kube-dash/pkg/logger"

	"github.com/gorilla/websocket"
)

// TerminalSession represents a shared terminal session for WebSocket-based terminal operations
type TerminalSession struct {
	conn   *websocket.Conn
	logger *logger.Logger
}

// NewTerminalSession creates a new TerminalSession
func NewTerminalSession(conn *websocket.Conn, logger *logger.Logger) *TerminalSession {
	return &TerminalSession{
		conn:   conn,
		logger: logger,
	}
}

// Read reads from the WebSocket and writes to stdin
func (t *TerminalSession) Read(p []byte) (int, error) {
	_, message, err := t.conn.ReadMessage()
	if err != nil {
		return 0, err
	}

	// Parse the message
	var msg map[string]interface{}
	if err := json.Unmarshal(message, &msg); err != nil {
		return 0, err
	}

	// Extract input data
	if input, ok := msg["input"].(string); ok {
		copy(p, []byte(input))
		return len(input), nil
	}

	return 0, nil
}

// Write writes from stdout/stderr to the WebSocket
func (t *TerminalSession) Write(p []byte) (int, error) {
	// Send stdout data
	msg := map[string]interface{}{
		"type": "stdout",
		"data": string(p),
	}
	jsonData, err := json.Marshal(msg)
	if err != nil {
		return 0, err
	}

	err = t.conn.WriteMessage(websocket.TextMessage, jsonData)
	if err != nil {
		return 0, err
	}

	return len(p), nil
}

// Close closes the WebSocket connection
func (t *TerminalSession) Close() error {
	return t.conn.Close()
}

// SendError sends an error message through the WebSocket
func (t *TerminalSession) SendError(message string) error {
	errorMsg := map[string]interface{}{
		"error": message,
	}
	jsonData, _ := json.Marshal(errorMsg)
	return t.conn.WriteMessage(websocket.TextMessage, jsonData)
}
