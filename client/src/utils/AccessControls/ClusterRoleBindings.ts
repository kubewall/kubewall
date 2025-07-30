import { ClusterRoleBindingsResponse } from "@/types";

const formatClusterRoleBindingsResponse = (serviceAccounts: ClusterRoleBindingsResponse[]) => {
  return serviceAccounts.map(({age, name, namespace, subjects, hasUpdated, uid}) => ({
    name: name,
    namespace: namespace ? namespace: '',
    bindings: subjects.bindings === null ? '—' : subjects.bindings.join(', '),
    age: age,
    hasUpdated: hasUpdated,
    uid: uid
  }));
};

export {
  formatClusterRoleBindingsResponse
};