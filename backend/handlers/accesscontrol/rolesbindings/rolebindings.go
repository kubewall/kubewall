package rolebindings

import (
	"encoding/json"
	"fmt"
	rbacV1 "k8s.io/api/rbac/v1"
	"net/http"
	"time"

	"github.com/kubewall/kubewall/backend/container"
	"github.com/kubewall/kubewall/backend/event"
	"github.com/kubewall/kubewall/backend/handlers/base"
	"github.com/kubewall/kubewall/backend/handlers/helpers"
	"github.com/labstack/echo/v4"
)

type RoleBindingHandler struct {
	BaseHandler base.BaseHandler
}

func NewRoleBindingsRouteHandler(container container.Container, routeType base.RouteType) echo.HandlerFunc {
	return func(c echo.Context) error {
		handler := NewRoleBindingHandler(c, container)

		switch routeType {
		case base.GetList:
			return handler.BaseHandler.GetList(c)
		case base.GetDetails:
			return handler.BaseHandler.GetDetails(c)
		case base.GetEvents:
			return handler.BaseHandler.GetEvents(c)
		case base.GetYaml:
			return handler.BaseHandler.GetYaml(c)
		default:
			return echo.NewHTTPError(http.StatusInternalServerError, "Unknown route type")
		}
	}
}

func NewRoleBindingHandler(c echo.Context, container container.Container) *RoleBindingHandler {
	config := c.QueryParam("config")
	cluster := c.QueryParam("cluster")

	informer := container.SharedInformerFactory(config, cluster).Rbac().V1().RoleBindings().Informer()
	informer.SetTransform(helpers.StripUnusedFields)

	handler := &RoleBindingHandler{
		BaseHandler: base.BaseHandler{
			Kind:             "RoleBinding",
			Container:        container,
			Informer:         informer,
			QueryConfig:      config,
			QueryCluster:     cluster,
			InformerCacheKey: fmt.Sprintf("%s-%s-roleBindingInformer", config, cluster),
			Event:            event.NewEventCounter(time.Second * 1),
			TransformFunc:    transformItems,
		},
	}
	cache := base.ResourceEventHandler[*rbacV1.RoleBinding](&handler.BaseHandler)
	handler.BaseHandler.StartInformer(c, cache)
	go handler.BaseHandler.Event.Run()
	handler.BaseHandler.WaitForSync(c)
	return handler
}

func transformItems(items []interface{}, b *base.BaseHandler) ([]byte, error) {
	var list []rbacV1.RoleBinding

	for _, obj := range items {
		if item, ok := obj.(*rbacV1.RoleBinding); ok {
			list = append(list, *item)
		}
	}
	t := TransformRoleBindingList(list)

	return json.Marshal(t)
}
