package base

import (
	"fmt"
	"github.com/kubewall/kubewall/backend/container"
	"github.com/kubewall/kubewall/backend/event"
	"github.com/labstack/echo/v4"
	"github.com/r3labs/sse/v2"
	"k8s.io/client-go/tools/cache"
	"net/http"
)

type RouteType int

const (
	GetList RouteType = iota
	GetDetails
	GetEvents
	GetYaml
	GetLogs
	GetLogsWS
)

type BaseHandler struct {
	Container container.Container
	Informer  cache.SharedIndexInformer

	Kind             string
	QueryConfig      string
	QueryCluster     string
	InformerCacheKey string

	Event         *event.EventProcessor
	TransformFunc func([]any, *BaseHandler) ([]byte, error)
}

func (h *BaseHandler) GetList(c echo.Context) error {
	go func() {
		<-c.Request().Context().Done()
	}()

	h.Container.SSE().ServeHTTP(h.Kind, c.Response(), c.Request())
	return nil
}

func (h *BaseHandler) processList(resourceName string) func() {
	return func() {
		items := h.Informer.GetStore().List()
		data := h.marshalListData(items, resourceName)
		h.Container.SSE().Publish(h.Kind, &sse.Event{
			Data: data,
		})
	}
}

func (h *BaseHandler) GetDetails(c echo.Context) error {
	go func() {
		<-c.Request().Context().Done()
	}()
	streamID, _, _, err := h.getStreamIDAndItem(c.QueryParam("namespace"), c.Param("name"))
	if err != nil {
		return c.String(http.StatusBadRequest, err.Error())
	}
	h.Event.AddEvent(streamID, h.processDetails(c.QueryParam("namespace"), c.Param("name")))
	h.Container.SSE().ServeHTTP(streamID, c.Response(), c.Request())
	return nil
}

func (h *BaseHandler) processDetails(namespace, name string) func() {
	return func() {
		streamID, item, exists, _ := h.getStreamIDAndItem(namespace, name)
		data := h.marshalDetailData(item, exists)
		h.Container.SSE().Publish(streamID, &sse.Event{
			Data: data,
		})
	}
}

func (h *BaseHandler) GetYaml(c echo.Context) error {
	go func() {
		<-c.Request().Context().Done()
	}()
	streamID, _, _, err := h.getStreamIDAndItem(c.QueryParam("namespace"), c.Param("name"))
	if err != nil {
		return c.String(http.StatusBadRequest, err.Error())
	}
	h.Event.AddEvent(streamID, h.processYAML(c.QueryParam("namespace"), c.Param("name")))
	h.Container.SSE().ServeHTTP(fmt.Sprintf("%s-yaml", streamID), c.Response(), c.Request())
	return nil
}

func (h *BaseHandler) processYAML(namespace, name string) func() {
	return func() {
		streamID, item, exists, _ := h.getStreamIDAndItem(namespace, name)
		data := h.marshalYAML(item, exists)
		h.Container.SSE().Publish(fmt.Sprintf("%s-yaml", streamID), &sse.Event{
			Data: data,
		})
	}
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
