package resources

import (
	"encoding/json"
	"fmt"
	"github.com/kubewall/kubewall/backend/container"
	"github.com/kubewall/kubewall/backend/event"
	"github.com/kubewall/kubewall/backend/handlers/base"
	"github.com/kubewall/kubewall/backend/handlers/helpers"
	"github.com/labstack/echo/v4"
	"github.com/r3labs/sse/v2"
	apiextensionsv1 "k8s.io/apiextensions-apiserver/pkg/apis/apiextensions/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"net/http"
	"strings"
	"time"
)

const (
	Get     = 10
	GetYAML = 12
)

type Output struct {
	AdditionalPrinterColumns []apiextensionsv1.CustomResourceColumnDefinition `json:"additionalPrinterColumns"`
	List                     []unstructured.Unstructured                      `json:"list"`
}

type UnstructuredHandler struct {
	BaseHandler base.BaseHandler
}

func NewUnstructuredHandler(container container.Container, routeType base.RouteType) echo.HandlerFunc {
	return func(c echo.Context) error {
		config := c.QueryParam("config")
		cluster := c.QueryParam("cluster")

		kind := c.QueryParam("kind")
		group := c.QueryParam("group")
		version := c.QueryParam("version")
		resource := c.QueryParam("resource")

		informer := container.DynamicSharedInformerFactory(config, cluster).ForResource(schema.GroupVersionResource{Group: group, Version: version, Resource: resource}).Informer()
		informer.SetTransform(helpers.StripUnusedFields)

		handler := &UnstructuredHandler{
			BaseHandler: base.BaseHandler{
				Kind:             kind,
				Container:        container,
				Informer:         informer,
				QueryConfig:      config,
				QueryCluster:     cluster,
				InformerCacheKey: fmt.Sprintf("%s-%s-%s-%s-%s-%s", config, cluster, group, version, resource, kind),
				Event:            event.NewEventCounter(time.Millisecond * 250),
				TransformFunc:    transformItems,
			},
		}

		cache := base.ResourceEventHandler[*unstructured.Unstructured](&handler.BaseHandler)
		handler.BaseHandler.StartDynamicInformer(c, cache)
		go handler.BaseHandler.Event.Run()
		handler.BaseHandler.WaitForSync(c)

		switch routeType {
		case base.GetList:
			return handler.BaseHandler.GetList(c)
		case Get:
			return handler.Get(c)
		case base.GetEvents:
			return handler.BaseHandler.GetEvents(c)
		case GetYAML:
			return handler.BaseHandler.GetYaml(c)
		default:
			return echo.NewHTTPError(http.StatusInternalServerError, "Unknown route type")
		}
	}
}

func (h *UnstructuredHandler) Get(c echo.Context) error {
	go func() {
		<-c.Request().Context().Done()
	}()

	key := fmt.Sprintf("%s/%s", c.Param("namespace"), c.Param("name"))
	if len(c.Param("namespace")) == 0 {
		key = c.Param("name")
	}

	h.BaseHandler.Event.AddEvent(key, h.ProcessDetails(c.Param("namespace"), c.Param("name")))
	h.BaseHandler.Container.SSE().ServeHTTP(key, c.Response(), c.Request())

	return nil
}

func (h *UnstructuredHandler) ProcessDetails(namespace, name string) func() {
	return func() {
		var b []byte
		streamID := fmt.Sprintf("%s/%s", namespace, name)
		l, exists, err := h.BaseHandler.Informer.GetStore().GetByKey(streamID)
		if err != nil || !exists {
			b = []byte("{}")
		} else {
			b, _ = json.Marshal(l)
		}

		h.BaseHandler.Container.SSE().Publish(streamID, &sse.Event{
			Data: b,
		})
	}
}

func transformItems(items []interface{}, b *base.BaseHandler) ([]byte, error) {
	var output Output
	list := make([]unstructured.Unstructured, 0)
	customResourceDefinitions := make([]apiextensionsv1.CustomResourceDefinition, 0)

	informer := b.Container.ExtensionSharedFactoryInformer(b.QueryConfig, b.QueryCluster).Apiextensions().V1().CustomResourceDefinitions().Informer()

	for _, obj := range informer.GetStore().List() {
		if item, ok := obj.(*apiextensionsv1.CustomResourceDefinition); ok {
			customResourceDefinitions = append(customResourceDefinitions, *item)
		}
	}

	for _, obj := range items {
		if item, ok := obj.(*unstructured.Unstructured); ok {
			list = append(list, *item)
		}
	}

	output.List = list
	output.AdditionalPrinterColumns = make([]apiextensionsv1.CustomResourceColumnDefinition, 0)

	if len(list) == 0 {
		return json.Marshal(output)
	}

	apiVersion := strings.Split(list[0].GetAPIVersion(), "/")
	if len(apiVersion) < 2 {
		return nil, fmt.Errorf("invalid apiVersion format")
	}

	selectedGroup, selectedVersion := apiVersion[0], apiVersion[1]
	kind := list[0].GetKind()

	for _, crd := range customResourceDefinitions {
		if crd.Spec.Group == selectedGroup && crd.Spec.Names.Kind == kind {
			for _, version := range crd.Spec.Versions {
				if version.Name == selectedVersion {
					output.AdditionalPrinterColumns = FilterAdditionalPrinterColumns(version.AdditionalPrinterColumns)
					break
				}
			}
			break
		}
	}

	if len(output.AdditionalPrinterColumns) == 0 {
		output.AdditionalPrinterColumns = []apiextensionsv1.CustomResourceColumnDefinition{}
	}

	return json.Marshal(output)
}

func FilterAdditionalPrinterColumns(additionalPrinterColumns []apiextensionsv1.CustomResourceColumnDefinition) []apiextensionsv1.CustomResourceColumnDefinition {
	output := make([]apiextensionsv1.CustomResourceColumnDefinition, 0)
	for _, column := range additionalPrinterColumns {
		if column.Name != "Age" && column.Name != "Name" && column.Name != "Namespace" {
			output = append(output, column)
		}
	}
	return output
}
