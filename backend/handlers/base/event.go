package base

import (
	"context"
	"encoding/json"
	"fmt"
	"github.com/labstack/echo/v4"
	"github.com/r3labs/sse/v2"
	coreV1 "k8s.io/api/core/v1"
	metaV1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"sync"
	"time"
)

func (h *BaseHandler) buildEventStreamID(c echo.Context) string {
	return fmt.Sprintf("%s-%s-%s-%s-events", h.QueryConfig, h.QueryCluster, c.QueryParam("namespace"), c.Param("name"))
}

func (h *BaseHandler) fetchEvents(c echo.Context) []coreV1.Event {
	l, err := h.Container.ClientSet(c.QueryParam("config"), c.QueryParam("cluster")).
		CoreV1().
		Events(c.QueryParam("namespace")).
		List(c.Request().Context(), metaV1.ListOptions{
			FieldSelector: fmt.Sprintf("involvedObject.name=%s", c.Param("name")),
			TypeMeta:      metaV1.TypeMeta{Kind: h.Kind},
		})

	if err != nil {
		return []coreV1.Event{}
	}

	events := make([]coreV1.Event, 0)
	for _, event := range l.Items {
		event.ManagedFields = nil
		events = append(events, event)
	}
	return events
}

func (h *BaseHandler) marshalEvents(events []coreV1.Event) []byte {
	if len(events) == 0 || events == nil {
		return []byte("[]")
	}
	data, err := json.Marshal(events)
	if err != nil {
		return []byte("[]")
	}
	return data
}

// publishEvents: we need this common function for startEventTicker and GetEvents
func (h *BaseHandler) publishEvents(streamID string, data []byte) {
	h.Container.SSE().Publish(streamID, &sse.Event{
		Data: data,
	})
}

func (h *BaseHandler) startEventTicker(ctx context.Context, streamID string, data []byte) *time.Ticker {
	ticker := time.NewTicker(time.Second)
	go func() {
		defer ticker.Stop()
		<-ctx.Done()
	}()

	var wg sync.Mutex
	go func() {
		for range ticker.C {
			wg.Lock()
			if len(data) > 0 {
				h.publishEvents(streamID, data)
			}
			wg.Unlock()
		}
	}()

	return ticker
}
