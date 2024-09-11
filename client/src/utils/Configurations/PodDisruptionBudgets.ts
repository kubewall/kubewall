import { PodDisruptionBudgetsResponse } from "@/types";

const formatPodDisruptionBudgetsResponse = (podDisruptionBudgets: PodDisruptionBudgetsResponse[]) => {
  return podDisruptionBudgets.map(({age, name, namespace, spec, status, hasUpdated}) => ({
    name: name,
    namespace: namespace,
    minAvailable: spec.minAvailable,
    maxUnavailable: spec.maxUnavailable,
    currentHealthy: status.currentHealthy,
    age: age,
    hasUpdated: hasUpdated
  }));
};

export {
  formatPodDisruptionBudgetsResponse
};