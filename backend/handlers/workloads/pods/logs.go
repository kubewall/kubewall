package pods

import (
	"bufio"
	"context"
	"encoding/json"
	"fmt"
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

const maxLogLineSize = 1024 * 1024

type LogMessage struct {
	ContainerName string `json:"containerName"`
	Timestamp     string `json:"timestamp"`
	Log           string `json:"log"`
}

func (h *PodsHandler) fetchLogs(ctx context.Context, namespace, podName, containerName string, logsChannel chan<- LogMessage) {
	i := int64(100)
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
		return
	}

	go func() {
		<-ctx.Done()
		podLogs.Close()
	}()
	defer podLogs.Close()

	scanner := bufio.NewScanner(podLogs)
	scanner.Buffer(make([]byte, 0, maxLogLineSize), maxLogLineSize)

	for scanner.Scan() {
		select {
		case <-ctx.Done():
			return
		default:
		}
		logLine := scanner.Text()
		parts := strings.Split(logLine, " ")
		if len(parts) == 0 {
			log.Warn("empty log line received", "pod", podName, "container", containerName)
			return
		}
		logLine = strings.Join(parts[1:], " ")
		parseTime, err := time.Parse(time.RFC3339Nano, parts[0])
		if err != nil {
			log.Error("failed to parse log timestamp", "pod", podName, "container", containerName, "raw", parts[0], "err", err)
			return
		}
		logsChannel <- LogMessage{
			ContainerName: containerName,
			Timestamp:     parseTime.Format("2006-01-02 15:04:05.000Z"),
			Log:           logLine,
		}
	}
	if err := scanner.Err(); err != nil && !strings.Contains(err.Error(), "http2: response body closed") {
		log.Error("log scanner error", "pod", podName, "container", containerName, "err", err)
	}
}

func (h *PodsHandler) publishLogsToSSE(ctx context.Context, name, namespace, container, allContainers, streamKey string, sseServer *sse.Server) (error, bool) {
	containerNames, err := h.getContainerNames(namespace, name, container, allContainers)
	if err != nil {
		return err, true
	}

	logsChannel := make(chan LogMessage, 100)

	var wg sync.WaitGroup
	for _, containerName := range containerNames {
		wg.Add(1)
		go func() {
			defer wg.Done()
			h.fetchLogs(ctx, namespace, name, containerName, logsChannel)
		}()
	}
	go func() {
		wg.Wait()
		close(logsChannel)
	}()

	for logMsg := range logsChannel {
		j, err := json.Marshal(logMsg)
		if err != nil {
			log.Error("failed to marshal log message", "err", err)
			continue
		}
		sseServer.Publish(streamKey, &sse.Event{
			Data: j,
		})
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

	var result []LogMessage
	scanner := bufio.NewScanner(podLogs)
	scanner.Buffer(make([]byte, 0, maxLogLineSize), maxLogLineSize)

	for scanner.Scan() {
		logLine := scanner.Text()
		parts := strings.Split(logLine, " ")
		if len(parts) == 0 {
			continue
		}
		parseTime, err := time.Parse(time.RFC3339Nano, parts[0])
		if err != nil {
			continue
		}
		result = append(result, LogMessage{
			ContainerName: containerName,
			Timestamp:     parseTime.Format(timestampLayout),
			Log:           strings.Join(parts[1:], " "),
		})
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
	hasMore := true
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
