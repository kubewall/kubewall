package cronjobs

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"

	"github.com/kubewall/kubewall/backend/container"
	"github.com/kubewall/kubewall/backend/handlers/base"
	"github.com/kubewall/kubewall/backend/handlers/helpers"
	"github.com/kubewall/kubewall/backend/handlers/workloads/jobs"
	"github.com/labstack/echo/v4"
	batchV1 "k8s.io/api/batch/v1"
)

const (
	GetJobs base.RouteType = 12
)

type CronJobsHandler struct {
	BaseHandler base.BaseHandler
}

func NewCronJobsRouteHandler(container container.Container, routeType base.RouteType) echo.HandlerFunc {
	return func(c echo.Context) error {
		handler := NewCronJobsHandler(c.Request().Context(), c.QueryParam("config"), c.QueryParam("cluster"), container)

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
		case GetJobs:
			return handler.GetJobs(c)
		default:
			return echo.NewHTTPError(http.StatusInternalServerError, "Unknown route type")
		}
	}
}

func NewCronJobsHandler(ctx context.Context, config, cluster string, container container.Container) *CronJobsHandler {
	cacheKey := fmt.Sprintf("%s-%s-handlers/workloads/cronJobs.NewCronJobsHandler", config, cluster)
	return base.GetOrCreateHandler(cacheKey, func() *CronJobsHandler {
		return newCronJobsHandler(ctx, config, cluster, container)
	})
}

func newCronJobsHandler(ctx context.Context, config, cluster string, container container.Container) *CronJobsHandler {
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
	handler.BaseHandler.StartInformer(cache)
	handler.BaseHandler.WaitForSync(ctx)
	return handler
}

func transformItems(items []any, b *base.BaseHandler) ([]byte, error) {
	var cronJobList []batchV1.CronJob

	for _, obj := range items {
		if cronJob, ok := obj.(*batchV1.CronJob); ok {
			cronJobList = append(cronJobList, *cronJob)
		}
	}
	t := TransformCronJobsList(cronJobList)

	return json.Marshal(t)
}

// GetJobs streams the jobs a CronJob has spawned to its details view.
func (h *CronJobsHandler) GetJobs(c echo.Context) error {
	config := c.QueryParam("config")
	cluster := c.QueryParam("cluster")
	namespace := c.QueryParam("namespace")
	name := c.Param("name")

	streamID := jobs.CronJobJobsStreamID(h.BaseHandler.QueryConfig, h.BaseHandler.QueryCluster, namespace, name)
	ctx := c.Request().Context()
	// Register before publishing; see BaseHandler.GetList.
	h.BaseHandler.Container.SSE().CreateStream(streamID)
	go jobs.NewJobsHandler(ctx, config, cluster, h.BaseHandler.Container).PublishCronJobJobs(namespace, name)
	h.BaseHandler.Container.SSE().ServeHTTP(streamID, c.Response(), c.Request())

	return nil
}
