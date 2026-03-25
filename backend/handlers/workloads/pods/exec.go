package pods

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"strings"
	"time"

	"github.com/gorilla/websocket"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/client-go/kubernetes"
	"k8s.io/client-go/rest"
	"k8s.io/client-go/tools/remotecommand"

	"github.com/kubewall/kubewall/backend/container"
	"github.com/labstack/echo/v4"
)

// terminalSizeQueue implements remotecommand.TerminalSizeQueue
type terminalSizeQueue struct {
	sizes chan remotecommand.TerminalSize
	done  chan struct{}
}

func newTerminalSizeQueue() *terminalSizeQueue {
	return &terminalSizeQueue{
		sizes: make(chan remotecommand.TerminalSize, 4),
		done:  make(chan struct{}),
	}
}

func (q *terminalSizeQueue) Next() *remotecommand.TerminalSize {
	select {
	case size := <-q.sizes:
		return &size
	case <-q.done:
		return nil
	}
}

func (q *terminalSizeQueue) Stop() {
	close(q.done)
}

// Resize sends a terminal resize event
func (q *terminalSizeQueue) Resize(width, height uint16) {
	select {
	case q.sizes <- remotecommand.TerminalSize{Width: uint16(width), Height: uint16(height)}:
	case <-time.After(100 * time.Millisecond):
		// Drop resize event if queue is full
	}
}

// NewExecHandler creates a WebSocket handler for pod exec
func NewExecHandler(appContainer container.Container) echo.HandlerFunc {
	return func(c echo.Context) error {
		config := c.QueryParam("config")
		cluster := c.QueryParam("cluster")
		namespace := c.QueryParam("namespace")
		podName := c.Param("name")
		containerName := c.QueryParam("container")

		commands := c.QueryParams()["command"]
		if len(commands) == 0 {
			// Use bash with interactive mode for better tab completion
			commands = []string{"/bin/bash", "-i", "-l"}
		}

		restConfig := appContainer.RestConfig(config, cluster)
		clientset := appContainer.ClientSet(config, cluster)

		if restConfig == nil || clientset == nil {
			return c.JSON(http.StatusBadRequest, map[string]string{
				"error": fmt.Sprintf("invalid config or cluster: %s/%s", config, cluster),
			})
		}

		if containerName == "" {
			pod, err := clientset.CoreV1().Pods(namespace).Get(context.Background(), podName, metav1.GetOptions{})
			if err != nil {
				return c.JSON(http.StatusNotFound, map[string]string{
					"error": fmt.Sprintf("failed to get pod: %v", err),
				})
			}
			if len(pod.Spec.Containers) > 0 {
				containerName = pod.Spec.Containers[0].Name
			} else {
				return c.JSON(http.StatusBadRequest, map[string]string{
					"error": "pod has no containers",
				})
			}
		}

		upgrader := appContainer.SocketUpgrader()
		conn, err := upgrader.Upgrade(c.Response(), c.Request(), nil)
		if err != nil {
			ExecError("failed to upgrade to WebSocket: %v", err)
			return c.JSON(http.StatusInternalServerError, map[string]string{
				"error": fmt.Sprintf("failed to upgrade to WebSocket: %v", err),
			})
		}

		ExecInfo("exec session started: namespace=%s pod=%s container=%s command=%v", namespace, podName, containerName, commands)

		go handleExecConnection(conn, restConfig, clientset, namespace, podName, containerName, commands)
		return nil
	}
}

func handleExecConnection(
	conn *websocket.Conn,
	restConfig *rest.Config,
	clientset *kubernetes.Clientset,
	namespace, podName, containerName string,
	command []string,
) {
	defer conn.Close()

	ExecDebug("handleExecConnection: namespace=%s pod=%s container=%s command=%v", namespace, podName, containerName, command)

	// Create terminal size queue
	sizeQueue := newTerminalSizeQueue()
	defer sizeQueue.Stop()

	streamer := NewWebSocketStreamer(conn, sizeQueue)
	defer streamer.Close()

	// Build exec URL
	execURL := clientset.CoreV1().RESTClient().Post().
		Resource("pods").
		Namespace(namespace).
		Name(podName).
		SubResource("exec").
		URL()

	params := url.Values{}
	params.Add("container", containerName)
	params.Add("stdin", "true")
	params.Add("stdout", "true")
	params.Add("stderr", "true")
	params.Add("tty", "true")
	for _, cmd := range command {
		params.Add("command", cmd)
	}
	execURL.RawQuery = params.Encode()

	ExecDebug("exec URL: %s", execURL.String())

	// Create executor directly from rest config
	executor, err := remotecommand.NewSPDYExecutor(restConfig, "POST", execURL)
	if err != nil {
		ExecError("failed to create executor: %v", err)
		sendError(conn, fmt.Sprintf("failed to create executor: %v", err))
		return
	}

	// Send initial terminal size
	sizeQueue.Resize(80, 24)

	ExecInfo("executor created, starting SPDY connection")

	// Start reader goroutine
	readerDone := make(chan struct{})
	go func() {
		defer close(readerDone)
		ExecDebug("WebSocket reader goroutine started")
		err := streamer.ReadFromWebSocket()
		ExecDebug("WebSocket reader goroutine ended: %v", err)
		if err != nil && !strings.Contains(err.Error(), "closed") {
			ExecWarn("WebSocket reader error: %v", err)
			conn.Close()
		}
	}()

	// Execute
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	ExecDebug("starting StreamWithContext")
	err = executor.StreamWithContext(ctx, remotecommand.StreamOptions{
		Stdin:             streamer.Stdin(),
		Stdout:            streamer.Stdout(),
		Stderr:            streamer.Stderr(),
		Tty:               true,
		TerminalSizeQueue: sizeQueue,
	})
	ExecDebug("StreamWithContext ended: %v", err)

	<-readerDone

	if err != nil && !isClosedConnectionError(err) {
		ExecError("exec error: %v", err)
		sendError(conn, fmt.Sprintf("exec error: %v", err))
	}

	ExecInfo("exec session ended")
}

func isClosedConnectionError(err error) bool {
	if err == nil {
		return true
	}
	errStr := err.Error()
	return strings.Contains(errStr, "use of closed network") ||
		strings.Contains(errStr, "connection reset by peer") ||
		strings.Contains(errStr, "broken pipe") ||
		strings.Contains(errStr, "EOF")
}

func sendError(conn *websocket.Conn, message string) {
	errorMsg := map[string]string{
		"error": message,
		"exit":  "1",
	}
	data, _ := json.Marshal(errorMsg)
	conn.WriteMessage(websocket.TextMessage, data)
}
