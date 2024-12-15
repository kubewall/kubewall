import { ServiceAccountsResponse } from "@/types";

const formatServiceAccountsResponse = (serviceAccounts: ServiceAccountsResponse[]) => {
  return serviceAccounts.map(({age, name, namespace, spec, hasUpdated, uid}) => ({
    name: name,
    namespace: namespace,
    secrets: spec.secrets,
    age: age,
    hasUpdated: hasUpdated,
    uid: uid
  }));
};

export {
  formatServiceAccountsResponse
};