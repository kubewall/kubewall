import { ContainerCardProps, PodDetailsSpec, PodDetailsStatus } from "@/types";

const createContainerData = (podSpec: PodDetailsSpec, podStatus: PodDetailsStatus) => {
  const containersData: ContainerCardProps[] = [];
  podSpec.containers.forEach(({ name: containerName, image, command, terminationMessagePolicy, imagePullPolicy }) => {
    const containerStatus = podStatus.containerStatuses?.find(({ name }) => name === containerName);
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

const colorList = [
  'text-red-700',
  'text-yellow-700',
  'text-orange-700',
  'text-rose-700',
  'text-emerald-700',
  'text-amber-700',
  'text-sky-700',
  'text-green-700',
  'text-indigo-700',
  'text-teal-700',
  'text-cyan-700',
  'text-purple-700',
  'text-blue-700',
  'text-pink-700',
  'text-violet-700',
  'text-fuchsia-700',
  'text-lime-700',
  'text-stone-700',
  'text-neutral-700',
  'text-zinc-700'
];

const getColorForContainerName = (containerName: string, podSpec: PodDetailsSpec) => {
  const { containers } = podSpec;
  const index = containers.findIndex(({ name }) => name === containerName);
  return colorList[index];
};


export {
  createContainerData,
  getColorForContainerName
};