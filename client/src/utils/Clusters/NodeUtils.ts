import { NodeListResponse } from "@/types";

const formatNodeList = (nodes: NodeListResponse[]) => {
  return nodes.map(({age ,name, resourceVersion, roles, status: {nodeInfo, conditionStatus} }) => ({
    age: age,
    resourceVersion: resourceVersion,
    name: name,
    roles: roles.toString(),
    conditionStatus: conditionStatus,
    architecture: nodeInfo.architecture,
    bootID: nodeInfo.bootID,
    containerRuntimeVersion: nodeInfo.containerRuntimeVersion,
    kernelVersion: nodeInfo.kernelVersion,
    kubeProxyVersion: nodeInfo.kubeProxyVersion,
    kubeletVersion: nodeInfo.kubeletVersion,
    machineID: nodeInfo.machineID,
    operatingSystem: nodeInfo.operatingSystem,
    osImage: nodeInfo.osImage,
    systemUUID: nodeInfo.systemUUID
  }));
};

export {
  formatNodeList
};
