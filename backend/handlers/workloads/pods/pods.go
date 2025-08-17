package pods

import (
	"context"
	"fmt"

	"github.com/charmbracelet/log"
	"github.com/kubewall/kubewall/backend/handlers/workloads/replicaset"
	"github.com/r3labs/sse/v2"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/metrics/pkg/apis/metrics/v1beta1"

	"github.com/kubewall/kubewall/backend/handlers/base"
	"k8s.io/client-go/kubernetes"
	"k8s.io/client-go/rest"

	"github.com/kubewall/kubewall/backend/handlers/helpers"

	"net/http"

	"github.com/kubewall/kubewall/backend/container"
	"github.com/labstack/echo/v4"
	v1 "k8s.io/api/core/v1"
	"k8s.io/apimachinery/pkg/util/json"
)

type PodsHandler struct {
	BaseHandler       base.BaseHandler
	clientSet         *kubernetes.Clientset
	restConfig        *rest.Config
	replicasetHandler *replicaset.ReplicaSetHandler
}

func NewPodsRouteHandler(container container.Container, routeType base.RouteType) echo.HandlerFunc {
	return func(c echo.Context) error {
		handler := NewPodsHandler(c, container)

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
		case base.GetLogs:
			return handler.GetLogs(c)
		default:
			return echo.NewHTTPError(http.StatusInternalServerError, "Unknown route type")
		}
	}
}

func NewPodsHandler(c echo.Context, container container.Container) *PodsHandler {
	config := c.QueryParam("config")
	cluster := c.QueryParam("cluster")

	informer := container.SharedInformerFactory(config, cluster).Core().V1().Pods().Informer()
	informer.SetTransform(helpers.StripUnusedFields)
	clientSet := container.ClientSet(config, cluster)

	handler := &PodsHandler{
		BaseHandler: base.BaseHandler{
			Kind:             "Pod",
			Container:        container,
			RestClient:       clientSet.CoreV1().RESTClient(),
			Informer:         informer,
			QueryConfig:      config,
			QueryCluster:     cluster,
			InformerCacheKey: fmt.Sprintf("%s-%s-podInformer", config, cluster),
			TransformFunc:    transformItems,
		},
		restConfig:        container.RestConfig(config, cluster),
		clientSet:         clientSet,
		replicasetHandler: replicaset.NewReplicaSetHandler(c, container),
	}

	additionalEvents := []map[string]func(){
		{
			"pods-deployments": func() {
				handler.DeploymentsPods(c)
			},
		},
	}

	cache := base.ResourceEventHandler[*v1.Pod](&handler.BaseHandler, additionalEvents...)
	handler.BaseHandler.StartInformer(c, cache)
	handler.BaseHandler.WaitForSync(c)

	return handler
}

func transformItems(items []any, b *base.BaseHandler) ([]byte, error) {
	var list []v1.Pod
	for _, obj := range items {
		if item, ok := obj.(*v1.Pod); ok {
			list = append(list, *item)
		}
	}
	podMetricsList := GetPodsMetricsList(b)
	t := TransformPodList(list, podMetricsList)

	return json.Marshal(t)
}

func GetPodsMetricsList(b *base.BaseHandler) *v1beta1.PodMetricsList {
	cacheKey := fmt.Sprintf(helpers.IsMetricServerAvailableCacheKeyFormat, b.QueryConfig, b.QueryCluster)
	value, exists := b.Container.Cache().GetIfPresent(cacheKey)
	if value == nil || value == false || !exists {
		return nil
	}
	podMetrics, err := b.Container.
		MetricClient(b.QueryConfig, b.QueryCluster).
		MetricsV1beta1().
		PodMetricses("").
		List(context.Background(), metav1.ListOptions{})
	if err != nil {
		log.Info("failed to get pod metrics", "err", err)
	}
	return podMetrics
}

func (h *PodsHandler) GetLogs(c echo.Context) error {
	sseServer := sse.New()
	sseServer.AutoStream = true
	sseServer.EventTTL = 0
	config := c.QueryParam("config")
	cluster := c.QueryParam("cluster")
	name := c.Param("name")
	namespace := c.Param("namespace")
	container := c.QueryParam("container")

	var key string
	if container != "" {
		key = fmt.Sprintf("%s-%s-%s-%s-%s-logs", config, cluster, name, namespace, container)
	} else {
		key = fmt.Sprintf("%s-%s-%s-%s-logs", config, cluster, name, namespace)
	}
	go h.publishLogsToSSE(c, key, sseServer)

	sseServer.ServeHTTP(key, c.Response(), c.Request())

	return nil
}
