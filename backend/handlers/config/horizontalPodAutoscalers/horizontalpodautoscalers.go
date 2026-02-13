package horizontalpodautoscalers

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"

	autoScalingV2 "k8s.io/api/autoscaling/v2"

	"github.com/kubewall/kubewall/backend/container"
	"github.com/kubewall/kubewall/backend/handlers/base"
	"github.com/kubewall/kubewall/backend/handlers/helpers"
	"github.com/labstack/echo/v4"
)

type HorizontalPodAutoScalerHandler struct {
	BaseHandler base.BaseHandler
}

func NewHorizontalPodAutoscalersRouteHandler(container container.Container, routeType base.RouteType) echo.HandlerFunc {
	return func(c echo.Context) error {
		handler := NewHorizontalPodAutoScalerHandler(c.Request().Context(), c.QueryParam("config"), c.QueryParam("cluster"), container)

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

func NewHorizontalPodAutoScalerHandler(ctx context.Context, config, cluster string, container container.Container) *HorizontalPodAutoScalerHandler {
	informer := container.SharedInformerFactory(config, cluster).Autoscaling().V2().HorizontalPodAutoscalers().Informer()
	informer.SetTransform(helpers.StripUnusedFields)

	handler := &HorizontalPodAutoScalerHandler{
		BaseHandler: base.BaseHandler{
			Kind:             "HorizontalPodAutoscaler",
			Container:        container,
			Informer:         informer,
			RestClient:       container.ClientSet(config, cluster).AutoscalingV2().RESTClient(),
			QueryConfig:      config,
			QueryCluster:     cluster,
			InformerCacheKey: fmt.Sprintf("%s-%s-horizontalPodAutoscalerInformer", config, cluster),
			TransformFunc:    transformItems,
		},
	}
	cache := base.ResourceEventHandler[*autoScalingV2.HorizontalPodAutoscaler](&handler.BaseHandler)
	handler.BaseHandler.StartInformer(cache)
	handler.BaseHandler.WaitForSync(ctx)
	return handler
}

func transformItems(items []any, _ *base.BaseHandler) ([]byte, error) {
	var list []autoScalingV2.HorizontalPodAutoscaler

	for _, obj := range items {
		if item, ok := obj.(*autoScalingV2.HorizontalPodAutoscaler); ok {
			list = append(list, *item)
		}
	}

	t := TransformHorizontalPodAutoscaler(list)

	return json.Marshal(t)
}
