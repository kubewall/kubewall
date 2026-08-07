package pods

import (
	"bufio"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"sort"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/charmbracelet/log"
	"github.com/labstack/echo/v4"
	"github.com/r3labs/sse/v2"
	v1 "k8s.io/api/core/v1"
)

const (
	// maxLogLineSize is how much of a single line is buffered before it is
	// emitted as a chunk. It bounds memory per line; it is NOT a limit on what
	// gets delivered -- a longer line is split across consecutive messages
	// rather than being dropped.
	maxLogLineSize = 1024 * 1024

	// logReadBufferSize is the read window handed to bufio. ReadSlice returns
	// ErrBufferFull at this granularity, which is how oversized lines are
	// chunked instead of aborting the stream.
	logReadBufferSize = 64 * 1024

	// logTailLines is how much backlog a new follow request replays. The
	// per-request SSE server sizes its retained event log from this.
	logTailLines = 100

	// logKeepAliveInterval is how often an idle log stream emits a comment so
	// proxies do not reap the connection and the client can tell it is alive.
	logKeepAliveInterval = 15 * time.Second
)

type LogMessage struct {
	ContainerName string `json:"containerName"`
	Timestamp     string `json:"timestamp"`
	Log           string `json:"log"`
}

// newLogMessage converts one raw log line into a LogMessage.
func newLogMessage(raw string, containerName string, lastTS *time.Time) LogMessage {
	if timestamp, message, ok := strings.Cut(raw, " "); ok {
		if parsed, err := time.Parse(time.RFC3339Nano, timestamp); err == nil {
			*lastTS = parsed
			return LogMessage{
				ContainerName: containerName,
				Timestamp:     parsed.Format(timestampLayout),
				Log:           message,
			}
		}
	}

	fallback := *lastTS
	if fallback.IsZero() {
		fallback = time.Now().UTC()
	}
	return LogMessage{
		ContainerName: containerName,
		Timestamp:     fallback.Format(timestampLayout),
		Log:           raw,
	}
}

// readLogLines reads r to completion, handing every line to emit.
//
// It deliberately does not use bufio.Scanner: Scanner fails the whole stream
// with ErrTooLong the first time a line exceeds its buffer, so a single
// oversized line silently truncates every log that follows it. Here a long line
// is emitted in order as consecutive chunks instead, so nothing is lost while
// memory per line stays bounded.
//
// emit returns false to stop early (context cancelled).
func readLogLines(r io.Reader, emit func(line string) bool) error {
	reader := bufio.NewReaderSize(r, logReadBufferSize)
	var pending []byte

	for {
		chunk, err := reader.ReadSlice('\n')
		// chunk aliases the reader's buffer, so it must be copied out.
		pending = append(pending, chunk...)

		if errors.Is(err, bufio.ErrBufferFull) {
			// Line is still incomplete. Flush once it grows past the cap so a
			// pathological line cannot pin unbounded memory.
			if len(pending) >= maxLogLineSize {
				if !emit(string(pending)) {
					return nil
				}
				pending = pending[:0]
			}
			continue
		}

		if len(pending) > 0 {
			if !emit(strings.TrimRight(string(pending), "\r\n")) {
				return nil
			}
			pending = pending[:0]
		}

		if err != nil {
			if errors.Is(err, io.EOF) {
				return nil
			}
			return err
		}
	}
}

// fetchLogs follows one container's logs into logsChannel. The returned error is
// surfaced to the client by the caller: a silent failure would leave the browser
// holding an open stream with no logs and no explanation.
func (h *PodsHandler) fetchLogs(ctx context.Context, namespace, podName, containerName string, logsChannel chan<- LogMessage) error {
	i := int64(logTailLines)
	podLogOptions := &v1.PodLogOptions{
		Container:  containerName,
		Timestamps: true,
		Follow:     true,
		TailLines:  &i,
	}
	req := h.clientSet.CoreV1().Pods(namespace).GetLogs(podName, podLogOptions)
	podLogs, err := req.Stream(ctx)
	if err != nil {
		log.Error("failed to open log stream", "pod", podName, "container", containerName, "err", err)
		return err
	}

	go func() {
		<-ctx.Done()
		podLogs.Close()
	}()
	defer podLogs.Close()

	var lastTS time.Time
	err = readLogLines(podLogs, func(line string) bool {
		select {
		case <-ctx.Done():
			return false
		default:
		}
		select {
		case logsChannel <- newLogMessage(line, containerName, &lastTS):
			return true
		case <-ctx.Done():
			return false
		}
	})

	if err != nil && !isBenignStreamClose(ctx, err) {
		log.Error("log read error", "pod", podName, "container", containerName, "err", err)
		return err
	}
	return nil
}

func isBenignStreamClose(ctx context.Context, err error) bool {
	if ctx.Err() != nil || errors.Is(err, context.Canceled) || errors.Is(err, io.ErrClosedPipe) {
		return true
	}
	msg := err.Error()
	return strings.Contains(msg, "http2: response body closed") ||
		strings.Contains(msg, "use of closed network connection") ||
		strings.Contains(msg, "context canceled")
}

// noticeMessage renders an out-of-band notice as an ordinary log line so it is
// visible in the UI. Without this, every failure below looks identical to "this
// pod has not logged anything": an open stream that never produces data.
func noticeMessage(containerName, text string) LogMessage {
	return LogMessage{
		ContainerName: containerName,
		Timestamp:     time.Now().UTC().Format(timestampLayout),
		Log:           text,
	}
}

func (h *PodsHandler) publishLogsToSSE(ctx context.Context, name, namespace, container, allContainers, streamKey string, sseServer *sse.Server) (error, bool) {
	publish := func(msg LogMessage) {
		j, err := json.Marshal(msg)
		if err != nil {
			log.Error("failed to marshal log message", "err", err)
			return
		}
		sseServer.Publish(streamKey, &sse.Event{Data: j})
	}

	containerNames, err := h.getContainerNames(namespace, name, container, allContainers)
	if err != nil {
		publish(noticeMessage(container, fmt.Sprintf("unable to resolve containers for %s/%s: %v", namespace, name, err)))
		return err, true
	}

	logsChannel := make(chan LogMessage, 100)

	var wg sync.WaitGroup
	for _, containerName := range containerNames {
		wg.Add(1)
		go func(containerName string) {
			defer wg.Done()
			if err := h.fetchLogs(ctx, namespace, name, containerName, logsChannel); err != nil {
				select {
				case logsChannel <- noticeMessage(containerName, fmt.Sprintf("log stream for container %q ended with an error: %v", containerName, err)):
				case <-ctx.Done():
				}
			}
		}(containerName)
	}
	go func() {
		wg.Wait()
		close(logsChannel)
	}()

	for logMsg := range logsChannel {
		publish(logMsg)
	}

	if ctx.Err() == nil {
		publish(noticeMessage(container, "log stream ended"))
	}

	return nil, false
}

const timestampLayout = "2006-01-02 15:04:05.000Z"

type HistoryResponse struct {
	Logs    []LogMessage `json:"logs"`
	HasMore bool         `json:"hasMore"`
}

func (h *PodsHandler) getContainerNames(namespace, name, container, allContainers string) ([]string, error) {
	if !strings.EqualFold(allContainers, "true") {
		return []string{container}, nil
	}
	podObj, _, err := h.BaseHandler.Informer.GetStore().GetByKey(fmt.Sprintf("%s/%s", namespace, name))
	if err != nil {
		return nil, err
	}
	if podObj == nil {
		return nil, fmt.Errorf("pod %s/%s not found in store", namespace, name)
	}
	pod, ok := podObj.(*v1.Pod)
	if !ok {
		return nil, fmt.Errorf("failed to type assert pod object %s/%s", namespace, name)
	}
	var names []string
	for _, c := range pod.Spec.InitContainers {
		names = append(names, c.Name)
	}
	for _, c := range pod.Spec.Containers {
		names = append(names, c.Name)
	}
	return names, nil
}

func (h *PodsHandler) fetchHistoricalLogs(ctx context.Context, namespace, podName, containerName string, tailLines int64) []LogMessage {
	podLogOptions := &v1.PodLogOptions{
		Container:  containerName,
		Timestamps: true,
		Follow:     false,
		TailLines:  &tailLines,
	}
	req := h.clientSet.CoreV1().Pods(namespace).GetLogs(podName, podLogOptions)
	podLogs, err := req.Stream(ctx)
	if err != nil {
		log.Error("failed to open historical log stream", "pod", podName, "container", containerName, "err", err)
		return nil
	}
	defer podLogs.Close()

	var (
		result []LogMessage
		lastTS time.Time
	)
	if err := readLogLines(podLogs, func(line string) bool {
		result = append(result, newLogMessage(line, containerName, &lastTS))
		return true
	}); err != nil && !isBenignStreamClose(ctx, err) {
		log.Error("historical log read error", "pod", podName, "container", containerName, "err", err)
	}
	return result
}

func (h *PodsHandler) GetLogHistory(c echo.Context) error {
	ctx := c.Request().Context()
	name := c.Param("name")
	namespace := c.QueryParam("namespace")
	containerName := c.QueryParam("container")
	allContainers := c.QueryParam("all-containers")
	beforeStr := c.QueryParam("before")
	batchSizeStr := c.QueryParam("batchSize")

	if beforeStr == "" {
		return echo.NewHTTPError(http.StatusBadRequest, "before parameter is required")
	}

	beforeTime, err := time.Parse(timestampLayout, beforeStr)
	if err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "invalid before timestamp")
	}

	batchSize := int64(500)
	if batchSizeStr != "" {
		if parsed, err := strconv.ParseInt(batchSizeStr, 10, 64); err == nil && parsed > 0 {
			batchSize = parsed
		}
	}

	containerNames, err := h.getContainerNames(namespace, name, containerName, allContainers)
	if err != nil {
		return echo.NewHTTPError(http.StatusNotFound, err.Error())
	}

	// Fetch with escalating tailLines until we find enough older logs
	var allLogs []LogMessage
	var hasMore bool
	tailLines := batchSize * 3
	maxTailLines := int64(50000)

	for tailLines <= maxTailLines {
		allLogs = nil
		for _, cn := range containerNames {
			logs := h.fetchHistoricalLogs(ctx, namespace, name, cn, tailLines)
			allLogs = append(allLogs, logs...)
		}

		// Filter to logs before the cutoff
		var filtered []LogMessage
		for _, l := range allLogs {
			t, err := time.Parse(timestampLayout, l.Timestamp)
			if err != nil {
				continue
			}
			if t.Before(beforeTime) {
				filtered = append(filtered, l)
			}
		}

		if len(filtered) >= int(batchSize) || tailLines >= maxTailLines {
			// Sort by timestamp
			sort.Slice(filtered, func(i, j int) bool {
				return filtered[i].Timestamp < filtered[j].Timestamp
			})
			// Take the last batchSize entries (most recent before cutoff)
			if int64(len(filtered)) > batchSize {
				filtered = filtered[len(filtered)-int(batchSize):]
				hasMore = true
			} else {
				// We fetched everything up to maxTailLines and got fewer than batchSize
				hasMore = tailLines < maxTailLines && int64(len(allLogs)) >= tailLines
			}
			return c.JSON(http.StatusOK, HistoryResponse{Logs: filtered, HasMore: hasMore})
		}

		// Not enough older logs found, try with more
		if int64(len(allLogs)) < tailLines {
			// We got fewer lines than requested — there are no more logs
			sort.Slice(filtered, func(i, j int) bool {
				return filtered[i].Timestamp < filtered[j].Timestamp
			})
			return c.JSON(http.StatusOK, HistoryResponse{Logs: filtered, HasMore: false})
		}

		tailLines *= 2
	}

	return c.JSON(http.StatusOK, HistoryResponse{Logs: nil, HasMore: false})
}
