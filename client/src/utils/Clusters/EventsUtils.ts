import { ClusterEventsResponse } from "@/types";

const formatClusterEvents = (clusterEvents: ClusterEventsResponse[]) => {
  return clusterEvents.map(({type, message, metadata, involvedObject, source, count, uid}) => ({
    name: metadata.name,
    type: type,
    message: message,
    namespace: metadata.namespace,
    kind: involvedObject.kind,
    apiVersion: involvedObject.apiVersion,
    source: source.component,
    count: count,
    age: metadata.creationTimestamp,
    uid: uid
  }));
};

export {
  formatClusterEvents
};