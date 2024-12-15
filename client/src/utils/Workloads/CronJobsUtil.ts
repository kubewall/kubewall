import { CronJobsResponse } from "@/types";

const formatCronJobsResponse = (cronJobs: CronJobsResponse[]) => {
  return cronJobs.map(({age, name, namespace, spec, status, hasUpdated, uid}) => ({
    name: name,
    namespace: namespace,
    schedule: spec.schedule,
    activeJobs: status.active,
    lastSchedule: status.lastScheduleTime ?? '-',
    suspend: spec.suspend,
    age: age,
    hasUpdated: hasUpdated,
    uid: uid
  }));
};

export {
  formatCronJobsResponse
};