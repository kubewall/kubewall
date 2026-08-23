package csinodes

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

type CSINodesHandler struct {
	BaseHandler base.BaseHandler
}

func NewCSINodeRouteHandler(container container.Container, routeType base.RouteType) echo.HandlerFunc {
	return func(c echo.Context) error {
		handler := NewCSINodesHandler(c.Request().Context(), c.QueryParam("config"), c.QueryParam("cluster"), container)

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

func NewCSINodesHandler(ctx context.Context, config, cluster string, container container.Container) *CSINodesHandler {
	cacheKey := fmt.Sprintf("%s-%s-handlers/storage/csinodes.NewCSINodesHandler", config, cluster)
	return base.GetOrCreateHandler(cacheKey, func() *CSINodesHandler {
		return newCSINodesHandler(ctx, config, cluster, container)
	})
}

func newCSINodesHandler(ctx context.Context, config, cluster string, container container.Container) *CSINodesHandler {
	informer := container.SharedInformerFactory(config, cluster).Storage().V1().CSINodes().Informer()
	informer.SetTransform(helpers.StripUnusedFields)

	handler := &CSINodesHandler{
		BaseHandler: base.BaseHandler{
			Kind:             "CSINode",
			Container:        container,
			Informer:         informer,
			RestClient:       container.ClientSet(config, cluster).StorageV1().RESTClient(),
			QueryConfig:      config,
			QueryCluster:     cluster,
			InformerCacheKey: fmt.Sprintf("%s-%s-csiNodeInformer", config, cluster),
			TransformFunc:    transformItems,
		},
	}
	cache := base.ResourceEventHandler[*storageV1.CSINode](&handler.BaseHandler)
	handler.BaseHandler.StartInformer(cache)
	handler.BaseHandler.WaitForSync(ctx)
	return handler
}

func transformItems(items []any, b *base.BaseHandler) ([]byte, error) {
	var list []storageV1.CSINode

	for _, obj := range items {
		if item, ok := obj.(*storageV1.CSINode); ok {
			list = append(list, *item)
		}
	}
	t := TransformCSINode(list)

	return json.Marshal(t)
}
