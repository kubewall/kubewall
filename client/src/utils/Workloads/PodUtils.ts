import { ContainerCardProps, PodDetailsSpec, PodDetailsStatus } from "@/types";

const createContainerData = (podSpec: PodDetailsSpec, podStatus: PodDetailsStatus, type: 'containers' | 'initContainers') => {
  const containersData: ContainerCardProps[] = [];
  podSpec[type]?.forEach(({ name: containerName, image, command, terminationMessagePolicy, imagePullPolicy }) => {
    const containerStatus = podStatus[type === 'containers'? 'containerStatuses' : 'initContainerStatuses']?.find(({ name }) => name === containerName);
    const data: ContainerCardProps = {
      name: containerName,
      image: image,
      imageId: containerStatus?.imageID ?? undefined,
      containerId: containerStatus?.containerID ?? undefined,
      command: command?.join(' ') ?? undefined,
      imagePullPolicy: imagePullPolicy,
      lastRestart: containerStatus?.lastState.terminated?.startedAt,
      ready: containerStatus?.ready,
      restartReason: containerStatus?.lastState.terminated?.reason,
      restarts: containerStatus?.restartCount,
      started: containerStatus?.started,
      terminationMessagePolicy: terminationMessagePolicy
    };
    containersData.push(data);
  });
  return containersData;
};

const CONTAINER_COLORS = [
  '#eab308',
  '#06b6d4',
  '#ef4444',
  '#3b82f6',
  '#f97316',
  '#84cc16',
  '#a855f7',
  '#22c55e',
  '#f59e0b',
  '#e879f9',
  '#a8a29e',
  '#38bdf8',
  '#f472b6',
  '#8b5cf6',
  '#10b981',
  '#fb7185',
  '#71717a',
  '#d1d5db',
];

function hexToAnsi(hex: string): string {
  const n = parseInt(hex.replace('#', ''), 16);
  const r = (n >> 16) & 0xff;
  const g = (n >> 8) & 0xff;
  const b = n & 0xff;
  return `\x1b[38;2;${r};${g};${b}m`;
}

const getContainerIndex = (containerName: string, podSpec: PodDetailsSpec) => {
  const { containers, initContainers } = podSpec;
  return [...containers, ...(initContainers || [])].findIndex(({ name }) => name === containerName);
};

const getColorForContainerName = (containerName: string, podSpec: PodDetailsSpec) => {
  const index = getContainerIndex(containerName, podSpec);
  const hex = CONTAINER_COLORS[(index >= 0 ? index : 0) % CONTAINER_COLORS.length];
  return hexToAnsi(hex);
};

const getCssColorForContainerName = (containerName: string, podSpec: PodDetailsSpec) => {
  const index = getContainerIndex(containerName, podSpec);
  return CONTAINER_COLORS[(index >= 0 ? index : 0) % CONTAINER_COLORS.length];
};

export {
  createContainerData,
  getColorForContainerName,
  getCssColorForContainerName,
};