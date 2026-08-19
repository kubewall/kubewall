package networkpolicies

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"

	networkingV1 "k8s.io/api/networking/v1"

	"github.com/kubewall/kubewall/backend/container"
	"github.com/kubewall/kubewall/backend/handlers/base"
	"github.com/kubewall/kubewall/backend/handlers/helpers"
	"github.com/labstack/echo/v4"
)

type NetworkPoliciesHandler struct {
	BaseHandler base.BaseHandler
}

func NewNetworkPolicyRouteHandler(container container.Container, routeType base.RouteType) echo.HandlerFunc {
	return func(c echo.Context) error {
		handler := NewNetworkPoliciesHandler(c.Request().Context(), c.QueryParam("config"), c.QueryParam("cluster"), container)

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
			return handler.BaseHandler.Delete(c)
		default:
			return echo.NewHTTPError(http.StatusInternalServerError, "Unknown route type")
		}
	}
}

func NewNetworkPoliciesHandler(ctx context.Context, config, cluster string, container container.Container) *NetworkPoliciesHandler {
	cacheKey := fmt.Sprintf("%s-%s-handlers/network/networkpolicies.NewNetworkPoliciesHandler", config, cluster)
	return base.GetOrCreateHandler(cacheKey, func() *NetworkPoliciesHandler {
		return newNetworkPoliciesHandler(ctx, config, cluster, container)
	})
}

func newNetworkPoliciesHandler(ctx context.Context, config, cluster string, container container.Container) *NetworkPoliciesHandler {
	informer := container.SharedInformerFactory(config, cluster).Networking().V1().NetworkPolicies().Informer()
	informer.SetTransform(helpers.StripUnusedFields)

	handler := &NetworkPoliciesHandler{
		BaseHandler: base.BaseHandler{
			Kind:             "NetworkPolicy",
			Container:        container,
			Informer:         informer,
			RestClient:       container.ClientSet(config, cluster).NetworkingV1().RESTClient(),
			QueryConfig:      config,
			QueryCluster:     cluster,
			InformerCacheKey: fmt.Sprintf("%s-%s-networkPolicyInformer", config, cluster),
			TransformFunc:    transformItems,
		},
	}
	cache := base.ResourceEventHandler[*networkingV1.NetworkPolicy](&handler.BaseHandler)
	handler.BaseHandler.StartInformer(cache)
	handler.BaseHandler.WaitForSync(ctx)
	return handler
}

func transformItems(items []any, b *base.BaseHandler) ([]byte, error) {
	var list []networkingV1.NetworkPolicy

	for _, obj := range items {
		if item, ok := obj.(*networkingV1.NetworkPolicy); ok {
			list = append(list, *item)
		}
	}
	t := TransformNetworkPolicy(list)

	return json.Marshal(t)
}
