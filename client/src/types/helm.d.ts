export interface HelmRelease {
  name: string;
  namespace: string;
  status: string;
  revision: number;
  updated: string;
  chart: string;
  appVersion: string;
  version: string;
  description: string;
  notes: string;
  values: string;
  manifests: string;
  deployments: string[];
}

export interface HelmReleaseHistory {
  revision: number;
  updated: string;
  status: string;
  chart: string;
  appVersion: string;
  description: string;
  isLatest: boolean;
}

export interface HelmReleaseList {
  releases: HelmRelease[];
  total: number;
}

export interface HelmReleaseDetails {
  release: HelmRelease;
  history: HelmReleaseHistory[];
  values: string;
  templates: string;
  manifests: string;
}

export interface HelmReleaseResponse {
  age: string;
  hasUpdated: boolean;
  name: string;
  uid: string;
  namespace: string;
  status: string;
  revision: number;
  updated: string;
  chart: string;
  version: string;
}

export interface HelmReleaseHistoryResponse {
  revision: number;
  updated: string;
  status: string;
  chart: string;
  appVersion: string;
  description: string;
  isLatest: boolean;
} 