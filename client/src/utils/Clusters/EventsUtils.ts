import { ClusterEventsResponse } from "@/types";

const formatClusterEvents = (clusterEvents: ClusterEventsResponse[]) => {
  return clusterEvents.map(({type, message, metadata, involvedObject, source, count, lastTimestamp}) => ({
    name: metadata.name,
    type: type,
    message: message,
    namespace: metadata.namespace,
    kind: involvedObject.kind,
    apiVersion: involvedObject.apiVersion,
    source: source.component,
    count: count,
    age: lastTimestamp,
  }));
};

export {
  formatClusterEvents
};