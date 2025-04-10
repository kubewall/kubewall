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

const ansiColors = [
  '\x1b[33m',        // Yellow (Bright and warm)
  '\x1b[36m',        // Cyan (Cool and bright)
  '\x1b[31m',        // Red (Warm and vibrant)
  '\x1b[34m',        // Blue (Cool and contrasting
  '\x1b[38;5;208m',  // Orange (Warm but softer than red)
  '\x1b[38;5;118m',  // Lime (Bright and light green)
  '\x1b[35m',        // Purple (Cool and distinct from green)
  '\x1b[32m',        // Green (Cool and calming)
  '\x1b[38;5;214m',  // Amber (Bright warm tone)
  '\x1b[38;5;13m',   // Fuchsia (Vivid and distinct)
  '\x1b[38;5;245m',  // Stone (Neutral gray, darker tone)
  '\x1b[38;5;33m',   // Sky Blue (Cool and lighter blue)
  '\x1b[38;5;200m',  // Pink (Bright and soft)
  '\x1b[38;5;99m',   // Violet (Dark purple, cool tone)
  '\x1b[38;5;34m',   // Emerald (Rich green, darker tone)
  '\x1b[38;5;203m',  // Rose (Soft and warm)
  '\x1b[38;5;242m',  // Zinc (Neutral gray, contrasting with vibrant tones)
  '\x1b[38;5;245m',  // Stone (Reinforced neutral tone)
  '\x1b[38;5;214m',  // Amber (Warm and distinct from neutrals)
  '\x1b[37m',        // Neutral White (Bright and contrasting)
];

const getColorForContainerName = (containerName: string, podSpec: PodDetailsSpec) => {
  const { containers } = podSpec;
  const index = containers.findIndex(({ name }) => name === containerName);
  return ansiColors[index];
};


export {
  createContainerData,
  getColorForContainerName
};