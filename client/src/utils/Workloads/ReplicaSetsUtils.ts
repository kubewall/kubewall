import { ReplicaSetsResponse } from "@/types";

const formatReplicaSetsResponse = (replicaSets: ReplicaSetsResponse[]) => {
  return replicaSets.map(({namespace, name, status, age, hasUpdated}) => ({
    namespace:namespace,
    name: name,
    ready: `${status.readyReplicas}/${status.replicas}`,
    available: status.availableReplicas,
    age: age,
    hasUpdated: hasUpdated,
  }));
};

export {
  formatReplicaSetsResponse
};