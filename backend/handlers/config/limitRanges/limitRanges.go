package limitranges

import (
	"encoding/json"
	"fmt"
	"net/http"
	"time"

	"github.com/kubewall/kubewall/backend/container"
	"github.com/kubewall/kubewall/backend/event"
	"github.com/kubewall/kubewall/backend/handlers/base"
	"github.com/kubewall/kubewall/backend/handlers/helpers"
	"github.com/labstack/echo/v4"
	coreV1 "k8s.io/api/core/v1"
)

type LimitRangesHandler struct {
	BaseHandler base.BaseHandler
}

func NewLimitRangesRouteHandler(container container.Container, routeType base.RouteType) echo.HandlerFunc {
	return func(c echo.Context) error {
		handler := NewLimitRangesHandler(c, container)

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

func NewLimitRangesHandler(c echo.Context, container container.Container) *LimitRangesHandler {
	config := c.QueryParam("config")
	cluster := c.QueryParam("cluster")

	informer := container.SharedInformerFactory(config, cluster).Core().V1().LimitRanges().Informer()
	informer.SetTransform(helpers.StripUnusedFields)

	handler := &LimitRangesHandler{
		BaseHandler: base.BaseHandler{
			Kind:             "LimitRanges",
			Container:        container,
			Informer:         informer,
			QueryConfig:      config,
			QueryCluster:     cluster,
			InformerCacheKey: fmt.Sprintf("%s-%s-limitRangesInformer", config, cluster),
			Event:            event.NewEventCounter(time.Millisecond * 250),
			TransformFunc:    transformItems,
		},
	}
	cache := base.ResourceEventHandler[*coreV1.LimitRange](&handler.BaseHandler)
	handler.BaseHandler.StartInformer(c, cache)
	go handler.BaseHandler.Event.Run()
	handler.BaseHandler.WaitForSync(c)
	return handler
}

func transformItems(items []interface{}, b *base.BaseHandler) ([]byte, error) {
	var list []coreV1.LimitRange

	for _, obj := range items {
		if item, ok := obj.(*coreV1.LimitRange); ok {
			list = append(list, *item)
		}
	}

	t := TransformLimitRange(list)

	return json.Marshal(t)
}
