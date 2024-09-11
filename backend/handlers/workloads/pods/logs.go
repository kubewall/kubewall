package pods

import (
	"bufio"
	"context"
	v1 "k8s.io/api/core/v1"
	"strings"
	"time"
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

// For future use
//
//func (h *PodsHandler) publishLogs(c echo.Context) (error, bool) {
//	name := c.Param("name")
//	namespace := c.QueryParam("namespace")
//	container := c.QueryParam("container")
//	isAllContainers := strings.EqualFold(c.QueryParam("all-containers"), "true")
//
//	var containerNames []string
//
//	if isAllContainers {
//		podObj, _, err := h.BaseHandler.Informer.GetStore().GetByKey(fmt.Sprintf("%s/%s", c.QueryParam("namespace"), c.Param("name")))
//		if err != nil {
//			return err, true
//		}
//		pod := podObj.(*v1.Pod)
//		for _, logContainer := range pod.Spec.Containers {
//			containerNames = append(containerNames, logContainer.Name)
//		}
//	} else {
//		containerNames = []string{container}
//	}
//
//	logsChannel := make(chan LogMessage)
//	defer close(logsChannel)
//
//	for _, containerName := range containerNames {
//		go h.fetchLogs(c.Request().Context(), namespace, name, containerName, logsChannel)
//	}
//
//	var log sync.Mutex
//	for logMsg := range logsChannel {
//		log.Lock()
//		j, err := json.Marshal(logMsg)
//		if err != nil {
//			c.Logger().Errorf("failed to marshal log message: %v", err)
//			return nil, true
//		}
//
//		h.BaseHandler.Container.SSE().Publish("podsLogs", &sse.Event{
//			Data: j,
//		})
//		log.Unlock()
//	}
//
//	return nil, false
//}
