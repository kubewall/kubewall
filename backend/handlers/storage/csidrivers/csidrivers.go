package csidrivers

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"

	storageV1 "k8s.io/api/storage/v1"

	"github.com/kubewall/kubewall/backend/container"
	"github.com/kubewall/kubewall/backend/handlers/base"
	"github.com/kubewall/kubewall/backend/handlers/helpers"
	"github.com/labstack/echo/v4"
)

type CSIDriversHandler struct {
	BaseHandler base.BaseHandler
}

func NewCSIDriverRouteHandler(container container.Container, routeType base.RouteType) echo.HandlerFunc {
	return func(c echo.Context) error {
		handler := NewCSIDriversHandler(c.Request().Context(), c.QueryParam("config"), c.QueryParam("cluster"), container)

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

func NewCSIDriversHandler(ctx context.Context, config, cluster string, container container.Container) *CSIDriversHandler {
	cacheKey := fmt.Sprintf("%s-%s-handlers/storage/csidrivers.NewCSIDriversHandler", config, cluster)
	return base.GetOrCreateHandler(cacheKey, func() *CSIDriversHandler {
		return newCSIDriversHandler(ctx, config, cluster, container)
	})
}

func newCSIDriversHandler(ctx context.Context, config, cluster string, container container.Container) *CSIDriversHandler {
	informer := container.SharedInformerFactory(config, cluster).Storage().V1().CSIDrivers().Informer()
	informer.SetTransform(helpers.StripUnusedFields)

	handler := &CSIDriversHandler{
		BaseHandler: base.BaseHandler{
			Kind:             "CSIDriver",
			Container:        container,
			Informer:         informer,
			RestClient:       container.ClientSet(config, cluster).StorageV1().RESTClient(),
			QueryConfig:      config,
			QueryCluster:     cluster,
			InformerCacheKey: fmt.Sprintf("%s-%s-csiDriverInformer", config, cluster),
			TransformFunc:    transformItems,
		},
	}
	cache := base.ResourceEventHandler[*storageV1.CSIDriver](&handler.BaseHandler)
	handler.BaseHandler.StartInformer(cache)
	handler.BaseHandler.WaitForSync(ctx)
	return handler
}

func transformItems(items []any, b *base.BaseHandler) ([]byte, error) {
	var list []storageV1.CSIDriver

	for _, obj := range items {
		if item, ok := obj.(*storageV1.CSIDriver); ok {
			list = append(list, *item)
		}
	}
	t := TransformCSIDriver(list)

	return json.Marshal(t)
}
