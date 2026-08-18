package jobs

import (
	"testing"

	"github.com/kubewall/kubewall/backend/handlers/base"
	"github.com/stretchr/testify/assert"
	batchV1 "k8s.io/api/batch/v1"
	metaV1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

func testJobsHandler() *JobsHandler {
	return &JobsHandler{
		BaseHandler: base.BaseHandler{
			QueryConfig:  "cfg",
			QueryCluster: "clu",
		},
		ownerStreams: base.NewOwnerStreams(),
	}
}

func ownedJob(namespace string, owners ...metaV1.OwnerReference) *batchV1.Job {
	return &batchV1.Job{
		ObjectMeta: metaV1.ObjectMeta{
			Name:            "job",
			Namespace:       namespace,
			OwnerReferences: owners,
		},
	}
}

func TestCronJobJobsStreamID(t *testing.T) {
	t.Run("namespace separates same-named cronjobs", func(t *testing.T) {
		staging := CronJobJobsStreamID("cfg", "clu", "staging", "nightly")
		prod := CronJobJobsStreamID("cfg", "clu", "prod", "nightly")

		assert.NotEqual(t, staging, prod)
	})
}

func TestCronJobJobsStreamIDForJob(t *testing.T) {
	h := testJobsHandler()

	t.Run("maps a job onto its cronjob's stream", func(t *testing.T) {
		job := ownedJob("default", metaV1.OwnerReference{Kind: "CronJob", Name: "nightly"})

		streamID, owned := h.cronJobJobsStreamID(job)

		assert.True(t, owned)
		assert.Equal(t, CronJobJobsStreamID("cfg", "clu", "default", "nightly"), streamID)
	})

	t.Run("skips owner kinds other than CronJob", func(t *testing.T) {
		job := ownedJob("default", metaV1.OwnerReference{Kind: "Workflow", Name: "pipeline"})

		_, owned := h.cronJobJobsStreamID(job)

		assert.False(t, owned)
	})

	t.Run("skips a standalone job", func(t *testing.T) {
		_, owned := h.cronJobJobsStreamID(ownedJob("default"))

		assert.False(t, owned)
	})
}
