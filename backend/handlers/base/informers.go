package base

import (
	"context"
	"fmt"
	"sync"
	"time"

	"github.com/charmbracelet/log"
	"github.com/r3labs/sse/v2"
	"k8s.io/client-go/tools/cache"
)

// informerInitOnce prevents duplicate AddEventHandler registrations.
var informerInitOnce sync.Map

type Resource interface {
	GetName() string
	GetNamespace() string
}

func ResourceEventHandler[T Resource](handler *BaseHandler, additionalEvents ...map[string]func()) cache.ResourceEventHandlerFuncs {
	handleEvent := func(obj any) {
		resource, ok := obj.(T)
		if !ok {
			return
		}
		// GetList
		go handler.Container.EventProcessor().AddEvent(handler.Kind, handler.processListEvents(resource.GetName()))

		var streamName string
		if resource.GetNamespace() == "" {
			streamName = fmt.Sprintf("%s-%s-%s-%s", handler.QueryConfig, handler.QueryCluster, handler.Kind, resource.GetName())
		} else {
			streamName = fmt.Sprintf("%s-%s-%s-%s-%s", handler.QueryConfig, handler.QueryCluster, handler.Kind, resource.GetNamespace(), resource.GetName())
		}
		// GetDetails
		go handler.Container.EventProcessor().AddEvent(streamName, handler.processDetailsEvents(handler.Kind, resource.GetNamespace(), resource.GetName()))

		// GetYAML
		go handler.Container.EventProcessor().AddEvent(streamName+"-yaml", handler.processYAMLEvents(handler.Kind, resource.GetNamespace(), resource.GetName()))

		for _, event := range additionalEvents {
			for key, e := range event {
				go handler.Container.EventProcessor().AddEvent(key, e)
			}
		}
	}

	return cache.ResourceEventHandlerFuncs{
		AddFunc:    handleEvent,
		UpdateFunc: func(oldObj, newObj any) { handleEvent(newObj) },
		DeleteFunc: handleEvent,
	}
}

func (h *BaseHandler) StartInformer(events cache.ResourceEventHandlerFuncs) {
	h.baseInformer(events)
	go h.Container.SharedInformerFactory(h.QueryConfig, h.QueryCluster).Start(context.Background().Done())
}

func (h *BaseHandler) StartExtensionInformer(events cache.ResourceEventHandlerFuncs) {
	h.baseInformer(events)
	go h.Container.ExtensionSharedFactoryInformer(h.QueryConfig, h.QueryCluster).Start(context.Background().Done())
}

func (h *BaseHandler) StartDynamicInformer(events cache.ResourceEventHandlerFuncs) {
	h.baseInformer(events)
	go h.Container.DynamicSharedInformerFactory(h.QueryConfig, h.QueryCluster).Start(context.Background().Done())
}

func (h *BaseHandler) baseInformer(events cache.ResourceEventHandlerFuncs) {
	once, _ := informerInitOnce.LoadOrStore(h.InformerCacheKey, &sync.Once{})
	once.(*sync.Once).Do(func() {
		h.Container.Cache().Set(h.InformerCacheKey, true)
		_ = h.Informer.SetWatchErrorHandler(func(r *cache.Reflector, err error) {
			log.Warn("failed to watch, will backoff and retry", "error", err, "kind", h.Kind)
		})
		if _, err := h.Informer.AddEventHandler(events); err != nil {
			log.Warn("failed to load baseInformer", "error", err, "kind", h.Kind)
		}
	})
}

func (h *BaseHandler) WaitForSync(ctx context.Context) {
	ctx, cancel := context.WithTimeout(ctx, 30*time.Second)
	defer cancel()

	if !cache.WaitForCacheSync(ctx.Done(), h.Informer.HasSynced) {
		log.Warn("failed to sync informer within timeout", "kind", h.Kind)
		return
	}

	h.Container.EventProcessor().AddEvent(h.Kind, h.processListEvents(""))
}

func (h *BaseHandler) processListEvents(resourceName string) func() {
	return func() {
		items := h.Informer.GetStore().List()
		data := h.marshalListData(items, resourceName)
		streamID := fmt.Sprintf("%s-%s-%s", h.QueryConfig, h.QueryCluster, h.Kind)
		h.Container.SSE().Publish(streamID, &sse.Event{
			Data: data,
		})
	}
}

func (h *BaseHandler) processDetailsEvents(kind, namespace, name string) func() {
	return func() {
		streamID, item, exists, _ := h.getStreamIDAndItem(kind, namespace, name)
		data := h.marshalDetailData(item, exists)
		h.Container.SSE().Publish(streamID, &sse.Event{
			Data: data,
		})
	}
}

func (h *BaseHandler) processYAMLEvents(kind, namespace, name string) func() {
	return func() {
		streamID, item, exists, _ := h.getStreamIDAndItem(kind, namespace, name)
		data := h.marshalYAML(item, exists)
		h.Container.SSE().Publish(fmt.Sprintf("%s-yaml", streamID), &sse.Event{
			Data: data,
		})
	}
}
