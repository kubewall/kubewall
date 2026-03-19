package pods

import (
	"bufio"
	"context"
	"encoding/json"
	"fmt"
	"strings"
	"sync"
	"time"

	"github.com/charmbracelet/log"
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
	isAllContainers := strings.EqualFold(allContainers, "true")

	var containerNames []string

	if isAllContainers {
		podObj, _, err := h.BaseHandler.Informer.GetStore().GetByKey(fmt.Sprintf("%s/%s", namespace, name))
		if err != nil {
			return err, true
		}
		if podObj == nil {
			log.Error("pod not found in store", "namespace", namespace, "pod", name)
			return fmt.Errorf("pod %s/%s not found in store", namespace, name), true
		}
		pod, ok := podObj.(*v1.Pod)
		if !ok {
			log.Error("failed to type assert pod object", "namespace", namespace, "pod", name)
			return fmt.Errorf("failed to type assert pod object %s/%s", namespace, name), true
		}
		// Include init containers
		for _, initContainer := range pod.Spec.InitContainers {
			containerNames = append(containerNames, initContainer.Name)
		}
		// Include regular containers
		for _, logContainer := range pod.Spec.Containers {
			containerNames = append(containerNames, logContainer.Name)
		}
	} else {
		containerNames = []string{container}
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
