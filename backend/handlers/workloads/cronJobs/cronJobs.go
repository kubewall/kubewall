package cronjobs

import (
	"encoding/json"
	"fmt"
	"github.com/kubewall/kubewall/backend/container"
	"github.com/kubewall/kubewall/backend/handlers/base"
	"github.com/kubewall/kubewall/backend/handlers/helpers"
	"github.com/labstack/echo/v4"
	batchV1 "k8s.io/api/batch/v1"
	"net/http"
)

type CronJobsHandler struct {
	BaseHandler base.BaseHandler
}

func NewCronJobsRouteHandler(container container.Container, routeType base.RouteType) echo.HandlerFunc {
	return func(c echo.Context) error {
		handler := NewCronJobsHandler(c, container)

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

func NewCronJobsHandler(c echo.Context, container container.Container) *CronJobsHandler {
	config := c.QueryParam("config")
	cluster := c.QueryParam("cluster")

	informer := container.SharedInformerFactory(config, cluster).Batch().V1().CronJobs().Informer()
	informer.SetTransform(helpers.StripUnusedFields)

	handler := &CronJobsHandler{
		BaseHandler: base.BaseHandler{
			Kind:             "CronJob",
			Container:        container,
			Informer:         informer,
			RestClient:       container.ClientSet(config, cluster).BatchV1().RESTClient(),
			QueryConfig:      config,
			QueryCluster:     cluster,
			InformerCacheKey: fmt.Sprintf("%s-%s-cronJobInformer", config, cluster),
			TransformFunc:    transformItems,
		},
	}
	cache := base.ResourceEventHandler[*batchV1.CronJob](&handler.BaseHandler)
	handler.BaseHandler.StartInformer(c, cache)
	handler.BaseHandler.WaitForSync(c)
	return handler
}

func transformItems(items []interface{}, b *base.BaseHandler) ([]byte, error) {
	var cronJobList []batchV1.CronJob

	for _, obj := range items {
		if cronJob, ok := obj.(*batchV1.CronJob); ok {
			cronJobList = append(cronJobList, *cronJob)
		}
	}
	t := TransformCronJobsList(cronJobList)

	return json.Marshal(t)
}
