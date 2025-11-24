type PodsHeaders = {
  namespace: string;
  name: string;
  node: string;
  ready: string;
  status: string;
  cpu: string;
  memory: string;
  restarts: string;
  lastRestartAt: string;
  lastRestartReason: string;
  podIP: string;
  age: string;
};

type Pods = {
  hasUpdated: boolean;
} & PodHeaders;

type PodDetailsMetadata = {
  name: string,
  generateName: string,
  namespace: string,
  uid: string,
  resourceVersion: string,
  creationTimestamp: string,
  labels: {
    [key: string]: string,
  },
  annotations: {
    [key: string]: string,
  },
  ownerReferences: {
    apiVersion: string,
    kind: string,
    name: string,
    uid: string,
    controller: boolean,
    blockOwnerDeletion: boolean
  }[],
  finalizers?: string[],
};

type PodDetailsContainer = {
  name: string,
  image: string,
  command: [],
  resources: {
    [key: string]: string,
  },
  ports: {
    name: string,
    containerPort: number,
    protocol: string
  }[],
  volumeMounts: {
    name: string,
    readOnly: boolean,
    mountPath: string
  }[],
  terminationMessagePath: string,
  terminationMessagePolicy: string,
  imagePullPolicy: string
};

type PodDetailsSpec = {
  containers: PodDetailsContainer[],
  initContainers?: PodDetailsContainer[],
  restartPolicy: string,
  terminationGracePeriodSeconds: number,
  dnsPolicy: string,
  serviceAccountName: string,
  serviceAccount: string,
  nodeName: string,
  schedulerName: string,
  priority: number,
  enabledServiceLinks: boolean,
  preemptionPolicy: string,
};

type PodContainerStatusState = {
  exitCode?: number,
  reason?: string,
  message?: string,
  startedAt?: string | null,
  finishedAt?: string | null
};

type PodDetailsStatus = {
  phase: string,
  conditions: {
    type: string,
    status: string,
    lastProbeTime: string | null,
    lastTransitionTime: string
  }[],
  hostIP: string,
  podIP: string,
  podIPs: {
    ip: string
  }[],
  startTime: string,
  containerStatuses: {
    name: string,
    state: {
      terminated?: PodContainerStatusState,
      running?: PodContainerStatusState,
      waiting?: PodContainerStatusState
    }
    lastState: {
      terminated?: PodContainerStatusState,
      running?: PodContainerStatusState,
      waiting?: PodContainerStatusState
    },
    ready: boolean,
    restartCount: number,
    image: string,
    imageID: string,
    containerID: string,
    started: boolean
  }[],
  initContainerStatuses?: {
    name: string,
    state: {
      terminated?: PodContainerStatusState,
      running?: PodContainerStatusState,
      waiting?: PodContainerStatusState
    }
    lastState: {
      terminated?: PodContainerStatusState,
      running?: PodContainerStatusState,
      waiting?: PodContainerStatusState
    },
    ready: boolean,
    restartCount: number,
    image: string,
    imageID: string,
    containerID: string,
    started: boolean
  }[],
  qosClass: string
}

type PodDetails = {
  metadata: PodDetailsMetadata,
  spec: PodDetailsSpec,
  status: PodDetailsStatus
};

type ContainerCardProps = {
  name: string;
  image: string;
  imageId: string | undefined;
  containerId: string | undefined;
  command: string;
  imagePullPolicy: string;
  terminationMessagePolicy: string;
  restarts: number | undefined;
  lastRestart: string | null | undefined;
  restartReason: string | undefined;
  started: boolean | undefined;
  ready: boolean | undefined;
};

type PodSocketResponse = {
  containerName: string;
  timestamp: string;
  log: string;
  containerChange?: boolean;
};

export {
  ContainerCardProps,
  PodDetails,
  PodDetailsContainer,
  PodDetailsMetadata,
  PodDetailsSpec,
  PodDetailsStatus,
  Pods,
  PodsHeaders,
  PodSocketResponse,
  PortForwardingList
};
