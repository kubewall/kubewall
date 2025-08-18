import { HelmReleaseResponse } from "@/types";

const helmReleasesStatusFilter = (helmReleases: HelmReleaseResponse[]) => {
  const uniqueStatuses = [...new Set(helmReleases.map(release => release.status).filter(status => status && status.trim() !== ''))];
  return uniqueStatuses.map(status => ({
    label: status,
    value: status
  }));
};

export {
  helmReleasesStatusFilter
};