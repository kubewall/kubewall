package pods

import (
	"fmt"
	"sync"

	"github.com/kubewall/kubewall/backend/handlers/base"
	"k8s.io/client-go/kubernetes"
	"k8s.io/client-go/rest"

	"github.com/gorilla/websocket"
	"github.com/kubewall/kubewall/backend/event"
	"github.com/kubewall/kubewall/backend/handlers/helpers"

	"net/http"
	"strings"
	"time"

	"github.com/kubewall/kubewall/backend/container"
	"github.com/labstack/echo/v4"
	v1 "k8s.io/api/core/v1"
	"k8s.io/apimachinery/pkg/util/json"
)

type PodsHandler struct {
	BaseHandler base.BaseHandler
	clientSet   *kubernetes.Clientset
	restConfig  *rest.Config
}

func NewPodsRouteHandler(container container.Container, routeType base.RouteType) echo.HandlerFunc {
	return func(c echo.Context) error {
		handler := NewPodsHandler(c, container)

		switch routeType {
		case base.GetList:
			return handler.BaseHandler.GetList(c)
		case base.GetDetails:
			return handler.BaseHandler.GetDetails(c)
		case base.GetEvents:
			return handler.BaseHandler.GetEvents(c)
		case base.GetYaml:
			return handler.BaseHandler.GetYaml(c)
		case base.GetLogsWS:
			return handler.GetLogsWS(c)
		default:
			return echo.NewHTTPError(http.StatusInternalServerError, "Unknown route type")
		}
	}
}

func NewPodsHandler(c echo.Context, container container.Container) *PodsHandler {
	config := c.QueryParam("config")
	cluster := c.QueryParam("cluster")

	informer := container.SharedInformerFactory(config, cluster).Core().V1().Pods().Informer()
	informer.SetTransform(helpers.StripUnusedFields)

	handler := &PodsHandler{
		BaseHandler: base.BaseHandler{
			Kind:             "Pod",
			Container:        container,
			Informer:         informer,
			QueryConfig:      config,
			QueryCluster:     cluster,
			InformerCacheKey: fmt.Sprintf("%s-%s-podInformer", config, cluster),
			Event:            event.NewEventCounter(time.Millisecond * 250),
			TransformFunc:    transformItems,
		},
		restConfig: container.RestConfig(config, cluster),
		clientSet:  container.ClientSet(config, cluster),
	}

	additionalEvents := []map[string]func(){
		{
			"pods-deployments": func() {
				handler.DeploymentsPods(c)
			},
		},
	}

	cache := base.ResourceEventHandler[*v1.Pod](&handler.BaseHandler, additionalEvents...)
	handler.BaseHandler.StartInformer(c, cache)
	go handler.BaseHandler.Event.Run()
	handler.BaseHandler.WaitForSync(c)

	return handler
}

func transformItems(items []interface{}, b *base.BaseHandler) ([]byte, error) {
	var list []v1.Pod

	for _, obj := range items {
		if item, ok := obj.(*v1.Pod); ok {
			list = append(list, *item)
		}
	}
	t := TransformPodList(list)

	return json.Marshal(t)
}

func (h *PodsHandler) GetLogsWS(c echo.Context) error {
	ws, err := h.BaseHandler.Container.SocketUpgrader().Upgrade(c.Response(), c.Request(), nil)
	if err != nil {
		return err
	}
	defer ws.Close()

	name := c.Param("name")
	namespace := c.QueryParam("namespace")
	container := c.QueryParam("container")
	isAllContainers := strings.EqualFold(c.QueryParam("all-containers"), "true")

	var containerNames []string

	if isAllContainers {
		podObj, _, err := h.BaseHandler.Informer.GetStore().GetByKey(fmt.Sprintf("%s/%s", c.QueryParam("namespace"), c.Param("name")))
		if err != nil {
			return err
		}
		pod := podObj.(*v1.Pod)
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
	event := event.NewEventCounter(250 * time.Millisecond)
	var logMessages []LogMessage
	var mu sync.RWMutex

	go event.Run()

	for logMsg := range logsChannel {
		select {
		case <-c.Request().Context().Done():
			c.Logger().Info("request context cancelled, closing logs channel")
			return nil
		default:
			mu.Lock()
			event.AddEvent(fmt.Sprintf("pod-logs-%s", container), func() {
				mu.Lock()
				defer mu.Unlock()
				if len(logMessages) > 0 {
					j, err := json.Marshal(logMessages)
					if err != nil {
						c.Logger().Errorf("failed to marshal log message: %v", err)
					}

					err = ws.WriteMessage(websocket.TextMessage, j)
					if err != nil {
						c.Logger().Error(err)
					}
				}
				logMessages = []LogMessage{}
			})
			logMessages = append(logMessages, logMsg)
			mu.Unlock()
		}
	}

	return nil
}
