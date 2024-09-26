package configmaps

import (
	"encoding/json"
	"fmt"
	"net/http"
	"time"

	"github.com/kubewall/kubewall/backend/container"
	"github.com/kubewall/kubewall/backend/event"
	"github.com/kubewall/kubewall/backend/handlers/base"
	"github.com/kubewall/kubewall/backend/handlers/helpers"
	"github.com/labstack/echo/v4"
	coreV1 "k8s.io/api/core/v1"
)

type ConfigMapsHandler struct {
	BaseHandler base.BaseHandler
}

func NewConfigMapsRouteHandler(container container.Container, routeType base.RouteType) echo.HandlerFunc {
	return func(c echo.Context) error {
		handler := NewConfigMapsHandler(c, container)

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

func NewConfigMapsHandler(c echo.Context, container container.Container) *ConfigMapsHandler {
	config := c.QueryParam("config")
	cluster := c.QueryParam("cluster")

	informer := container.SharedInformerFactory(config, cluster).Core().V1().ConfigMaps().Informer()
	informer.SetTransform(helpers.StripUnusedFields)

	handler := &ConfigMapsHandler{
		BaseHandler: base.BaseHandler{
			Kind:             "ConfigMap",
			Container:        container,
			Informer:         informer,
			RestClient:       container.ClientSet(config, cluster).CoreV1().RESTClient(),
			QueryConfig:      config,
			QueryCluster:     cluster,
			InformerCacheKey: fmt.Sprintf("%s-%s-configMapInformer", config, cluster),
			Event:            event.NewEventCounter(time.Millisecond * 250),
			TransformFunc:    transformItems,
		},
	}
	cache := base.ResourceEventHandler[*coreV1.ConfigMap](&handler.BaseHandler)
	handler.BaseHandler.StartInformer(c, cache)
	go handler.BaseHandler.Event.Run()
	handler.BaseHandler.WaitForSync(c)
	return handler
}

func transformItems(items []interface{}, b *base.BaseHandler) ([]byte, error) {
	var configMapList []coreV1.ConfigMap

	for _, obj := range items {
		if rep, ok := obj.(*coreV1.ConfigMap); ok {
			configMapList = append(configMapList, *rep)
		}
	}
	t := TransformConfigMapList(configMapList)

	return json.Marshal(t)
}
