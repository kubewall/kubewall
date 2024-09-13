package pods

import (
	"encoding/json"
	"fmt"
	"github.com/labstack/echo/v4"
	"github.com/r3labs/sse/v2"
	v1 "k8s.io/api/core/v1"
	"strings"
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
			data, _ := json.Marshal(TransformPodList(FilterPodsByDeploymentName(pods, deploymentNameGuess[0])))
			streamID := fmt.Sprintf("%s-%s-%s-deployments-pods", h.BaseHandler.QueryConfig, h.BaseHandler.QueryCluster, deploymentNameGuess[0])
			h.BaseHandler.Container.SSE().Publish(streamID, &sse.Event{
				Data: data,
			})
		}
	}
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
