package pods

import (
	"encoding/binary"
	"encoding/json"
	"io"
	"sync"

	"github.com/gorilla/websocket"
)

// bufferedWriter implements io.Writer that forwards to WebSocket
type bufferedWriter struct {
	conn       *websocket.Conn
	streamType byte // 1 = stdout, 2 = stderr
	mu         sync.Mutex
}

func (w *bufferedWriter) Write(p []byte) (int, error) {
	w.mu.Lock()
	defer w.mu.Unlock()

	// Create a buffer with stream type prefix followed by the data
	buf := make([]byte, len(p)+1)
	buf[0] = w.streamType
	copy(buf[1:], p)

	err := w.conn.WriteMessage(websocket.BinaryMessage, buf)
	if err != nil {
		ExecError("WebSocket write error (stream %d): %v", w.streamType, err)
		return 0, err
	}

	ExecDebug("WebSocket wrote %d bytes (stream %d)", len(p), w.streamType)
	return len(p), nil
}

// resizeMessage represents a terminal resize message from the frontend
type resizeMessage struct {
	Width  uint16 `json:"cols"`
	Height uint16 `json:"rows"`
}

// queueReader implements io.Reader that reads from a channel
type queueReader struct {
	data    chan []byte
	mu      sync.Mutex
	closed  bool
	current []byte
}

func newQueueReader() *queueReader {
	return &queueReader{
		data: make(chan []byte, 100),
	}
}

func (r *queueReader) Read(p []byte) (int, error) {
	// If we have current data, read from it first
	r.mu.Lock()
	if len(r.current) > 0 {
		n := copy(p, r.current)
		r.current = r.current[n:]
		if len(r.current) == 0 {
			r.current = nil
		}
		r.mu.Unlock()
		ExecDebug("stdin: read %d bytes from buffer", n)
		return n, nil
	}

	// Check if closed
	if r.closed {
		r.mu.Unlock()
		ExecDebug("stdin: closed, returning EOF")
		return 0, io.EOF
	}
	r.mu.Unlock()

	// Wait for more data
	ExecDebug("stdin: waiting for data...")
	select {
	case data, ok := <-r.data:
		if !ok || len(data) == 0 {
			ExecDebug("stdin: channel closed")
			return 0, io.EOF
		}
		r.mu.Lock()
		n := copy(p, data)
		if n < len(data) {
			r.current = data[n:]
		}
		r.mu.Unlock()
		ExecDebug("stdin: read %d bytes from channel", n)
		return n, nil
	}
}

func (r *queueReader) Write(data []byte) (int, error) {
	r.mu.Lock()
	if r.closed {
		r.mu.Unlock()
		ExecWarn("stdin: write on closed reader")
		return 0, io.ErrClosedPipe
	}
	r.mu.Unlock()

	select {
	case r.data <- data:
		ExecDebug("stdin: queued %d bytes", len(data))
		return len(data), nil
	default:
		ExecWarn("stdin: queue full, dropping %d bytes", len(data))
		return len(data), nil
	}
}

func (r *queueReader) Close() error {
	r.mu.Lock()
	defer r.mu.Unlock()
	if !r.closed {
		r.closed = true
		close(r.data)
		ExecDebug("stdin: reader closed")
	}
	return nil
}

// WebSocketStreamer bridges WebSocket and SPDY for pod exec
type WebSocketStreamer struct {
	conn         *websocket.Conn
	stdinReader  *queueReader
	stdoutWriter *bufferedWriter
	stderrWriter *bufferedWriter
	sizeQueue    *terminalSizeQueue
	closed       bool
	mu           sync.Mutex
}

// NewWebSocketStreamer creates a new WebSocket streamer
func NewWebSocketStreamer(conn *websocket.Conn, sizeQueue *terminalSizeQueue) *WebSocketStreamer {
	ws := &WebSocketStreamer{
		conn:        conn,
		stdinReader: newQueueReader(),
		sizeQueue:   sizeQueue,
		stdoutWriter: &bufferedWriter{
			conn:       conn,
			streamType: 1, // stdout
		},
		stderrWriter: &bufferedWriter{
			conn:       conn,
			streamType: 2, // stderr
		},
	}

	return ws
}

// Stdin returns an io.Reader that reads from the stdin queue
func (w *WebSocketStreamer) Stdin() io.Reader {
	return w.stdinReader
}

// Stdout returns an io.Writer that writes to stdout
func (w *WebSocketStreamer) Stdout() io.Writer {
	return w.stdoutWriter
}

// Stderr returns an io.Writer that writes to stderr
func (w *WebSocketStreamer) Stderr() io.Writer {
	return w.stderrWriter
}

// ReadFromWebSocket reads data from WebSocket and writes to stdin queue
func (w *WebSocketStreamer) ReadFromWebSocket() error {
	for {
		messageType, data, err := w.conn.ReadMessage()
		if err != nil {
			w.mu.Lock()
			w.closed = true
			w.mu.Unlock()
			w.stdinReader.Close()
			ExecDebug("WebSocket read error: %v", err)
			return err
		}

		ExecDebug("WebSocket received %d bytes (type %d)", len(data), messageType)

		// Check for JSON resize message
		if messageType == websocket.TextMessage {
			var resize resizeMessage
			if err := json.Unmarshal(data, &resize); err == nil {
				if resize.Width > 0 && resize.Height > 0 {
					ExecDebug("Terminal resize: %dx%d", resize.Width, resize.Height)
					w.sizeQueue.Resize(resize.Width, resize.Height)
				}
				continue
			}
		}

		// Handle binary input data with optional resize prefix
		if len(data) > 0 {
			// Check if this is a resize message in binary format (4 bytes: cols + rows)
			if len(data) == 4 && messageType == websocket.BinaryMessage {
				cols := binary.BigEndian.Uint16(data[0:2])
				rows := binary.BigEndian.Uint16(data[2:4])
				if cols > 0 && rows > 0 && cols < 256 && rows < 256 {
					ExecDebug("Terminal resize (binary): %dx%d", cols, rows)
					w.sizeQueue.Resize(cols, rows)
					continue
				}
			}

			// Regular stdin data - write to stdin queue
			w.stdinReader.Write(data)
		}
	}
}

// Close closes the stdin reader
func (w *WebSocketStreamer) Close() {
	w.mu.Lock()
	defer w.mu.Unlock()
	if !w.closed {
		w.closed = true
		w.stdinReader.Close()
	}
}
