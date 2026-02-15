package persistentvolumes

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"

	"github.com/kubewall/kubewall/backend/container"
	"github.com/kubewall/kubewall/backend/handlers/base"
	"github.com/kubewall/kubewall/backend/handlers/helpers"
	"github.com/labstack/echo/v4"
	coreV1 "k8s.io/api/core/v1"
)

type PersistentVolumeHandler struct {
	BaseHandler base.BaseHandler
}

func NewPersistentVolumeRouteHandler(container container.Container, routeType base.RouteType) echo.HandlerFunc {
	return func(c echo.Context) error {
		handler := NewPersistentVolumeHandler(c.Request().Context(), c.QueryParam("config"), c.QueryParam("cluster"), container)

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

func NewPersistentVolumeHandler(ctx context.Context, config, cluster string, container container.Container) *PersistentVolumeHandler {
	informer := container.SharedInformerFactory(config, cluster).Core().V1().PersistentVolumes().Informer()
	informer.SetTransform(helpers.StripUnusedFields)

	handler := &PersistentVolumeHandler{
		BaseHandler: base.BaseHandler{
			Kind:             "PersistentVolume",
			Container:        container,
			Informer:         informer,
			RestClient:       container.ClientSet(config, cluster).CoreV1().RESTClient(),
			QueryConfig:      config,
			QueryCluster:     cluster,
			InformerCacheKey: fmt.Sprintf("%s-%s-persistentVolumeInformer", config, cluster),
			TransformFunc:    transformItems,
		},
	}
	cache := base.ResourceEventHandler[*coreV1.PersistentVolume](&handler.BaseHandler)
	handler.BaseHandler.StartInformer(cache)
	handler.BaseHandler.WaitForSync(ctx)
	return handler
}

func transformItems(items []any, b *base.BaseHandler) ([]byte, error) {
	var list []coreV1.PersistentVolume

	for _, obj := range items {
		if item, ok := obj.(*coreV1.PersistentVolume); ok {
			list = append(list, *item)
		}
	}
	t := TransformPersistentVolumeList(list)

	return json.Marshal(t)
}
