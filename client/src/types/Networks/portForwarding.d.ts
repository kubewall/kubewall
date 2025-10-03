type PortForwardingListHeaders = {
  id: string;
  namespace: string;
  name: string;
  kind: string;
  pod: string;
  localPort: number;
  containerPort: number;
};

type PortForwardingListResponse = {
  id: string;
  namespace: string;
  pod: string;
  kind: "Pod" | "Service";
  name: string;
  localPort: number;
  containerPort: number;
}

export {
  PortForwardingListHeaders,
  PortForwardingListResponse
}
