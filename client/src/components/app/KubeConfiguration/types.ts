import { ClustersDetails } from '@/types';

// A single kubeconfig file's worth of clusters, tagged with whether it's a
// system (~/.kube) config or one the user added — used to render one flat,
// ordered list (system configs first, then added) instead of two separate
// banner sections.
export type ConfigGroup = {
  configKey: string;
  details: ClustersDetails;
  isSystem: boolean;
};

export const clusterCountLabel = (count: number) => `${count} cluster${count === 1 ? '' : 's'}`;
export const configCountLabel = (count: number) => `${count} config${count === 1 ? '' : 's'}`;
