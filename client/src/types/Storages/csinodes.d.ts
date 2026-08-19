import { StorageDetailsMetadata } from './common';

type CSINodesHeaders = {
  name: string;
  drivers: string;
  age: string;
};

type CSINodesResponse = {
  hasUpdated: boolean;
} & CSINodesHeaders;

/**
 * CSINode holds information about all CSI drivers installed on a node. It is
 * named after, and has the same lifecycle as, the Node it describes.
 */
type CSINodeDetails = {
  apiVersion?: string | null;
  kind?: 'CSINode';
  metadata: StorageDetailsMetadata;
  spec: {
    drivers?: ({
      allocatable?: {
        count?: number | null;
      } | null;
      name: string;
      nodeID: string;
      topologyKeys?: (string | null)[] | null;
    } | null)[] | null;
    [k: string]: unknown;
  };
};

export {
  CSINodesHeaders,
  CSINodesResponse,
  CSINodeDetails
};
