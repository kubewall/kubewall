import { DaemonSetsResponse } from "@/types";

const formatDaemonSetsResponse = (daemonsets: DaemonSetsResponse[]) => {
  return daemonsets.map(({namespace, name, status, age, hasUpdated, uid}) => ({
    namespace:namespace,
    name: name,
    current: `${status.currentNumberScheduled}/${status.desiredNumberScheduled}`,
    ready: `${status.numberReady}/${status.desiredNumberScheduled}`,
    updated: status.updatedNumberScheduled,
    available: status.numberAvailable,
    age: age,
    hasUpdated: hasUpdated,
    uid: uid
  }));
};

export {
  formatDaemonSetsResponse
};
