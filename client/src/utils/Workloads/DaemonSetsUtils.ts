import { DaemonSetsResponse } from "@/types";

const formatDaemonSetsResponse = (daemonsets: DaemonSetsResponse[]) => {
  return daemonsets.map(({namespace, name, status, age, nodeSelector, hasUpdated}) => ({
    namespace:namespace,
    name: name,
    current: `${status.currentNumberScheduled}/${status.desiredNumberScheduled}`,
    ready: `${status.numberReady}/${status.desiredNumberScheduled}`,
    updated: status.updatedNumberScheduled,
    available: status.numberAvailable,
    nodeSelector: nodeSelector,
    age: age,
    hasUpdated: hasUpdated,
  }));
};

export {
  formatDaemonSetsResponse
};
