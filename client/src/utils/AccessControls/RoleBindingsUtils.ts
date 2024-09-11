import { RoleBindingsResponse } from "@/types";

const formatRoleBindingsResponse = (serviceAccounts: RoleBindingsResponse[]) => {
  return serviceAccounts.map(({age, name, namespace, subjects, hasUpdated}) => ({
    name: name,
    namespace: namespace,
    bindings: subjects.bindings.toString(),
    age: age,
    hasUpdated: hasUpdated
  }));
};

export {
  formatRoleBindingsResponse
};