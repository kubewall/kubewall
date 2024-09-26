package jobs

import (
	"encoding/json"
	"fmt"
	"net/http"
	"time"

	"github.com/kubewall/kubewall/backend/container"
	"github.com/kubewall/kubewall/backend/event"
	"github.com/kubewall/kubewall/backend/handlers/base"
	"github.com/kubewall/kubewall/backend/handlers/helpers"
	"github.com/labstack/echo/v4"
	batchV1 "k8s.io/api/batch/v1"
)

type JobsHandler struct {
	BaseHandler base.BaseHandler
}

func NewJobsRouteHandler(container container.Container, routeType base.RouteType) echo.HandlerFunc {
	return func(c echo.Context) error {
		handler := NewJobsHandler(c, container)

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

func NewJobsHandler(c echo.Context, container container.Container) *JobsHandler {
	config := c.QueryParam("config")
	cluster := c.QueryParam("cluster")

	informer := container.SharedInformerFactory(config, cluster).Batch().V1().Jobs().Informer()
	informer.SetTransform(helpers.StripUnusedFields)

	handler := &JobsHandler{
		BaseHandler: base.BaseHandler{
			Kind:             "Job",
			Container:        container,
			RestClient:       container.ClientSet(config, cluster).BatchV1().RESTClient(),
			Informer:         informer,
			QueryConfig:      config,
			QueryCluster:     cluster,
			InformerCacheKey: fmt.Sprintf("%s-%s-jobsInformer", config, cluster),
			Event:            event.NewEventCounter(time.Millisecond * 250),
			TransformFunc:    transformItems,
		},
	}

	cache := base.ResourceEventHandler[*batchV1.Job](&handler.BaseHandler)
	handler.BaseHandler.StartInformer(c, cache)
	go handler.BaseHandler.Event.Run()
	handler.BaseHandler.WaitForSync(c)
	return handler
}

func transformItems(items []interface{}, b *base.BaseHandler) ([]byte, error) {
	var jobList []batchV1.Job

	for _, obj := range items {
		if rep, ok := obj.(*batchV1.Job); ok {
			jobList = append(jobList, *rep)
		}
	}

	t := TransformJobsList(jobList)

	return json.Marshal(t)
}
