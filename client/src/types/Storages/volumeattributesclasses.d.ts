import { StorageDetailsMetadata } from './common';

type VolumeAttributesClassesHeaders = {
  name: string;
  driverName: string;
  age: string;
};

type VolumeAttributesClassesResponse = {
  hasUpdated: boolean;
} & VolumeAttributesClassesHeaders;

/**
 * VolumeAttributesClass represents a specification of mutable volume
 * attributes defined by the CSI driver. VolumeAttributesClasses are
 * non-namespaced.
 */
type VolumeAttributesClassDetails = {
  apiVersion?: string | null;
  kind?: 'VolumeAttributesClass';
  driverName: string;
  metadata: StorageDetailsMetadata;
  parameters?: {
    [k: string]: string | null;
  } | null;
};

export {
  VolumeAttributesClassesHeaders,
  VolumeAttributesClassesResponse,
  VolumeAttributesClassDetails
};
