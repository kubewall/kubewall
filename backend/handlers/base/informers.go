package base

import (
	"context"
	"fmt"
	"github.com/charmbracelet/log"
	"github.com/labstack/echo/v4"
	"k8s.io/apimachinery/pkg/util/wait"
	"k8s.io/client-go/tools/cache"
	"strings"
	"time"
)

type Resource interface {
	GetName() string
	GetNamespace() string
}

func ResourceEventHandler[T Resource](handler *BaseHandler, additionalEvents ...func()) cache.ResourceEventHandlerFuncs {
	handleEvent := func(obj any) {
		resource := obj.(T)
		// GetList
		go handler.Event.AddEvent(handler.Kind, handler.processList(resource.GetName()))

		streamName := fmt.Sprintf("%s-%s", resource.GetNamespace(), resource.GetName())
		// GetDetails
		go handler.Event.AddEvent(streamName, handler.processDetails(resource.GetNamespace(), resource.GetName()))

		// GetYAML
		go handler.Event.AddEvent(streamName+"-yaml", handler.processYAML(resource.GetNamespace(), resource.GetName()))

		for _, event := range additionalEvents {
			go handler.Event.AddEvent("deployments", event)
		}
	}

	return cache.ResourceEventHandlerFuncs{
		AddFunc:    handleEvent,
		UpdateFunc: func(oldObj, newObj any) { handleEvent(oldObj) },
		DeleteFunc: handleEvent,
	}
}

func (h *BaseHandler) StartInformer(c echo.Context, cache cache.ResourceEventHandlerFuncs) {
	h.baseInformer(c, cache)
	go h.Container.SharedInformerFactory(h.QueryConfig, h.QueryCluster).Start(context.Background().Done())
}

func (h *BaseHandler) StartExtensionInformer(c echo.Context, cache cache.ResourceEventHandlerFuncs) {
	h.baseInformer(c, cache)
	go h.Container.ExtensionSharedFactoryInformer(h.QueryConfig, h.QueryCluster).Start(context.Background().Done())
}

func (h *BaseHandler) StartDynamicInformer(c echo.Context, cache cache.ResourceEventHandlerFuncs) {
	h.baseInformer(c, cache)
	go h.Container.DynamicSharedInformerFactory(h.QueryConfig, h.QueryCluster).Start(context.Background().Done())
}

func (h *BaseHandler) baseInformer(_ echo.Context, cache cache.ResourceEventHandlerFuncs) {
	cacheKey := fmt.Sprintf("%s-%s-%s", h.QueryConfig, h.QueryCluster, h.InformerCacheKey)
	if h.Container.Cache().Has(cacheKey) {
		return
	}
	h.Container.Cache().Set(cacheKey, "started")
	h.Informer.AddEventHandler(cache)
}

func (h *BaseHandler) WaitForSync(c echo.Context) {
	err := wait.PollUntilContextCancel(c.Request().Context(), 100*time.Millisecond, true, func(context.Context) (done bool, err error) {
		hasSynced := h.Informer.HasSynced()
		if hasSynced {
			h.Event.AddEvent(h.Kind, h.processList(""))
		}
		return hasSynced, nil
	})
	if err != nil {
		log.Error("failed to load informer for sync")
		return
	}
}

func (h *BaseHandler) isNamespaceResource(r string) bool {
	cacheKey := fmt.Sprintf("%s-%s-nonNamespacedResources", h.QueryConfig, h.QueryCluster)
	c, exists := h.Container.Cache().Get(cacheKey)
	if !exists {
		return false
	}
	nonNamespacedResources := c.([]string)

	for _, resource := range nonNamespacedResources {
		if strings.EqualFold(r, resource) {
			return false
		}
	}

	return true
}
