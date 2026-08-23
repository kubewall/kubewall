/**
 * The slice of ObjectMeta the storage details cards actually read. The older
 * generated types in this folder each carry a full copy of ObjectMeta; nothing
 * on these pages needs the rest of it.
 */
type StorageDetailsMetadata = {
  annotations?: {
    [k: string]: string | null;
  } | null;
  creationTimestamp?: string | null;
  deletionGracePeriodSeconds?: number | null;
  deletionTimestamp?: string | null;
  generateName?: string | null;
  generation?: number | null;
  labels?: {
    [k: string]: string | null;
  } | null;
  name?: string | null;
  resourceVersion?: string | null;
  uid?: string | null;
};

export {
  StorageDetailsMetadata
};
