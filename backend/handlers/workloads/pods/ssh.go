package pods

import "github.com/gorilla/websocket"

// wsWrapper is a wrapper around the WebSocket connection
type wsWrapper struct {
	conn *websocket.Conn
}

func (w *wsWrapper) Read(p []byte) (int, error) {
	_, message, err := w.conn.ReadMessage()
	if err != nil {
		return 0, err
	}
	n := copy(p, message)
	return n, nil
}

func (w *wsWrapper) Write(p []byte) (int, error) {
	err := w.conn.WriteMessage(websocket.TextMessage, p)
	if err != nil {
		return 0, err
	}
	return len(p), nil
}
