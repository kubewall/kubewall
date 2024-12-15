import { PodDisruptionBudgetsResponse } from "@/types";

const formatPodDisruptionBudgetsResponse = (podDisruptionBudgets: PodDisruptionBudgetsResponse[]) => {
  return podDisruptionBudgets.map(({age, name, namespace, spec, status, hasUpdated, uid}) => ({
    name: name,
    namespace: namespace,
    minAvailable: spec.minAvailable,
    maxUnavailable: spec.maxUnavailable,
    currentHealthy: status.currentHealthy,
    age: age,
    hasUpdated: hasUpdated,
    uid: uid
  }));
};

export {
  formatPodDisruptionBudgetsResponse
};