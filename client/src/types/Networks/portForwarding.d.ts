type PortForwardingListHeaders = {
  id: string;
  namespace: string;
  pod: string;
  localPort: number;
  containerPort: number;
  containerName: string;
};

type PortForwardingListResponse = {
  id: string;
  namespace: string;
  pod: string;
  localPort: number;
  containerPort: number;
  containerName: string;
}

export {
  PortForwardingListHeaders,
  PortForwardingListResponse
}
