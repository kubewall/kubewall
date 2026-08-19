package volumeattributesclasses

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

type VolumeAttributesClassesHandler struct {
	BaseHandler base.BaseHandler
}

func NewVolumeAttributesClassRouteHandler(container container.Container, routeType base.RouteType) echo.HandlerFunc {
	return func(c echo.Context) error {
		handler := NewVolumeAttributesClassesHandler(c.Request().Context(), c.QueryParam("config"), c.QueryParam("cluster"), container)

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

func NewVolumeAttributesClassesHandler(ctx context.Context, config, cluster string, container container.Container) *VolumeAttributesClassesHandler {
	cacheKey := fmt.Sprintf("%s-%s-handlers/storage/volumeattributesclasses.NewVolumeAttributesClassesHandler", config, cluster)
	return base.GetOrCreateHandler(cacheKey, func() *VolumeAttributesClassesHandler {
		return newVolumeAttributesClassesHandler(ctx, config, cluster, container)
	})
}

func newVolumeAttributesClassesHandler(ctx context.Context, config, cluster string, container container.Container) *VolumeAttributesClassesHandler {
	informer := container.SharedInformerFactory(config, cluster).Storage().V1().VolumeAttributesClasses().Informer()
	informer.SetTransform(helpers.StripUnusedFields)

	handler := &VolumeAttributesClassesHandler{
		BaseHandler: base.BaseHandler{
			Kind:             "VolumeAttributesClass",
			Container:        container,
			Informer:         informer,
			RestClient:       container.ClientSet(config, cluster).StorageV1().RESTClient(),
			QueryConfig:      config,
			QueryCluster:     cluster,
			InformerCacheKey: fmt.Sprintf("%s-%s-volumeAttributesClassInformer", config, cluster),
			TransformFunc:    transformItems,
		},
	}
	cache := base.ResourceEventHandler[*storageV1.VolumeAttributesClass](&handler.BaseHandler)
	handler.BaseHandler.StartInformer(cache)
	handler.BaseHandler.WaitForSync(ctx)
	return handler
}

func transformItems(items []any, b *base.BaseHandler) ([]byte, error) {
	var list []storageV1.VolumeAttributesClass

	for _, obj := range items {
		if item, ok := obj.(*storageV1.VolumeAttributesClass); ok {
			list = append(list, *item)
		}
	}
	t := TransformVolumeAttributesClass(list)

	return json.Marshal(t)
}
