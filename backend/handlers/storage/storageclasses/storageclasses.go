package storageclasses

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

type StorageClassesHandler struct {
	BaseHandler base.BaseHandler
}

func NewStorageClassRouteHandler(container container.Container, routeType base.RouteType) echo.HandlerFunc {
	return func(c echo.Context) error {
		handler := NewStorageClassesHandler(c.Request().Context(), c.QueryParam("config"), c.QueryParam("cluster"), container)

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

func NewStorageClassesHandler(ctx context.Context, config, cluster string, container container.Container) *StorageClassesHandler {
	informer := container.SharedInformerFactory(config, cluster).Storage().V1().StorageClasses().Informer()
	informer.SetTransform(helpers.StripUnusedFields)

	handler := &StorageClassesHandler{
		BaseHandler: base.BaseHandler{
			Kind:             "StorageClass",
			Container:        container,
			Informer:         informer,
			RestClient:       container.ClientSet(config, cluster).StorageV1().RESTClient(),
			QueryConfig:      config,
			QueryCluster:     cluster,
			InformerCacheKey: fmt.Sprintf("%s-%s-storageClassInformer", config, cluster),
			TransformFunc:    transformItems,
		},
	}
	cache := base.ResourceEventHandler[*storageV1.StorageClass](&handler.BaseHandler)
	handler.BaseHandler.StartInformer(cache)
	handler.BaseHandler.WaitForSync(ctx)
	return handler
}

func transformItems(items []any, b *base.BaseHandler) ([]byte, error) {
	var list []storageV1.StorageClass

	for _, obj := range items {
		if item, ok := obj.(*storageV1.StorageClass); ok {
			list = append(list, *item)
		}
	}
	t := TransformStorageClass(list)

	return json.Marshal(t)
}
