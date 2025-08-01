import { HelmRelease, HelmReleaseResponse } from '@/types';

export const transformHelmReleaseToResponse = (release: HelmRelease): HelmReleaseResponse => {
  return {
    age: release.updated,
    hasUpdated: false, // This would need to be calculated based on your logic
    name: release.name,
    uid: release.name, // Helm releases don't have UIDs like K8s resources
    namespace: release.namespace,
    status: release.status,
    revision: release.revision,
    updated: release.updated,
    chart: release.chart,
    version: release.version,
  };
};

export const formatHelmReleaseStatus = (status: string): string => {
  return status.charAt(0).toUpperCase() + status.slice(1).toLowerCase();
};

export const formatHelmReleaseAge = (updated: string): string => {
  const date = new Date(updated);
  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (diffInSeconds < 60) {
    return `${diffInSeconds}s`;
  } else if (diffInSeconds < 3600) {
    return `${Math.floor(diffInSeconds / 60)}m`;
  } else if (diffInSeconds < 86400) {
    return `${Math.floor(diffInSeconds / 3600)}h`;
  } else {
    return `${Math.floor(diffInSeconds / 86400)}d`;
  }
};

export const getHelmReleaseStatusColor = (status: string): string => {
  switch (status.toLowerCase()) {
    case 'deployed':
      return 'success';
    case 'failed':
      return 'destructive';
    case 'pending':
      return 'warning';
    case 'superseded':
      return 'secondary';
    case 'uninstalling':
      return 'warning';
    case 'uninstalled':
      return 'destructive';
    default:
      return 'default';
  }
}; 