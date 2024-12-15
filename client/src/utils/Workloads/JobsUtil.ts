import { JobsResponse } from "@/types";

const formatJobsResponse = (jobs: JobsResponse[]) => {
  return jobs.map(({age, name, namespace, status, spec, hasUpdated, uid}) => ({
    name: name,
    namespace: namespace,
    completions: `${status.succeeded}/${spec.completions}`,
    conditions: status.conditions ? status?.conditions.map(({type}) => type).toString() : '-',
    age: age,
    duration: status.startTime,
    hasUpdated: hasUpdated,
    uid: uid
  }));
};

export {
  formatJobsResponse
};