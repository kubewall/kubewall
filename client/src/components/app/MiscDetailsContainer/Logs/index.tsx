import './index.css';

import { PodLogsViewer } from "./PodLogsViewer";

type PodLogsProps = {
  namespace: string;
  name: string;
  configName: string;
  clusterName: string;
}

const PodLogs = ({ namespace, name, configName, clusterName }: PodLogsProps) => {
  return (
    <PodLogsViewer
      podName={name}
      namespace={namespace}
      configName={configName}
      clusterName={clusterName}
      className="h-full"
    />
  );
};

export {
  PodLogs
};