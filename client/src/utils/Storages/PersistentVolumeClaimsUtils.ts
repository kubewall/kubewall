import { PersistentVolumeClaimsResponse } from "@/types";

const formatPersistentVolumeClaimsResponse = (persistentVolumeClaims: PersistentVolumeClaimsResponse[]) => {
  return persistentVolumeClaims.map(({ namespace,age, name, spec, status, hasUpdated }) => ({
    namespace: namespace,
    name: name,
    volumeName: spec.volumeName,
    storageClassName: spec.storageClassName,
    volumeMode: spec.volumeMode,
    storage: spec.storage,
    phase: status.phase,
    age: age,
    hasUpdated: hasUpdated,
  }));
};

export {
  formatPersistentVolumeClaimsResponse
};