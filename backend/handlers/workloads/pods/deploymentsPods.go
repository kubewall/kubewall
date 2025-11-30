package pods

import (
	"encoding/json"
	"fmt"
	appV1 "k8s.io/api/apps/v1"
	"sort"

	"github.com/labstack/echo/v4"
	"github.com/r3labs/sse/v2"
	v1 "k8s.io/api/core/v1"
)

func (h *PodsHandler) DeploymentsPods(c echo.Context) {
	items := h.BaseHandler.Informer.GetStore().List()
	if len(items) == 0 {
		return
	}

	// collect all pods
	var pods []v1.Pod
	for _, obj := range items {
		if p, ok := obj.(*v1.Pod); ok {
			pods = append(pods, *p)
		}
	}
	if len(pods) == 0 {
		return
	}

	// group pods by deployment
	podsByDeployment := make(map[string][]v1.Pod, 16)
	for _, pod := range pods {
		deployment := h.FindPodDeploymentOwner(c, pod)
		if deployment == "" {
			deployment = "unknown-deployment"
		}
		podsByDeployment[deployment] = append(podsByDeployment[deployment], pod)
	}

	podsMetricsList := GetPodsMetricsList(&h.BaseHandler)

	deployments := make([]string, 0, len(podsByDeployment))
	for d := range podsByDeployment {
		deployments = append(deployments, d)
	}
	sort.Strings(deployments)

	for _, dep := range deployments {
		depPods := podsByDeployment[dep]
		transformed := TransformPodList(depPods, podsMetricsList)

		data, err := json.Marshal(transformed)
		if err != nil {
			data = []byte("{}")
		}

		streamID := fmt.Sprintf("%s-%s-%s-deployments-pods", h.BaseHandler.QueryConfig, h.BaseHandler.QueryCluster, dep)
		h.BaseHandler.Container.SSE().Publish(streamID, &sse.Event{Data: data})
	}
}

func (h *PodsHandler) FindPodDeploymentOwner(c echo.Context, pod v1.Pod) string {
	for _, owner := range pod.OwnerReferences {
		if owner.Kind == "ReplicaSet" {
			item, exists, err := h.replicasetHandler.BaseHandler.Informer.GetStore().
				GetByKey(fmt.Sprintf("%s/%s", pod.GetNamespace(), owner.Name))
			if err != nil || !exists {
				return ""
			}
			rs := item.(*appV1.ReplicaSet)
			for _, depOwner := range rs.GetOwnerReferences() {
				if depOwner.Kind == "Deployment" {
					return depOwner.Name
				}
			}
		}
	}
	return ""
}
