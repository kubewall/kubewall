package poddisruptionbudgets

import (
	"encoding/json"
	"fmt"
	policyV1 "k8s.io/api/policy/v1"
	"net/http"
	"time"

	"github.com/kubewall/kubewall/backend/container"
	"github.com/kubewall/kubewall/backend/event"
	"github.com/kubewall/kubewall/backend/handlers/base"
	"github.com/kubewall/kubewall/backend/handlers/helpers"
	"github.com/labstack/echo/v4"
)

type PodDisruptionBudgetHandler struct {
	BaseHandler base.BaseHandler
}

func NewPodDisruptionBudgetRouteHandler(container container.Container, routeType base.RouteType) echo.HandlerFunc {
	return func(c echo.Context) error {
		handler := NewPodDisruptionBudgetHandler(c, container)

		switch routeType {
		case base.GetList:
			return handler.BaseHandler.GetList(c)
		case base.GetDetails:
			return handler.BaseHandler.GetDetails(c)
		case base.GetEvents:
			return handler.BaseHandler.GetEvents(c)
		case base.GetYaml:
			return handler.BaseHandler.GetYaml(c)
		default:
			return echo.NewHTTPError(http.StatusInternalServerError, "Unknown route type")
		}
	}
}

func NewPodDisruptionBudgetHandler(c echo.Context, container container.Container) *PodDisruptionBudgetHandler {
	config := c.QueryParam("config")
	cluster := c.QueryParam("cluster")

	informer := container.SharedInformerFactory(config, cluster).Policy().V1().PodDisruptionBudgets().Informer()
	informer.SetTransform(helpers.StripUnusedFields)

	handler := &PodDisruptionBudgetHandler{
		BaseHandler: base.BaseHandler{
			Kind:             "PodDisruptionBudget",
			Container:        container,
			Informer:         informer,
			QueryConfig:      config,
			QueryCluster:     cluster,
			InformerCacheKey: fmt.Sprintf("%s-%s-podDisruptionBudgetInformer", config, cluster),
			Event:            event.NewEventCounter(time.Second * 1),
			TransformFunc:    transformItems,
		},
	}
	cache := base.ResourceEventHandler[*policyV1.PodDisruptionBudget](&handler.BaseHandler)
	handler.BaseHandler.StartInformer(c, cache)
	go handler.BaseHandler.Event.Run()
	handler.BaseHandler.WaitForSync(c)
	return handler
}

func transformItems(items []interface{}, b *base.BaseHandler) ([]byte, error) {
	var list []policyV1.PodDisruptionBudget

	for _, obj := range items {
		if item, ok := obj.(*policyV1.PodDisruptionBudget); ok {
			list = append(list, *item)
		}
	}

	t := TransformPodDisruptionBudget(list)

	return json.Marshal(t)
}
