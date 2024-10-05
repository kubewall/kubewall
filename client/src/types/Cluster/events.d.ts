type ClusterEventsResponse = {
  count: number;
  firstTimestamp: string;
  hasUpdated: boolean;
  involvedObject: {
      apiVersion: string;
      fieldPath: string;
      kind: string;
      name: string;
      namespace: string;
      resourceVersion: number;
      uid: string
  };
  kind: string;
  lastTimestamp: string;
  message: string;
  metadata: {
      creationTimestamp:string;
      name: string;
      namespace: string;
      resourceVersion: number;
      uid: string
  };
  reason: string;
  reportingComponent: string;
  reportingInstance: string;
  source: {
      component: string;
      host: string
  };
  type: string
}

type ClusterEventsHeaders = {
  name: string;
  type: string;
  message: string;
  namespace: string;
  kind: string;
  apiVersion: string;
  source: string;
  count: number;
  age: string;
}

export {
  ClusterEventsHeaders,
  ClusterEventsResponse
};
