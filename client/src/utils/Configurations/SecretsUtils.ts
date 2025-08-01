import { SecretsListResponse } from "@/types";

const formatSecretsResponse = (secretsBudgets: SecretsListResponse[] | undefined | null) => {
  if (!secretsBudgets || !Array.isArray(secretsBudgets)) {
    return [];
  }
  
  return secretsBudgets.map(({age, name, namespace, keys, type, uid}) => ({
    name: name,
    namespace: namespace,
    age: age,
    keys: keys === null || keys.length === 0 ? '—' : keys.join(', '),
    type,
    uid: uid
  }));
};

export {
  formatSecretsResponse
};