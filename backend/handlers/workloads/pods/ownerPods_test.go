package pods

import (
	"testing"

	"github.com/kubewall/kubewall/backend/handlers/base"
	"github.com/stretchr/testify/assert"
	v1 "k8s.io/api/core/v1"
	metaV1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

func testPodsHandler() *PodsHandler {
	return &PodsHandler{
		BaseHandler: base.BaseHandler{
			QueryConfig:  "cfg",
			QueryCluster: "clu",
		},
		ownerStreams: base.NewOwnerStreams(),
	}
}

func ownedPod(namespace string, owners ...metaV1.OwnerReference) *v1.Pod {
	return &v1.Pod{
		ObjectMeta: metaV1.ObjectMeta{
			Name:            "pod",
			Namespace:       namespace,
			OwnerReferences: owners,
		},
	}
}

func TestOwnerPodsStreamID(t *testing.T) {
	t.Run("namespace separates same-named workloads", func(t *testing.T) {
		staging := OwnerPodsStreamID("cfg", "clu", JobsResource, "staging", "nightly-report")
		prod := OwnerPodsStreamID("cfg", "clu", JobsResource, "prod", "nightly-report")

		assert.NotEqual(t, staging, prod)
	})

	t.Run("resource separates workloads of different kinds", func(t *testing.T) {
		job := OwnerPodsStreamID("cfg", "clu", JobsResource, "default", "shared-name")
		statefulSet := OwnerPodsStreamID("cfg", "clu", StatefulSetsResource, "default", "shared-name")

		assert.NotEqual(t, job, statefulSet)
	})
}

func TestOwnerPodsStreamIDs(t *testing.T) {
	h := testPodsHandler()

	t.Run("maps a pod onto its controller's stream", func(t *testing.T) {
		pod := ownedPod("default", metaV1.OwnerReference{Kind: "Job", Name: "backfill"})

		assert.Equal(t,
			[]string{OwnerPodsStreamID("cfg", "clu", JobsResource, "default", "backfill")},
			h.ownerPodsStreamIDs(pod),
		)
	})

	t.Run("keys on the pod's namespace, which its controller shares", func(t *testing.T) {
		pod := ownedPod("staging", metaV1.OwnerReference{Kind: "Job", Name: "backfill"})

		assert.Equal(t,
			[]string{OwnerPodsStreamID("cfg", "clu", JobsResource, "staging", "backfill")},
			h.ownerPodsStreamIDs(pod),
		)
	})

	t.Run("covers every workload kind that has a pod list", func(t *testing.T) {
		for kind, resource := range map[string]string{
			"Job":         JobsResource,
			"DaemonSet":   DaemonSetsResource,
			"StatefulSet": StatefulSetsResource,
			"ReplicaSet":  ReplicaSetsResource,
		} {
			pod := ownedPod("default", metaV1.OwnerReference{Kind: kind, Name: "owner"})

			assert.Equal(t,
				[]string{OwnerPodsStreamID("cfg", "clu", resource, "default", "owner")},
				h.ownerPodsStreamIDs(pod),
				kind,
			)
		}
	})

	t.Run("a Deployment's pods reach its ReplicaSet, not the Deployment", func(t *testing.T) {
		// A Deployment owns pods only through a ReplicaSet. The ReplicaSet stream
		// is what a ReplicaSet details view reads; DeploymentsPods separately walks
		// the extra hop up to the Deployment.
		pod := ownedPod("default", metaV1.OwnerReference{Kind: "ReplicaSet", Name: "web-7d9f"})

		assert.Equal(t,
			[]string{OwnerPodsStreamID("cfg", "clu", ReplicaSetsResource, "default", "web-7d9f")},
			h.ownerPodsStreamIDs(pod),
		)
	})

	t.Run("ignores an owner kind with no pod list of its own", func(t *testing.T) {
		pod := ownedPod("default", metaV1.OwnerReference{Kind: "Deployment", Name: "web"})

		assert.Empty(t, h.ownerPodsStreamIDs(pod))
	})

	t.Run("ignores a pod with no controller at all", func(t *testing.T) {
		assert.Empty(t, h.ownerPodsStreamIDs(ownedPod("default")))
	})
}
