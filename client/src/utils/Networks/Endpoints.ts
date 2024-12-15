import { EndpointsResponse } from "@/types";

const formatEndpointsResponse = (podDisruptionBudgets: EndpointsResponse[]) => {
  return podDisruptionBudgets.map(({ age, name, namespace, subsets, hasUpdated, uid }) => ({
    name: name,
    namespace: namespace,
    addresses: subsets.addresses === null ? '—' : subsets.addresses.toString(),
    ports: subsets.ports === null ? '—' : subsets.ports.toString(),
    age: age,
    hasUpdated: hasUpdated,
    uid: uid
  }));
};

export {
  formatEndpointsResponse
};