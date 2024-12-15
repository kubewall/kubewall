import { SecretsListResponse } from "@/types";

const formatSecretsResponse = (secretsBudgets: SecretsListResponse[]) => {
  return secretsBudgets.map(({age, name, namespace, keys, type, uid}) => ({
    name: name,
    namespace: namespace,
    age: age,
    keys: keys.toString(),
    type,
    uid: uid
  }));
};

export {
  formatSecretsResponse
};