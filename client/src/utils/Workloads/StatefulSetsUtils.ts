import { StatefulSetsResponse } from "@/types";

const formatStatefulSetsResponse = (statefulSets: StatefulSetsResponse[]) => {
  return statefulSets.map(({namespace, name, status, age, hasUpdated, uid}) => ({
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
  formatStatefulSetsResponse
};