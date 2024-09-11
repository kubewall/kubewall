import { IngressesResponse } from "@/types";

const formatIngressesResponse = (podDisruptionBudgets: IngressesResponse[]) => {
  return podDisruptionBudgets.map(({ age, name, namespace, spec, hasUpdated }) => ({
    name: name,
    namespace: namespace,
    rules: spec.rules.join(),
    age: age,
    hasUpdated: hasUpdated,
  }));
};

export {
  formatIngressesResponse
};