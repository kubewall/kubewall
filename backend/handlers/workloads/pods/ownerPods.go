package pods

import (
	"encoding/json"
	"fmt"
	"slices"
	"sort"

	"github.com/kubewall/kubewall/backend/container"
	"github.com/labstack/echo/v4"
	"github.com/r3labs/sse/v2"
	v1 "k8s.io/api/core/v1"
	"k8s.io/metrics/pkg/apis/metrics/v1beta1"
)

// Route segments of the workloads whose details view carries a pod list. They
// double as the resource segment of the stream ID, so a view subscribing to
// api/v1/<resource>/<name>/pods and the publisher below agree on the key.
const (
	JobsResource         = "jobs"
	DaemonSetsResource   = "daemonsets"
	StatefulSetsResource = "statefulsets"
	ReplicaSetsResource  = "replicasets"
)

// podOwnerResources maps the owner kinds that appear directly on a pod's owner
// references onto the resource their details view is served under.
//
// ReplicaSet is here as well as in DeploymentsPods, and the two do not overlap:
// this keys on the ReplicaSet itself, which is what a ReplicaSet details view
// asks for, while DeploymentsPods walks one further up to the Deployment.
var podOwnerResources = map[string]string{
	"Job":         JobsResource,
	"DaemonSet":   DaemonSetsResource,
	"StatefulSet": StatefulSetsResource,
	"ReplicaSet":  ReplicaSetsResource,
}

// OwnerPodsStreamID keys the pod stream of a single namespaced workload. Unlike
// the node and deployment pod streams the namespace is part of the key: workloads
// sharing a name across namespaces are routine - a CronJob rolled out to several
// namespaces spawns identically named Jobs in each - and must not share a stream.
func OwnerPodsStreamID(config, cluster, resource, namespace, name string) string {
	return fmt.Sprintf("%s-%s-%s-%s-%s-pods", config, cluster, resource, namespace, name)
}

// NewOwnerPodsRouteHandler serves api/v1/<resource>/:name/pods for a workload
// whose pods this package publishes. The route lives here rather than on each
// workload's own handler because pods is what owns these streams, and because
// pods already imports replicaset to walk pod -> ReplicaSet -> Deployment, so a
// ReplicaSet handler could not import it back.
func NewOwnerPodsRouteHandler(container container.Container, resource string) echo.HandlerFunc {
	return func(c echo.Context) error {
		handler := NewPodsHandler(c.Request().Context(), c.QueryParam("config"), c.QueryParam("cluster"), container)
		return handler.ServeOwnerPods(c, resource)
	}
}

// ServeOwnerPods streams one workload's pods to a details view, on the same
// stream OwnerPods publishes to.
func (h *PodsHandler) ServeOwnerPods(c echo.Context, resource string) error {
	namespace := c.QueryParam("namespace")
	name := c.Param("name")

	streamID := OwnerPodsStreamID(h.BaseHandler.QueryConfig, h.BaseHandler.QueryCluster, resource, namespace, name)
	// Register before publishing; see BaseHandler.GetList.
	h.BaseHandler.Container.SSE().CreateStream(streamID)
	go h.PublishOwnerPods(resource, namespace, name)
	h.BaseHandler.Container.SSE().ServeHTTP(streamID, c.Response(), c.Request())

	return nil
}

// OwnerPods publishes the pod list of every Job, DaemonSet, StatefulSet and
// ReplicaSet that owns one, in a single pass over the informer store.
func (h *PodsHandler) OwnerPods() {
	defer h.ownerStreams.Begin()()

	podsByOwner := make(map[string][]v1.Pod)
	for _, obj := range h.BaseHandler.Informer.GetStore().List() {
		pod, ok := obj.(*v1.Pod)
		if !ok {
			continue
		}
		for _, streamID := range h.ownerPodsStreamIDs(pod) {
			podsByOwner[streamID] = append(podsByOwner[streamID], *pod)
		}
	}

	streamIDs := make([]string, 0, len(podsByOwner))
	for streamID := range podsByOwner {
		streamIDs = append(streamIDs, streamID)
	}
	sort.Strings(streamIDs)

	if len(streamIDs) > 0 {
		podsMetricsList := GetPodsMetricsList(&h.BaseHandler)
		for _, streamID := range streamIDs {
			h.publishPods(streamID, podsByOwner[streamID], podsMetricsList)
		}
	}

	for _, streamID := range h.ownerStreams.Diff(streamIDs) {
		h.BaseHandler.Container.SSE().Publish(streamID, &sse.Event{Data: []byte("[]")})
	}
}

// PublishOwnerPods pushes one workload's pods on demand, for a details view that
// has just subscribed. It publishes even when the workload owns none - a
// suspended Job, or one whose pods its TTL already reaped - so the view resolves
// to an empty table instead of showing skeleton rows until some unrelated pod
// event happens to trigger a full pass.
func (h *PodsHandler) PublishOwnerPods(resource, namespace, name string) {
	streamID := OwnerPodsStreamID(h.BaseHandler.QueryConfig, h.BaseHandler.QueryCluster, resource, namespace, name)

	owned := make([]v1.Pod, 0)
	for _, obj := range h.BaseHandler.Informer.GetStore().List() {
		pod, ok := obj.(*v1.Pod)
		if !ok || pod.GetNamespace() != namespace {
			continue
		}
		if slices.Contains(h.ownerPodsStreamIDs(pod), streamID) {
			owned = append(owned, *pod)
		}
	}

	h.publishPods(streamID, owned, GetPodsMetricsList(&h.BaseHandler))
}

// ownerPodsStreamIDs returns the streams a pod belongs on - one per tracked
// controller in its owner references.
func (h *PodsHandler) ownerPodsStreamIDs(pod *v1.Pod) []string {
	var streamIDs []string
	for _, owner := range pod.GetOwnerReferences() {
		resource, tracked := podOwnerResources[owner.Kind]
		if !tracked {
			continue
		}
		streamIDs = append(streamIDs, OwnerPodsStreamID(
			h.BaseHandler.QueryConfig,
			h.BaseHandler.QueryCluster,
			resource,
			pod.GetNamespace(),
			owner.Name,
		))
	}
	return streamIDs
}

func (h *PodsHandler) publishPods(streamID string, owned []v1.Pod, podsMetricsList *v1beta1.PodMetricsList) {
	data, err := json.Marshal(TransformPodList(owned, podsMetricsList))
	if err != nil {
		data = []byte("[]")
	}
	h.BaseHandler.Container.SSE().Publish(streamID, &sse.Event{Data: data})
}
