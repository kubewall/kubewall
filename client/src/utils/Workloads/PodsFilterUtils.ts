import { Pods } from "../../types";

const nodesFilter = (pods: Pods[]) => {
  const uniqueNodes = [...new Set(pods.map(pod => pod.node).filter(node => node && node.trim() !== ''))];
  return uniqueNodes.map(node => ({
    label: node,
    value: node
  }));
};

const statusFilter = (pods: Pods[]) => {
  const uniqueStatuses = [...new Set(pods.map(pod => pod.status).filter(status => status && status.trim() !== ''))];
  return uniqueStatuses.map(status => ({
    label: status,
    value: status
  }));
};

const qosFilter = (pods: Pods[]) => {
  const uniqueQos = [...new Set(pods.map(pod => pod.qos).filter(qos => qos && qos.trim() !== ''))];
  return uniqueQos.map(qos => ({
    label: qos,
    value: qos
  }));
};

export {
  nodesFilter,
  statusFilter,
  qosFilter
};