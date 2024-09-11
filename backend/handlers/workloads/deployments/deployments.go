package deployments

import (
	"encoding/json"
	"fmt"
	"github.com/kubewall/kubewall/backend/event"
	"github.com/kubewall/kubewall/backend/handlers/base"
	"github.com/kubewall/kubewall/backend/handlers/helpers"
	"github.com/kubewall/kubewall/backend/handlers/workloads/pods"
	"github.com/r3labs/sse/v2"
	v1 "k8s.io/api/apps/v1"
	coreV1 "k8s.io/api/core/v1"
	"net/http"
	"strings"
	"time"

	"github.com/kubewall/kubewall/backend/container"
	"github.com/labstack/echo/v4"
)

const GetPods = 12

type DeploymentsHandler struct {
	BaseHandler base.BaseHandler
}

func NewDeploymentRouteHandler(container container.Container, routeType base.RouteType) echo.HandlerFunc {
	return func(c echo.Context) error {
		handler := NewDeploymentsHandler(c, container)

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

func NewDeploymentsHandler(c echo.Context, container container.Container) *DeploymentsHandler {
	config := c.QueryParam("config")
	cluster := c.QueryParam("cluster")

	informer := container.SharedInformerFactory(config, cluster).Apps().V1().Deployments().Informer()
	informer.SetTransform(helpers.StripUnusedFields)

	handler := &DeploymentsHandler{
		BaseHandler: base.BaseHandler{
			Kind:             "Deployment",
			Container:        container,
			Informer:         informer,
			QueryConfig:      config,
			QueryCluster:     cluster,
			InformerCacheKey: fmt.Sprintf("%s-%s-deploymentInformer", config, cluster),
			Event:            event.NewEventCounter(time.Second * 1),
			TransformFunc:    transformItems,
		},
	}

	additionalEvents := []func(){
		func() {
			handler.DeploymentsPods(c)
		},
	}

	cache := base.ResourceEventHandler[*v1.Deployment](&handler.BaseHandler, additionalEvents...)
	handler.BaseHandler.StartInformer(c, cache)
	go handler.BaseHandler.Event.Run()
	handler.BaseHandler.WaitForSync(c)

	return handler
}

func transformItems(items []interface{}, b *base.BaseHandler) ([]byte, error) {
	var deploymentList []v1.Deployment

	for _, obj := range items {
		if dep, ok := obj.(*v1.Deployment); ok {
			deploymentList = append(deploymentList, *dep)
		}
	}

	t := TransformDeploymentList(deploymentList)

	return json.Marshal(t)
}

func (h *DeploymentsHandler) GetPods(c echo.Context) error {
	go func() {
		<-c.Request().Context().Done()
	}()

	h.BaseHandler.Event.AddEvent(fmt.Sprintf("%s-deployments-pods", c.Param("name")), func() {
		h.DeploymentsPods(c)
	})

	h.BaseHandler.Container.SSE().ServeHTTP(fmt.Sprintf("%s-deployments-pods", c.Param("name")), c.Response(), c.Request())
	return nil
}

// DeploymentsPods get list of pods for given deployment
func (h *DeploymentsHandler) DeploymentsPods(c echo.Context) {
	podsHandler := pods.NewPodsHandler(c, h.BaseHandler.Container)
	storeList := podsHandler.BaseHandler.Informer.GetStore().List()

	var podsList []coreV1.Pod
	for _, obj := range storeList {
		if item, ok := obj.(*coreV1.Pod); ok {
			podsList = append(podsList, *item)
		}
	}

	data, _ := json.Marshal(pods.TransformPodList(filterPodsByDeployment(podsList, c.Param("name"))))

	h.BaseHandler.Container.SSE().Publish(fmt.Sprintf("%s-deployments-pods", c.Param("name")), &sse.Event{
		Data: data,
	})
}

// filterPodsByDeployment filters the podsList that are part of the given deployment
func filterPodsByDeployment(pods []coreV1.Pod, deploymentName string) []coreV1.Pod {
	var filteredPods []coreV1.Pod

	for _, pod := range pods {
		// Check if the pod has ownerReferences
		for _, ownerRef := range pod.OwnerReferences {
			if ownerRef.Kind == "ReplicaSet" && ownerRef.Controller != nil && *ownerRef.Controller {
				// Check if the ReplicaSet is owned by the deployment
				if isOwnedByDeployment(ownerRef.Name, deploymentName) {
					filteredPods = append(filteredPods, pod)
				}
			}
		}
	}

	return filteredPods
}

// isOwnedByDeployment checks if the given ReplicaSet name is associated with the deployment
func isOwnedByDeployment(replicaSetName, deploymentName string) bool {
	return len(replicaSetName) >= len(deploymentName) && strings.HasPrefix(replicaSetName, deploymentName+"-")
}
