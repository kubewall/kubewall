package priorityclasses

import (
	"encoding/json"
	"fmt"
	v1 "k8s.io/api/scheduling/v1"
	"net/http"
	"time"

	"github.com/kubewall/kubewall/backend/container"
	"github.com/kubewall/kubewall/backend/event"
	"github.com/kubewall/kubewall/backend/handlers/base"
	"github.com/kubewall/kubewall/backend/handlers/helpers"
	"github.com/labstack/echo/v4"
)

type PriorityClassesHandler struct {
	BaseHandler base.BaseHandler
}

func NewPriorityClassRouteHandler(container container.Container, routeType base.RouteType) echo.HandlerFunc {
	return func(c echo.Context) error {
		config := c.QueryParam("config")
		cluster := c.QueryParam("cluster")

		informer := container.SharedInformerFactory(config, cluster).Scheduling().V1().PriorityClasses().Informer()
		informer.SetTransform(helpers.StripUnusedFields)

		handler := &PriorityClassesHandler{
			BaseHandler: base.BaseHandler{
				Kind:             "PriorityClass",
				Container:        container,
				Informer:         informer,
				QueryConfig:      config,
				QueryCluster:     cluster,
				InformerCacheKey: fmt.Sprintf("%s-%s-priorityClassInformer", config, cluster),
				Event:            event.NewEventCounter(time.Millisecond * 250),
				TransformFunc:    transformItems,
			},
		}
		cache := base.ResourceEventHandler[*v1.PriorityClass](&handler.BaseHandler)
		handler.BaseHandler.StartInformer(c, cache)
		go handler.BaseHandler.Event.Run()
		handler.BaseHandler.WaitForSync(c)

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

func transformItems(items []interface{}, b *base.BaseHandler) ([]byte, error) {
	var list []v1.PriorityClass

	for _, obj := range items {
		if item, ok := obj.(*v1.PriorityClass); ok {
			list = append(list, *item)
		}
	}

	t := TransformPriorityClassList(list)

	return json.Marshal(t)
}
