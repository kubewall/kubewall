package jobs

import (
	"encoding/json"
	"fmt"
	"sort"

	"github.com/r3labs/sse/v2"
	batchV1 "k8s.io/api/batch/v1"
)

// CronJobsResource is the route segment a CronJob details view subscribes under,
// and the resource segment of the stream ID below.
const CronJobsResource = "cronjobs"

// CronJobJobsStreamID keys the job stream of a single CronJob. As with the
// per-workload pod streams the namespace is part of the key, so the same CronJob
// deployed to several namespaces gets a stream per namespace.
func CronJobJobsStreamID(config, cluster, namespace, name string) string {
	return fmt.Sprintf("%s-%s-%s-%s-%s-jobs", config, cluster, CronJobsResource, namespace, name)
}

// CronJobJobs publishes the job list of every CronJob that owns one, in a single
// pass over the informer store.
func (h *JobsHandler) CronJobJobs() {
	defer h.ownerStreams.Begin()()

	jobsByCronJob := make(map[string][]batchV1.Job)
	for _, obj := range h.BaseHandler.Informer.GetStore().List() {
		job, ok := obj.(*batchV1.Job)
		if !ok {
			continue
		}
		if streamID, owned := h.cronJobJobsStreamID(job); owned {
			jobsByCronJob[streamID] = append(jobsByCronJob[streamID], *job)
		}
	}

	streamIDs := make([]string, 0, len(jobsByCronJob))
	for streamID := range jobsByCronJob {
		streamIDs = append(streamIDs, streamID)
	}
	sort.Strings(streamIDs)

	for _, streamID := range streamIDs {
		h.publishJobs(streamID, jobsByCronJob[streamID])
	}

	for _, streamID := range h.ownerStreams.Diff(streamIDs) {
		h.BaseHandler.Container.SSE().Publish(streamID, &sse.Event{Data: []byte("[]")})
	}
}

// PublishCronJobJobs pushes one CronJob's jobs on demand, for a details view that
// has just subscribed. It publishes even when the CronJob has spawned none yet,
// so the view resolves to an empty table rather than to skeleton rows.
func (h *JobsHandler) PublishCronJobJobs(namespace, name string) {
	streamID := CronJobJobsStreamID(h.BaseHandler.QueryConfig, h.BaseHandler.QueryCluster, namespace, name)

	owned := make([]batchV1.Job, 0)
	for _, obj := range h.BaseHandler.Informer.GetStore().List() {
		job, ok := obj.(*batchV1.Job)
		if !ok || job.GetNamespace() != namespace {
			continue
		}
		if id, isOwned := h.cronJobJobsStreamID(job); isOwned && id == streamID {
			owned = append(owned, *job)
		}
	}

	h.publishJobs(streamID, owned)
}

// cronJobJobsStreamID returns the stream a job belongs on. A Job has at most one
// CronJob owner, so unlike a pod it maps to a single stream or to none.
func (h *JobsHandler) cronJobJobsStreamID(job *batchV1.Job) (string, bool) {
	for _, owner := range job.GetOwnerReferences() {
		if owner.Kind != "CronJob" {
			continue
		}
		return CronJobJobsStreamID(
			h.BaseHandler.QueryConfig,
			h.BaseHandler.QueryCluster,
			job.GetNamespace(),
			owner.Name,
		), true
	}
	return "", false
}

func (h *JobsHandler) publishJobs(streamID string, owned []batchV1.Job) {
	data, err := json.Marshal(TransformJobsList(owned))
	if err != nil {
		data = []byte("[]")
	}
	h.BaseHandler.Container.SSE().Publish(streamID, &sse.Event{Data: data})
}
