package namespaces

import (
	"encoding/json"
	"fmt"
	"net/http"

	"github.com/kubewall/kubewall/backend/container"
	"github.com/kubewall/kubewall/backend/handlers/base"
	"github.com/kubewall/kubewall/backend/handlers/helpers"
	"github.com/labstack/echo/v4"
	v1 "k8s.io/api/core/v1"
)

type NamespacesHandler struct {
	BaseHandler base.BaseHandler
}

func NewNamespacesRouteHandler(container container.Container, routeType base.RouteType) echo.HandlerFunc {
	return func(c echo.Context) error {
		handler := NewNamespacesHandler(c, container)

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

func NewNamespacesHandler(c echo.Context, container container.Container) *NamespacesHandler {
	config := c.QueryParam("config")
	cluster := c.QueryParam("cluster")

	informer := container.SharedInformerFactory(config, cluster).Core().V1().Namespaces().Informer()
	informer.SetTransform(helpers.StripUnusedFields)

	handler := &NamespacesHandler{
		BaseHandler: base.BaseHandler{
			Kind:             "Namespace",
			Container:        container,
			Informer:         informer,
			RestClient:       container.ClientSet(config, cluster).CoreV1().RESTClient(),
			QueryConfig:      config,
			QueryCluster:     cluster,
			InformerCacheKey: fmt.Sprintf("%s-%s-namespaceInformer", config, cluster),
			TransformFunc:    transformItems,
		},
	}
	cache := base.ResourceEventHandler[*v1.Namespace](&handler.BaseHandler)
	handler.BaseHandler.StartInformer(c, cache)
	handler.BaseHandler.WaitForSync(c)
	return handler
}

func transformItems(items []interface{}, b *base.BaseHandler) ([]byte, error) {
	var namespacesList []v1.Namespace

	for _, obj := range items {
		if pod, ok := obj.(*v1.Namespace); ok {
			namespacesList = append(namespacesList, *pod)
		}
	}

	t := TransformNamespaces(namespacesList)

	return json.Marshal(t)
}
