import { ServicesResponse } from "@/types";

const formatServicesResponse = (podDisruptionBudgets: ServicesResponse[]) => {
  return podDisruptionBudgets.map(({ age, name, namespace, spec, hasUpdated, uid }) => ({
    name: name,
    namespace: namespace,
    ports: spec.ports,
    clusterIP: spec.clusterIP,
    externalIP: spec.extenalIPs,
    type: spec.type,
    sessionAffinity: spec.sessionAffinity,
    ipFamilyPolicy: spec.ipFamilyPolicy,
    internalTrafficPolicy: spec.internalTrafficPolicy,
    age: age,
    hasUpdated: hasUpdated,
    uid: uid
  }));
};

export {
  formatServicesResponse
};