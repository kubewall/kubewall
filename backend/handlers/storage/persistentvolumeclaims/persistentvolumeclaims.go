package persistentvolumeclaims

import (
	"encoding/json"
	"fmt"
	"net/http"

	"github.com/kubewall/kubewall/backend/container"
	"github.com/kubewall/kubewall/backend/handlers/base"
	"github.com/kubewall/kubewall/backend/handlers/helpers"
	"github.com/labstack/echo/v4"
	coreV1 "k8s.io/api/core/v1"
)

type PersistentVolumeClaimsHandler struct {
	BaseHandler base.BaseHandler
}

func NewPersistentVolumeClaimsRouteHandler(container container.Container, routeType base.RouteType) echo.HandlerFunc {
	return func(c echo.Context) error {
		handler := NewPersistentVolumeClaimsHandler(c, container)

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

func NewPersistentVolumeClaimsHandler(c echo.Context, container container.Container) *PersistentVolumeClaimsHandler {
	config := c.QueryParam("config")
	cluster := c.QueryParam("cluster")

	informer := container.SharedInformerFactory(config, cluster).Core().V1().PersistentVolumeClaims().Informer()
	informer.SetTransform(helpers.StripUnusedFields)

	handler := &PersistentVolumeClaimsHandler{
		BaseHandler: base.BaseHandler{
			Kind:             "PersistentVolumeClaim",
			Container:        container,
			Informer:         informer,
			RestClient:       container.ClientSet(config, cluster).CoreV1().RESTClient(),
			QueryConfig:      config,
			QueryCluster:     cluster,
			InformerCacheKey: fmt.Sprintf("%s-%s-persistentVolumeClaimInformer", config, cluster),
			TransformFunc:    transformItems,
		},
	}

	cache := base.ResourceEventHandler[*coreV1.PersistentVolumeClaim](&handler.BaseHandler)
	handler.BaseHandler.StartInformer(c, cache)
	handler.BaseHandler.WaitForSync(c)
	return handler
}

func transformItems(items []interface{}, b *base.BaseHandler) ([]byte, error) {
	var cronJobList []coreV1.PersistentVolumeClaim

	for _, obj := range items {
		if cronJob, ok := obj.(*coreV1.PersistentVolumeClaim); ok {
			cronJobList = append(cronJobList, *cronJob)
		}
	}
	t := TransformPersistentVolumeClaimsList(cronJobList)

	return json.Marshal(t)
}
