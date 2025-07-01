package endpoints

import (
	"encoding/json"
	"fmt"
	"net/http"

	discoveryv1 "k8s.io/api/discovery/v1"

	"github.com/kubewall/kubewall/backend/container"
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
		case base.Delete:
			return handler.BaseHandler.Delete(c)
		default:
			return echo.NewHTTPError(http.StatusInternalServerError, "Unknown route type")
		}
	}
}

func NewEndpointsHandler(c echo.Context, container container.Container) *EndpointsHandler {
	config := c.QueryParam("config")
	cluster := c.QueryParam("cluster")

	informer := container.SharedInformerFactory(config, cluster).Discovery().V1().EndpointSlices().Informer()
	informer.SetTransform(helpers.StripUnusedFields)

	handler := &EndpointsHandler{
		BaseHandler: base.BaseHandler{
			Kind:             "Endpoints",
			Container:        container,
			Informer:         informer,
			RestClient:       container.ClientSet(config, cluster).CoreV1().RESTClient(),
			QueryConfig:      config,
			QueryCluster:     cluster,
			InformerCacheKey: fmt.Sprintf("%s-%s-endpointsInformer", config, cluster),
			TransformFunc:    transformItems,
		},
	}

	cache := base.ResourceEventHandler[*discoveryv1.EndpointSlice](&handler.BaseHandler)
	handler.BaseHandler.StartInformer(c, cache)
	handler.BaseHandler.WaitForSync(c)
	return handler
}

func transformItems(items []any, b *base.BaseHandler) ([]byte, error) {
	var list []discoveryv1.EndpointSlice

	for _, obj := range items {
		if item, ok := obj.(*discoveryv1.EndpointSlice); ok {
			list = append(list, *item)
		}
	}
	t := TransformEndpoint(list)

	return json.Marshal(t)
}
