package pods

import (
	"encoding/json"
	"fmt"
	appV1 "k8s.io/api/apps/v1"
	"strings"

	"github.com/labstack/echo/v4"
	"github.com/r3labs/sse/v2"
	v1 "k8s.io/api/core/v1"
)

func (h *PodsHandler) DeploymentsPods(c echo.Context) {
	items := h.BaseHandler.Informer.GetStore().List()

	var pods []v1.Pod
	for _, obj := range items {
		if item, ok := obj.(*v1.Pod); ok {
			pods = append(pods, *item)
		}
	}

	for _, pod := range pods {
		deploymentNameGuess := strings.Split(pod.GenerateName, "-")
		if len(deploymentNameGuess) > 1 {
			guessName := h.FindPodDeploymentOwner(c, pod)
			filteredPods := FilterPodsByDeploymentName(pods, guessName)
			podsMetricsList := GetPodsMetricsList(&h.BaseHandler)
			transformedPods := TransformPodList(filteredPods, podsMetricsList)

			data, err := json.Marshal(transformedPods)
			if err != nil {
				data = []byte("{}")
			}
			streamID := fmt.Sprintf("%s-%s-%s-deployments-pods", h.BaseHandler.QueryConfig, h.BaseHandler.QueryCluster, guessName)
			h.BaseHandler.Container.SSE().Publish(streamID, &sse.Event{
				Data: data,
			})
		}
	}
}

func (h *PodsHandler) FindPodDeploymentOwner(c echo.Context, pod v1.Pod) string {
	// Get the deployment name from the pod's owner references
	for _, owner := range pod.OwnerReferences {
		if owner.Kind == "ReplicaSet" {
			item, exists, err := h.replicasetHandler.BaseHandler.Informer.GetStore().GetByKey(fmt.Sprintf("%s/%s", pod.GetNamespace(), owner.Name))
			if err != nil || exists == false {
				return ""
			}
			rs := item.(*appV1.ReplicaSet)
			if len(rs.GetOwnerReferences()) > 0 {
				for _, depOwner := range rs.GetOwnerReferences() {
					if depOwner.Kind == "Deployment" {
						return depOwner.Name
					}
				}
			}
		}
	}
	return ""
}

func FilterPodsByDeploymentName(pods []v1.Pod, deploymentName string) []v1.Pod {
	filteredPods := make([]v1.Pod, 0)
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
