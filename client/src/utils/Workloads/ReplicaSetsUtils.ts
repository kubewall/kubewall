import { ReplicaSetsResponse } from "@/types";

const formatReplicaSetsResponse = (replicaSets: ReplicaSetsResponse[]) => {
  return replicaSets.map(({namespace, name, status, age, hasUpdated, uid}) => ({
    namespace:namespace,
    name: name,
    ready: `${status.readyReplicas}/${status.replicas}`,
    available: status.availableReplicas,
    age: age,
    hasUpdated: hasUpdated,
    uid: uid
  }));
};

export {
  formatReplicaSetsResponse
};