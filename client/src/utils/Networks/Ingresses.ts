import { IngressesResponse } from "@/types";

const formatIngressesResponse = (podDisruptionBudgets: IngressesResponse[]) => {
  return podDisruptionBudgets.map(({ age, name, namespace, spec, hasUpdated, uid }) => ({
    name: name,
    namespace: namespace,
    rules: spec.rules.join(),
    age: age,
    hasUpdated: hasUpdated,
    uid: uid
  }));
};

export {
  formatIngressesResponse
};