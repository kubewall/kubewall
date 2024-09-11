import { PersistentVolumesResponse } from "@/types";

const formatPersistentVolumesResponse = (persistentVolumes: PersistentVolumesResponse[]) => {
  return persistentVolumes.map(({ age, name, spec, status, hasUpdated }) => ({
    name: name,
    storageClassName: spec.storageClassName,
    volumeMode: spec.volumeMode,
    claimRef: spec.claimRef,
    phase: status.phase,
    age: age,
    hasUpdated: hasUpdated,
  }));
};

export {
  formatPersistentVolumesResponse
};