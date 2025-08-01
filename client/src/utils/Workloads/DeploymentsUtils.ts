import { DeploymentsResponse } from "@/types";

const formatDeploymentsResponse = (deployments: DeploymentsResponse[]) => {
  return deployments.map(({namespace, name, status, spec, age, hasUpdated, uid}) => ({
    namespace:namespace,
    name: name,
    ready: `${status.readyReplicas}/${spec.replicas}`,
    desired: status.replicas,
    updated: status.updatedReplicas,
    available: status.availableReplicas,
    age: age,
    hasUpdated: hasUpdated,
    conditions: status.conditions ? status.conditions.map(({type}) => type).join(', ') : '—',
    uid: uid
  }));
};

export {
  formatDeploymentsResponse
};
