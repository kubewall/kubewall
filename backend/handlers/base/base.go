package base

import (
	"fmt"
	"net/http"

	"github.com/kubewall/kubewall/backend/container"
	"github.com/labstack/echo/v4"
	"github.com/r3labs/sse/v2"
	"k8s.io/client-go/rest"
	"k8s.io/client-go/tools/cache"
)

type RouteType int

const (
	GetList RouteType = iota
	GetDetails
	GetEvents
	GetYaml
	Delete
	GetLogs
	Create
)

type BaseHandler struct {
	Container  container.Container
	Informer   cache.SharedIndexInformer
	RestClient rest.Interface

	Kind             string
	QueryConfig      string
	QueryCluster     string
	InformerCacheKey string

	TransformFunc func([]any, *BaseHandler) ([]byte, error)
}

func (h *BaseHandler) GetList(c echo.Context) error {
	streamID := fmt.Sprintf("%s-%s-%s", h.QueryConfig, h.QueryCluster, h.Kind)
	h.Container.SSE().ServeHTTP(streamID, c.Response(), c.Request())
	return nil
}

func (h *BaseHandler) GetDetails(c echo.Context) error {
	streamID, item, exists, err := h.getStreamIDAndItem(h.Kind, c.QueryParam("namespace"), c.Param("name"))
	if err != nil {
		return c.String(http.StatusBadRequest, err.Error())
	}
	go h.Container.SSE().Publish(streamID, &sse.Event{
		Data: h.marshalDetailData(item, exists),
	})

	h.Container.SSE().ServeHTTP(streamID, c.Response(), c.Request())
	return nil
}

func (h *BaseHandler) GetYaml(c echo.Context) error {
	streamID, item, exists, err := h.getStreamIDAndItem(h.Kind, c.QueryParam("namespace"), c.Param("name"))
	if err != nil {
		return c.String(http.StatusBadRequest, err.Error())
	}
	go h.Container.SSE().Publish(fmt.Sprintf("%s-yaml", streamID), &sse.Event{
		Data: h.marshalYAML(item, exists),
	})

	h.Container.SSE().ServeHTTP(fmt.Sprintf("%s-yaml", streamID), c.Response(), c.Request())
	return nil
}

func (h *BaseHandler) GetEvents(c echo.Context) error {
	streamID := h.buildEventStreamID(c)
	events := h.fetchEvents(c)

	data := h.marshalEvents(events)
	h.publishEvents(streamID, data)

	ticker := h.startEventTicker(c.Request().Context(), streamID, data)
	defer ticker.Stop()

	h.Container.SSE().ServeHTTP(streamID, c.Response(), c.Request())
	return nil
}

func (h *BaseHandler) Delete(c echo.Context) error {
	type InputData struct {
		Namespace string `json:"namespace"`
		Name      string `json:"name"`
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
	for _, v := range *r {
		resource := h.GetResourceByKind(h.Kind)
		result := h.RestClient.Delete().Resource(resource.Name).Name(v.Name).NamespaceIfScoped(v.Namespace, resource.Namespaced).Do(c.Request().Context())
		if result.Error() != nil {
			failures = append(failures, Failures{
				Namespace: v.Namespace,
				Name:      v.Name,
				Message:   result.Error().Error(),
			})
		}
	}

	return c.JSON(http.StatusOK, map[string]any{
		"failures": failures,
	})
}
