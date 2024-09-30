package statefulset

import (
	"encoding/json"
	"fmt"
	"net/http"

	"github.com/kubewall/kubewall/backend/handlers/base"
	"github.com/kubewall/kubewall/backend/handlers/helpers"
	appV1 "k8s.io/api/apps/v1"

	"github.com/kubewall/kubewall/backend/container"
	"github.com/labstack/echo/v4"
)

type StatefulSetHandler struct {
	BaseHandler base.BaseHandler
}

func NewStatefulSetRouteHandler(container container.Container, routeType base.RouteType) echo.HandlerFunc {
	return func(c echo.Context) error {
		handler := NewSatefulSetHandler(c, container)

		switch routeType {
		case base.GetList:
			return handler.BaseHandler.GetList(c)
		case base.GetDetails:
			return handler.BaseHandler.GetDetails(c)
		case base.GetEvents:
			return handler.BaseHandler.GetEvents(c)
		case base.GetYaml:
			return handler.BaseHandler.GetYaml(c)
		case base.Delete:
			return handler.BaseHandler.Delete(c)
		default:
			return echo.NewHTTPError(http.StatusInternalServerError, "Unknown route type")
		}
	}
}

func NewSatefulSetHandler(c echo.Context, container container.Container) *StatefulSetHandler {
	config := c.QueryParam("config")
	cluster := c.QueryParam("cluster")

	informer := container.SharedInformerFactory(config, cluster).Apps().V1().StatefulSets().Informer()
	informer.SetTransform(helpers.StripUnusedFields)

	handler := &StatefulSetHandler{
		BaseHandler: base.BaseHandler{
			Kind:             "StatefulSet",
			Container:        container,
			Informer:         informer,
			RestClient:       container.ClientSet(config, cluster).AppsV1().RESTClient(),
			QueryConfig:      config,
			QueryCluster:     cluster,
			InformerCacheKey: fmt.Sprintf("%s-%s-statefulSetInformer", config, cluster),
			TransformFunc:    transformItems,
		},
	}
	cache := base.ResourceEventHandler[*appV1.StatefulSet](&handler.BaseHandler)
	handler.BaseHandler.StartInformer(c, cache)
	handler.BaseHandler.WaitForSync(c)
	return handler
}

func transformItems(items []interface{}, b *base.BaseHandler) ([]byte, error) {
	var satefulsets []appV1.StatefulSet

	for _, obj := range items {
		if rep, ok := obj.(*appV1.StatefulSet); ok {
			satefulsets = append(satefulsets, *rep)
		}
	}
	t := TransformStatefulSetList(satefulsets)

	return json.Marshal(t)
}
