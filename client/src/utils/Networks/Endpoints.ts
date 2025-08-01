import { EndpointsResponse } from "@/types";

const formatEndpointsResponse = (podDisruptionBudgets: EndpointsResponse[]) => {
  return podDisruptionBudgets.map(({ age, name, namespace, subsets, hasUpdated, uid }) => ({
    name: name,
    namespace: namespace,
    addresses: subsets.addresses === null ? '—' : subsets.addresses.join(', '),
    ports: subsets.ports === null ? '—' : subsets.ports.join(', '),
    age: age,
    hasUpdated: hasUpdated,
    uid: uid
  }));
};

export {
  formatEndpointsResponse
};