import { ClusterRoleBindingsResponse } from "@/types";

const formatClusterRoleBindingsResponse = (serviceAccounts: ClusterRoleBindingsResponse[]) => {
  return serviceAccounts.map(({age, name, namespace, subjects, hasUpdated}) => ({
    name: name,
    namespace: namespace ? namespace: '',
    bindings: subjects.bindings === null ? '—' : subjects.bindings.toString().replace(',', ', '),
    age: age,
    hasUpdated: hasUpdated
  }));
};

export {
  formatClusterRoleBindingsResponse
};