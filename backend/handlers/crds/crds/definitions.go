package crds

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"

	"github.com/kubewall/kubewall/backend/container"
	"github.com/kubewall/kubewall/backend/handlers/base"
	"github.com/kubewall/kubewall/backend/handlers/helpers"
	"github.com/labstack/echo/v4"
	apiextensionsv1 "k8s.io/apiextensions-apiserver/pkg/apis/apiextensions/v1"
)

type CRDHandler struct {
	BaseHandler base.BaseHandler
}

func NewCRDRouteHandler(container container.Container, routeType base.RouteType) echo.HandlerFunc {
	return func(c echo.Context) error {
		handler := NewCRDHandler(c.Request().Context(), c.QueryParam("config"), c.QueryParam("cluster"), container)

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
			return handler.Delete(c)
		default:
			return echo.NewHTTPError(http.StatusInternalServerError, "Unknown route type")
		}
	}
}

func NewCRDHandler(ctx context.Context, config, cluster string, container container.Container) *CRDHandler {
	informer := container.ExtensionSharedFactoryInformer(config, cluster).Apiextensions().V1().CustomResourceDefinitions().Informer()
	informer.SetTransform(helpers.StripUnusedFields)

	handler := &CRDHandler{
		BaseHandler: base.BaseHandler{
			Kind:             "CustomResourceDefinition",
			Container:        container,
			Informer:         informer,
			QueryConfig:      config,
			QueryCluster:     cluster,
			RestClient:       container.ClientSet(config, cluster).RESTClient(),
			InformerCacheKey: fmt.Sprintf("%s-%s-customResourceDefinitionInformer", config, cluster),
			TransformFunc:    transformItems,
		},
	}

	cache := base.ResourceEventHandler[*apiextensionsv1.CustomResourceDefinition](&handler.BaseHandler)
	handler.BaseHandler.StartExtensionInformer(cache)
	handler.BaseHandler.WaitForSync(ctx)

	return handler
}

func transformItems(items []any, b *base.BaseHandler) ([]byte, error) {
	var list []apiextensionsv1.CustomResourceDefinition

	for _, obj := range items {
		if item, ok := obj.(*apiextensionsv1.CustomResourceDefinition); ok {
			list = append(list, *item)
		}
	}

	t := TransformCRD(list)

	return json.Marshal(t)
}

func (h *CRDHandler) Delete(c echo.Context) error {
	type InputData struct {
		Name string `json:"name"`
	}
	type Failures struct {
		Namespace string `json:"namespace"`
		Name      string `json:"name"`
		Message   string `json:"message"`
	}

	r := new([]InputData)
	if err := c.Bind(r); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, err.Error())
	}

	failures := make([]Failures, 0)
	for _, item := range *r {
		var err error
		crdURL := fmt.Sprintf("/apis/apiextensions.k8s.io/v1/customresourcedefinitions/%s", item.Name)
		err = h.BaseHandler.RestClient.Delete().
			AbsPath(crdURL).
			Do(c.Request().Context()).
			Error()

		if err != nil {
			failures = append(failures, Failures{
				Name:    item.Name,
				Message: err.Error(),
			})
		}
	}

	return c.JSON(http.StatusOK, map[string]any{
		"failures": failures,
	})
}
