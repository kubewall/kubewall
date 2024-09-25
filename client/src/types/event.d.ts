import { ClusterDetails } from "./misc";

type Event = {
  metadata: {
    name: strin,
    namespace: string,
    uid: string,
    resourceVersion: string,
    creationTimestamp: string
  },
  involvedObject: {
    kind: string,
    namespace: string,
    name: string,
    uid: string,
    apiVersion: string,
    resourceVersion: string
  },
  reason: string,
  message: string,
  source: {
    [key: string]: string
  },
  firstTimestamp: string | null,
  lastTimestamp: string |null,
  type: string,
  eventTime: string,
  action: string,
  reportingComponent: string,
  reportingInstance: string
} & ClusterDetails;

export {
  Event
};