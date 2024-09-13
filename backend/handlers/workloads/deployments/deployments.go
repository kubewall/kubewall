package deployments

import (
	"encoding/json"
	"fmt"
	"github.com/kubewall/kubewall/backend/event"
	"github.com/kubewall/kubewall/backend/handlers/base"
	"github.com/kubewall/kubewall/backend/handlers/helpers"
	"github.com/kubewall/kubewall/backend/handlers/workloads/pods"
	"github.com/r3labs/sse/v2"
	v1 "k8s.io/api/apps/v1"
	coreV1 "k8s.io/api/core/v1"
	"net/http"
	"time"

	"github.com/kubewall/kubewall/backend/container"
	"github.com/labstack/echo/v4"
)

const GetPods = 12

type DeploymentsHandler struct {
	BaseHandler base.BaseHandler
}

func NewDeploymentRouteHandler(container container.Container, routeType base.RouteType) echo.HandlerFunc {
	return func(c echo.Context) error {
		handler := NewDeploymentsHandler(c, container)

		switch routeType {
		case base.GetList:
			return handler.BaseHandler.GetList(c)
		case base.GetDetails:
			return handler.BaseHandler.GetDetails(c)
		case base.GetEvents:
			return handler.BaseHandler.GetEvents(c)
		case base.GetYaml:
			return handler.BaseHandler.GetYaml(c)
		case GetPods:
			return handler.GetPods(c)
		default:
			return echo.NewHTTPError(http.StatusInternalServerError, "Unknown route type")
		}
	}
}

func NewDeploymentsHandler(c echo.Context, container container.Container) *DeploymentsHandler {
	config := c.QueryParam("config")
	cluster := c.QueryParam("cluster")

	informer := container.SharedInformerFactory(config, cluster).Apps().V1().Deployments().Informer()
	informer.SetTransform(helpers.StripUnusedFields)

	handler := &DeploymentsHandler{
		BaseHandler: base.BaseHandler{
			Kind:             "Deployment",
			Container:        container,
			Informer:         informer,
			QueryConfig:      config,
			QueryCluster:     cluster,
			InformerCacheKey: fmt.Sprintf("%s-%s-deploymentInformer", config, cluster),
			Event:            event.NewEventCounter(time.Millisecond * 250),
			TransformFunc:    transformItems,
		},
	}

	cache := base.ResourceEventHandler[*v1.Deployment](&handler.BaseHandler)
	handler.BaseHandler.StartInformer(c, cache)
	go handler.BaseHandler.Event.Run()
	handler.BaseHandler.WaitForSync(c)

	return handler
}

func transformItems(items []interface{}, b *base.BaseHandler) ([]byte, error) {
	var deploymentList []v1.Deployment

	for _, obj := range items {
		if dep, ok := obj.(*v1.Deployment); ok {
			deploymentList = append(deploymentList, *dep)
		}
	}

	t := TransformDeploymentList(deploymentList)

	return json.Marshal(t)
}

func (h *DeploymentsHandler) GetPods(c echo.Context) error {
	streamID := fmt.Sprintf("%s-%s-%s-deployments-pods", h.BaseHandler.QueryConfig, h.BaseHandler.QueryCluster, c.Param("name"))
	h.DeploymentsPods(c, streamID)
	h.BaseHandler.Container.SSE().ServeHTTP(streamID, c.Response(), c.Request())
	return nil
}

// DeploymentsPods get list of pods for given deployment
func (h *DeploymentsHandler) DeploymentsPods(c echo.Context, streamID string) {
	podsHandler := pods.NewPodsHandler(c, h.BaseHandler.Container)
	storeList := podsHandler.BaseHandler.Informer.GetStore().List()

	var podsList []coreV1.Pod
	for _, obj := range storeList {
		if item, ok := obj.(*coreV1.Pod); ok {
			podsList = append(podsList, *item)
		}
	}

	data, _ := json.Marshal(pods.TransformPodList(pods.FilterPodsByDeploymentName(podsList, c.Param("name"))))
	h.BaseHandler.Container.SSE().Publish(streamID, &sse.Event{
		Data: data,
	})
}
