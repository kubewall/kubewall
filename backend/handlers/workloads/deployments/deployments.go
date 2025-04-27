package deployments

import (
	"encoding/json"
	"fmt"
	"net/http"

	"github.com/kubewall/kubewall/backend/container"
	"github.com/kubewall/kubewall/backend/handlers/base"
	"github.com/kubewall/kubewall/backend/handlers/helpers"
	"github.com/kubewall/kubewall/backend/handlers/workloads/pods"
	"github.com/labstack/echo/v4"
	v1 "k8s.io/api/apps/v1"
	autoscalingv1 "k8s.io/api/autoscaling/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

const (
	GetPods     = 12
	UpdateScale = 13
)

type DeploymentsHandler struct {
	BaseHandler base.BaseHandler
}
type DeploymentReplicas struct {
	Replicas int32 `json:"replicas"`
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
		case base.Delete:
			return handler.BaseHandler.Delete(c)
		case GetPods:
			return handler.GetPods(c)
		case UpdateScale:
			return handler.UpdateScale(c)
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
			RestClient:       container.ClientSet(config, cluster).AppsV1().RESTClient(),
			QueryConfig:      config,
			QueryCluster:     cluster,
			InformerCacheKey: fmt.Sprintf("%s-%s-deploymentInformer", config, cluster),
			TransformFunc:    transformItems,
		},
	}

	cache := base.ResourceEventHandler[*v1.Deployment](&handler.BaseHandler)
	handler.BaseHandler.StartInformer(c, cache)
	handler.BaseHandler.WaitForSync(c)

	return handler
}

func transformItems(items []any, b *base.BaseHandler) ([]byte, error) {
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
	streamID := fmt.Sprintf("%s-%s-%s-deployments-pods", h.BaseHandler.QueryConfig, h.BaseHandler.QueryCluster, c.Param("name"))
	go h.DeploymentsPods(c)
	h.BaseHandler.Container.SSE().ServeHTTP(streamID, c.Response(), c.Request())
	return nil
}

// DeploymentsPods get list of pods for given deployment
func (h *DeploymentsHandler) DeploymentsPods(c echo.Context) {
	podsHandler := pods.NewPodsHandler(c, h.BaseHandler.Container)
	podsHandler.DeploymentsPods(c)
}

// UpdateScale updates the scale of a deployment
func (h *DeploymentsHandler) UpdateScale(c echo.Context) error {
	r := new(DeploymentReplicas)
	if err := c.Bind(r); err != nil {
		return err
	}
	if r.Replicas < 0 {
		return fmt.Errorf("replicas, must be greater than or equal to 0")
	}

	scale := &autoscalingv1.Scale{
		ObjectMeta: metav1.ObjectMeta{
			Name:      c.Param("name"),
			Namespace: c.QueryParam("namespace"),
		},
		Spec: autoscalingv1.ScaleSpec{
			Replicas: r.Replicas,
		},
	}

	_, err := h.BaseHandler.Container.ClientSet(c.QueryParam("config"), c.QueryParam("cluster")).
		AppsV1().
		Deployments(c.QueryParam("namespace")).
		UpdateScale(c.Request().Context(), c.Param("name"), scale, metav1.UpdateOptions{})

	if err != nil {
		return err
	}

	return c.NoContent(http.StatusOK)
}
