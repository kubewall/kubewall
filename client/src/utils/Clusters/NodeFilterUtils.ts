import { NodeList } from "@/types";

const nodeArchitectureFilter = (nodes: NodeList[]) => {
  const uniqueArchitectures = [...new Set(nodes.map(node => node.architecture).filter(architecture => architecture && architecture.trim() !== ''))];
  return uniqueArchitectures.map(architecture => ({
    label: architecture,
    value: architecture
  }));
};

const nodeConditionFilter = (nodes: NodeList[]) => {
  const uniqueConditions = [...new Set(nodes.map(node => node.conditionStatus).filter(condition => condition && condition.trim() !== ''))];
  return uniqueConditions.map(condition => ({
    label: condition,
    value: condition
  }));
};

const nodeOperatingSystemFilter = (nodes: NodeList[]) => {
  const uniqueOperatingSystems = [...new Set(nodes.map(node => node.operatingSystem).filter(os => os && os.trim() !== ''))];
  return uniqueOperatingSystems.map(os => ({
    label: os,
    value: os
  }));
};

export {
  nodeArchitectureFilter,
  nodeConditionFilter,
  nodeOperatingSystemFilter
};