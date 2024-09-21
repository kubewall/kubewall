package runtimeclasses

import (
	"encoding/json"
	"fmt"
	v1 "k8s.io/api/node/v1"
	"net/http"
	"time"

	"github.com/kubewall/kubewall/backend/container"
	"github.com/kubewall/kubewall/backend/event"
	"github.com/kubewall/kubewall/backend/handlers/base"
	"github.com/kubewall/kubewall/backend/handlers/helpers"
	"github.com/labstack/echo/v4"
)

type RunTimeClassesHandler struct {
	BaseHandler base.BaseHandler
}

func NewRunTimeClassRouteHandler(container container.Container, routeType base.RouteType) echo.HandlerFunc {
	return func(c echo.Context) error {
		handler := NewRunTimeClassHandler(c, container)

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

func NewRunTimeClassHandler(c echo.Context, container container.Container) *RunTimeClassesHandler {
	config := c.QueryParam("config")
	cluster := c.QueryParam("cluster")

	informer := container.SharedInformerFactory(config, cluster).Node().V1().RuntimeClasses().Informer()
	informer.SetTransform(helpers.StripUnusedFields)

	handler := &RunTimeClassesHandler{
		BaseHandler: base.BaseHandler{
			Kind:             "RuntimeClass",
			Container:        container,
			Informer:         informer,
			QueryConfig:      config,
			QueryCluster:     cluster,
			InformerCacheKey: fmt.Sprintf("%s-%s-runtimeClassInformer", config, cluster),
			Event:            event.NewEventCounter(time.Millisecond * 250),
			TransformFunc:    transformItems,
		},
	}
	cache := base.ResourceEventHandler[*v1.RuntimeClass](&handler.BaseHandler)
	handler.BaseHandler.StartInformer(c, cache)
	go handler.BaseHandler.Event.Run()
	handler.BaseHandler.WaitForSync(c)
	return handler
}

func transformItems(items []interface{}, b *base.BaseHandler) ([]byte, error) {
	var list []v1.RuntimeClass

	for _, obj := range items {
		if item, ok := obj.(*v1.RuntimeClass); ok {
			list = append(list, *item)
		}
	}

	t := TransformRunTimeClassList(list)

	return json.Marshal(t)
}
