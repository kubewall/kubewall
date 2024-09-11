type LeasesListHeader = {
  namespace: string;
  name: string;
  holderIdentity: string;
  leaseDurationSeconds: number;
  age: string;
  hasUpdated: boolean;
};

type LeasesReponse = {
  hasUpdated: boolean;
} & LeasesListHeader

export {
  LeasesListHeader,
  LeasesReponse
};