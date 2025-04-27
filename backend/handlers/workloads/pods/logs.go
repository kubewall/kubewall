package pods

import (
	"bufio"
	"context"
	"encoding/json"
	"fmt"
	"strings"
	"sync"
	"time"

	"github.com/labstack/echo/v4"
	"github.com/r3labs/sse/v2"
	v1 "k8s.io/api/core/v1"
)

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
		return
	}
	defer podLogs.Close()

	scanner := bufio.NewScanner(podLogs)

	for scanner.Scan() {
		logLine := scanner.Text()
		parts := strings.Split(logLine, " ")
		if len(parts) == 0 {
			return
		}
		logLine = strings.Join(parts[1:], " ")
		parseTime, err := time.Parse(time.RFC3339Nano, parts[0])
		if err != nil {
			return
		}
		logsChannel <- LogMessage{
			ContainerName: containerName,
			Timestamp:     parseTime.Format("2006-01-02 15:04:05.000Z"),
			Log:           logLine,
		}
	}
	if err := scanner.Err(); err != nil {
		return
	}
}

func (h *PodsHandler) publishLogs(c echo.Context, streamKey string, sseServer *sse.Server) (error, bool) {
	name := c.Param("name")
	namespace := c.QueryParam("namespace")
	container := c.QueryParam("container")
	isAllContainers := strings.EqualFold(c.QueryParam("all-containers"), "true")

	var containerNames []string

	if isAllContainers {
		podObj, _, err := h.BaseHandler.Informer.GetStore().GetByKey(fmt.Sprintf("%s/%s", c.QueryParam("namespace"), c.Param("name")))
		if err != nil {
			return err, true
		}
		pod := podObj.(*v1.Pod)
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

	logsChannel := make(chan LogMessage)
	defer close(logsChannel)

	for _, containerName := range containerNames {
		go h.fetchLogs(c.Request().Context(), namespace, name, containerName, logsChannel)
	}

	var log sync.Mutex
	for logMsg := range logsChannel {
		log.Lock()
		j, err := json.Marshal(logMsg)
		if err != nil {
			c.Logger().Errorf("failed to marshal log message: %v", err)
			return nil, true
		}

		sseServer.Publish(streamKey, &sse.Event{
			Data: j,
		})
		log.Unlock()
	}

	return nil, false
}
