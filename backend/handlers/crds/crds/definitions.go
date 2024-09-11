package crds

import (
	"encoding/json"
	"fmt"
	"github.com/kubewall/kubewall/backend/container"
	"github.com/kubewall/kubewall/backend/event"
	"github.com/kubewall/kubewall/backend/handlers/base"
	"github.com/kubewall/kubewall/backend/handlers/helpers"
	"github.com/labstack/echo/v4"
	apiextensionsv1 "k8s.io/apiextensions-apiserver/pkg/apis/apiextensions/v1"
	"net/http"
	"time"
)

type CRDHandler struct {
	BaseHandler base.BaseHandler
}

func NewCRDHandler(container container.Container, routeType base.RouteType) echo.HandlerFunc {
	return func(c echo.Context) error {
		config := c.QueryParam("config")
		cluster := c.QueryParam("cluster")

		informer := container.ExtensionSharedFactoryInformer(config, cluster).Apiextensions().V1().CustomResourceDefinitions().Informer()
		informer.SetTransform(helpers.StripUnusedFields)

		handler := &CRDHandler{
			BaseHandler: base.BaseHandler{
				Kind:             "CustomResourceDefinition",
				Container:        container,
				Informer:         informer,
				QueryConfig:      config,
				QueryCluster:     cluster,
				InformerCacheKey: fmt.Sprintf("%s-%s-CustomResourceDefinitionInformer", config, cluster),
				Event:            event.NewEventCounter(time.Second * 1),
				TransformFunc:    transformItems,
			},
		}

		cache := base.ResourceEventHandler[*apiextensionsv1.CustomResourceDefinition](&handler.BaseHandler)
		handler.BaseHandler.StartExtensionInformer(c, cache)
		go handler.BaseHandler.Event.Run()
		handler.BaseHandler.WaitForSync(c)

		switch routeType {
		case base.GetList:
			return handler.BaseHandler.GetList(c)
		case base.GetDetails:
			return handler.BaseHandler.GetDetails(c)
		case base.GetEvents:
			return handler.BaseHandler.GetEvents(c)
		case base.GetYaml:
			return handler.BaseHandler.GetYaml(c)
		default:
			return echo.NewHTTPError(http.StatusInternalServerError, "Unknown route type")
		}
	}
}

func transformItems(items []interface{}, b *base.BaseHandler) ([]byte, error) {
	var list []apiextensionsv1.CustomResourceDefinition

	for _, obj := range items {
		if item, ok := obj.(*apiextensionsv1.CustomResourceDefinition); ok {
			list = append(list, *item)
		}
	}

	t := TransformCRD(list)

	return json.Marshal(t)
}
