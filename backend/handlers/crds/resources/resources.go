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
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"net/http"
	"strings"
	"time"
)

const (
	GetDetails = 10
	GetYAML    = 12
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
		case GetDetails:
			return handler.Get(c)
		case base.GetEvents:
			return handler.BaseHandler.GetEvents(c)
		case GetYAML:
			return handler.BaseHandler.GetYaml(c)
		case base.Delete:
			return handler.Delete(c)
		default:
			return echo.NewHTTPError(http.StatusInternalServerError, "Unknown route type")
		}
	}
}

func (h *UnstructuredHandler) Get(c echo.Context) error {
	itemKey := fmt.Sprintf("%s/%s", c.Param("namespace"), c.Param("name"))
	if len(c.Param("namespace")) == 0 {
		itemKey = c.Param("name")
	}

	streamKey := fmt.Sprintf("%s-%s-%s", h.BaseHandler.QueryConfig, h.BaseHandler.QueryCluster, itemKey)
	streamKey = strings.ReplaceAll(streamKey, "/", "-")
	go h.BaseHandler.Event.AddEvent(streamKey, h.ProcessDetails(itemKey, streamKey))
	h.BaseHandler.Container.SSE().ServeHTTP(streamKey, c.Response(), c.Request())

	return nil
}

func (h *UnstructuredHandler) ProcessDetails(itemKey, steamKey string) func() {
	return func() {
		var b []byte
		l, exists, err := h.BaseHandler.Informer.GetStore().GetByKey(itemKey)
		if err != nil || !exists {
			b = []byte("{}")
		} else {
			b, _ = json.Marshal(l)
		}

		h.BaseHandler.Container.SSE().Publish(steamKey, &sse.Event{
			Data: b,
		})
	}
}

func (h *UnstructuredHandler) Delete(c echo.Context) error {
	group := c.QueryParam("group")
	version := c.QueryParam("version")
	resource := c.QueryParam("resource")

	type InputData struct {
		Name      string `json:"name"`
		Namespace string `json:"namespace"`
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
		gvr := schema.GroupVersionResource{
			Group:    group,    // replace with your custom resource group
			Version:  version,  // replace with your custom resource version
			Resource: resource, // replace with the plural name of your custom resource
		}

		if item.Namespace == "" {
			err = h.BaseHandler.Container.
				DynamicClient(h.BaseHandler.QueryConfig, h.BaseHandler.QueryCluster).
				Resource(gvr).
				Namespace(item.Namespace).
				Delete(c.Request().Context(), item.Name, metav1.DeleteOptions{})
		} else {
			err = h.BaseHandler.Container.
				DynamicClient(h.BaseHandler.QueryConfig, h.BaseHandler.QueryCluster).
				Resource(gvr).
				Delete(c.Request().Context(), item.Name, metav1.DeleteOptions{})
		}

		if err != nil {
			failures = append(failures, Failures{
				Namespace: item.Namespace,
				Name:      item.Name,
				Message:   err.Error(),
			})
		}
	}

	return c.JSON(http.StatusOK, map[string]any{
		"failures": failures,
	})
}

func transformItems(items []interface{}, b *base.BaseHandler) ([]byte, error) {
	output := Output{}
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
					output.AdditionalPrinterColumns = FilterAdditionalPrinterColumns(version.AdditionalPrinterColumns, b.IsNamespacedResource(kind))
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

func FilterAdditionalPrinterColumns(additionalPrinterColumns []apiextensionsv1.CustomResourceColumnDefinition, isNamespaced bool) []apiextensionsv1.CustomResourceColumnDefinition {
	output := make([]apiextensionsv1.CustomResourceColumnDefinition, 0)
	for _, column := range additionalPrinterColumns {
		if column.Name != "Age" && column.Name != "Name" && column.Name != "Namespace" {
			output = append(output, column)
		}
	}
	name := apiextensionsv1.CustomResourceColumnDefinition{
		Name:        "Name",
		Type:        "string",
		Format:      "",
		Description: "",
		Priority:    0,
		JSONPath:    ".metadata.name",
	}
	output = append([]apiextensionsv1.CustomResourceColumnDefinition{name}, output...)
	if isNamespaced {
		namespace := apiextensionsv1.CustomResourceColumnDefinition{
			Name:        "Namespace",
			Type:        "string",
			Format:      "",
			Description: "",
			Priority:    0,
			JSONPath:    ".metadata.namespace",
		}
		output = append([]apiextensionsv1.CustomResourceColumnDefinition{namespace}, output...)
	}

	age := apiextensionsv1.CustomResourceColumnDefinition{
		Name:        "Age",
		Type:        "Date",
		Format:      "",
		Description: "",
		Priority:    0,
		JSONPath:    ".metadata.creationTimestamp",
	}
	output = append(output, age)

	return output
}
