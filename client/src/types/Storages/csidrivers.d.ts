import { StorageDetailsMetadata } from './common';

type CSIDriversHeaders = {
  name: string;
  attachRequired: boolean;
  podInfoOnMount: boolean;
  storageCapacity: boolean;
  modes: string;
  age: string;
};

type CSIDriversResponse = {
  hasUpdated: boolean;
} & CSIDriversHeaders;

/**
 * CSIDriver captures information about a Container Storage Interface (CSI)
 * volume driver deployed on the cluster. CSI drivers are non-namespaced.
 */
type CSIDriverDetails = {
  apiVersion?: string | null;
  kind?: 'CSIDriver';
  metadata: StorageDetailsMetadata;
  spec: {
    attachRequired?: boolean | null;
    fsGroupPolicy?: string | null;
    podInfoOnMount?: boolean | null;
    requiresRepublish?: boolean | null;
    seLinuxMount?: boolean | null;
    storageCapacity?: boolean | null;
    volumeLifecycleModes?: (string | null)[] | null;
    [k: string]: unknown;
  };
};

export {
  CSIDriversHeaders,
  CSIDriversResponse,
  CSIDriverDetails
};
