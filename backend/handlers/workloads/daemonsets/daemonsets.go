package daemonsets

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"

	"github.com/kubewall/kubewall/backend/handlers/base"
	"github.com/kubewall/kubewall/backend/handlers/helpers"

	"github.com/kubewall/kubewall/backend/container"
	"github.com/labstack/echo/v4"
	appV1 "k8s.io/api/apps/v1"
)

type DaemonSetsHandlers struct {
	BaseHandler base.BaseHandler
}

func NewDaemonSetsRouteHandler(container container.Container, routeType base.RouteType) echo.HandlerFunc {
	return func(c echo.Context) error {
		handler := NewDaemonSetsHandler(c.Request().Context(), c.QueryParam("config"), c.QueryParam("cluster"), container)

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

func NewDaemonSetsHandler(ctx context.Context, config, cluster string, container container.Container) *DaemonSetsHandlers {
	informer := container.SharedInformerFactory(config, cluster).Apps().V1().DaemonSets().Informer()
	informer.SetTransform(helpers.StripUnusedFields)

	handler := &DaemonSetsHandlers{
		BaseHandler: base.BaseHandler{
			Kind:             "Daemonset",
			Container:        container,
			Informer:         informer,
			RestClient:       container.ClientSet(config, cluster).AppsV1().RESTClient(),
			QueryConfig:      config,
			QueryCluster:     cluster,
			InformerCacheKey: fmt.Sprintf("%s-%s-daemonsetInformer", config, cluster),
			TransformFunc:    transformItems,
		},
	}

	cache := base.ResourceEventHandler[*appV1.DaemonSet](&handler.BaseHandler)
	handler.BaseHandler.StartInformer(cache)
	handler.BaseHandler.WaitForSync(ctx)
	return handler
}

func transformItems(items []any, b *base.BaseHandler) ([]byte, error) {
	var daemonSets []appV1.DaemonSet

	for _, obj := range items {
		if dep, ok := obj.(*appV1.DaemonSet); ok {
			daemonSets = append(daemonSets, *dep)
		}
	}

	t := TransformDaemonSetList(daemonSets)

	return json.Marshal(t)
}
