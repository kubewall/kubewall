package endpoints

import (
	"encoding/json"
	"fmt"
	v1 "k8s.io/api/core/v1"
	"net/http"
	"time"

	"github.com/kubewall/kubewall/backend/container"
	"github.com/kubewall/kubewall/backend/event"
	"github.com/kubewall/kubewall/backend/handlers/base"
	"github.com/kubewall/kubewall/backend/handlers/helpers"
	"github.com/labstack/echo/v4"
)

type EndpointsHandler struct {
	BaseHandler base.BaseHandler
}

func NewEndpointsRouteHandler(container container.Container, routeType base.RouteType) echo.HandlerFunc {
	return func(c echo.Context) error {
		handler := NewEndpointsHandler(c, container)

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

func NewEndpointsHandler(c echo.Context, container container.Container) *EndpointsHandler {
	config := c.QueryParam("config")
	cluster := c.QueryParam("cluster")

	informer := container.SharedInformerFactory(config, cluster).Core().V1().Endpoints().Informer()
	informer.SetTransform(helpers.StripUnusedFields)

	handler := &EndpointsHandler{
		BaseHandler: base.BaseHandler{
			Kind:             "Endpoints",
			Container:        container,
			Informer:         informer,
			QueryConfig:      config,
			QueryCluster:     cluster,
			InformerCacheKey: fmt.Sprintf("%s-%s-EndpointsInformer", config, cluster),
			Event:            event.NewEventCounter(time.Millisecond * 250),
			TransformFunc:    transformItems,
		},
	}

	cache := base.ResourceEventHandler[*v1.Endpoints](&handler.BaseHandler)
	handler.BaseHandler.StartInformer(c, cache)
	go handler.BaseHandler.Event.Run()
	handler.BaseHandler.WaitForSync(c)
	return handler
}

func transformItems(items []interface{}, b *base.BaseHandler) ([]byte, error) {
	var list []v1.Endpoints

	for _, obj := range items {
		if item, ok := obj.(*v1.Endpoints); ok {
			list = append(list, *item)
		}
	}
	t := TransformEndpoint(list)

	return json.Marshal(t)
}
