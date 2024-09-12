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
	streamID := fmt.Sprintf("%s-%s-%s", h.QueryConfig, h.QueryCluster, h.Kind)
	h.Container.SSE().ServeHTTP(streamID, c.Response(), c.Request())
	return nil
}

func (h *BaseHandler) GetDetails(c echo.Context) error {
	streamID, item, exists, err := h.getStreamIDAndItem(c.QueryParam("namespace"), c.Param("name"))
	if err != nil {
		return c.String(http.StatusBadRequest, err.Error())
	}
	go func() {
		h.Container.SSE().Publish(streamID, &sse.Event{
			Data: h.marshalDetailData(item, exists),
		})
	}()
	h.Container.SSE().ServeHTTP(streamID, c.Response(), c.Request())
	return nil
}

func (h *BaseHandler) GetYaml(c echo.Context) error {
	streamID, item, exists, err := h.getStreamIDAndItem(c.QueryParam("namespace"), c.Param("name"))
	if err != nil {
		return c.String(http.StatusBadRequest, err.Error())
	}
	go func() {
		h.Container.SSE().Publish(fmt.Sprintf("%s-yaml", streamID), &sse.Event{
			Data: h.marshalYAML(item, exists),
		})
	}()

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
