package nodes

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"

	"github.com/kubewall/kubewall/backend/container"
	"github.com/kubewall/kubewall/backend/handlers/base"
	"github.com/kubewall/kubewall/backend/handlers/helpers"
	"github.com/kubewall/kubewall/backend/handlers/workloads/pods"
	"github.com/labstack/echo/v4"
	coreV1 "k8s.io/api/core/v1"
)

const (
	GetPods = 12
)

type NodeHandler struct {
	BaseHandler base.BaseHandler
}

func NewNodeRouteHandler(container container.Container, routeType base.RouteType) echo.HandlerFunc {
	return func(c echo.Context) error {
		handler := NewNodeHandler(c.Request().Context(), c.QueryParam("config"), c.QueryParam("cluster"), container)

		switch routeType {
		case base.GetList:
			return handler.BaseHandler.GetList(c)
		case base.GetDetails:
			return handler.BaseHandler.GetDetails(c)
		case base.GetEvents:
			return handler.BaseHandler.GetEvents(c)
		case base.GetYaml:
			return handler.BaseHandler.GetYaml(c)
		case GetPods:
			return handler.GetPods(c)
		default:
			return echo.NewHTTPError(http.StatusInternalServerError, "Unknown route type")
		}
	}
}

func NewNodeHandler(ctx context.Context, config, cluster string, container container.Container) *NodeHandler {
	informer := container.SharedInformerFactory(config, cluster).Core().V1().Nodes().Informer()
	informer.SetTransform(helpers.StripUnusedFields)

	handler := &NodeHandler{
		BaseHandler: base.BaseHandler{
			Kind:             "Node",
			Container:        container,
			Informer:         informer,
			QueryConfig:      config,
			QueryCluster:     cluster,
			InformerCacheKey: fmt.Sprintf("%s-%s-nodeInformer", config, cluster),
			TransformFunc:    transformItems,
		},
	}
	cache := base.ResourceEventHandler[*coreV1.Node](&handler.BaseHandler)
	handler.BaseHandler.StartInformer(cache)
	handler.BaseHandler.WaitForSync(ctx)
	return handler
}

func transformItems(items []any, b *base.BaseHandler) ([]byte, error) {
	var list []coreV1.Node

	for _, obj := range items {
		if item, ok := obj.(*coreV1.Node); ok {
			list = append(list, *item)
		}
	}

	t := TransformNodes(list)

	return json.Marshal(t)
}

func (h *NodeHandler) GetPods(c echo.Context) error {
	streamID := fmt.Sprintf("%s-%s-%s-node-pods", h.BaseHandler.QueryConfig, h.BaseHandler.QueryCluster, c.Param("name"))
	ctx := c.Request().Context()
	config := c.QueryParam("config")
	cluster := c.QueryParam("cluster")
	go h.loadNodePods(ctx, config, cluster)
	h.BaseHandler.Container.SSE().ServeHTTP(streamID, c.Response(), c.Request())
	return nil
}

func (h *NodeHandler) loadNodePods(ctx context.Context, config, cluster string) {
	podsHandler := pods.NewPodsHandler(ctx, config, cluster, h.BaseHandler.Container)
	podsHandler.NodePods()
}
