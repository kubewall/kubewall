import { ServicesResponse } from "@/types";

const formatServicesResponse = (podDisruptionBudgets: ServicesResponse[]) => {
  return podDisruptionBudgets.map(({ age, name, namespace, spec, hasUpdated }) => ({
    name: name,
    namespace: namespace,
    ports: spec.ports,
    clusterIP: spec.clusterIP,
    type: spec.type,
    sessionAffinity: spec.sessionAffinity,
    ipFamilyPolicy: spec.ipFamilyPolicy,
    internalTrafficPolicy: spec.internalTrafficPolicy,
    age: age,
    hasUpdated: hasUpdated,
  }));
};

export {
  formatServicesResponse
};