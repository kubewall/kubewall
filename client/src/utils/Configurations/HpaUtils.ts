import { HPAsResponse } from "@/types";

const formatHPAResponse = (hpa: HPAsResponse[]) => {
  return hpa.map(({age, name, namespace, spec, hasUpdated}) => ({
    name: name,
    namespace: namespace,
    minPods: spec.minPods,
    maxPods: spec.maxPods,
    age: age,
    hasUpdated: hasUpdated
  }));
};

export {
  formatHPAResponse
};