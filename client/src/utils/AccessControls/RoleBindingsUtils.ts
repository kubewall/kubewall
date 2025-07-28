import { RoleBindingsResponse } from "@/types";

const formatRoleBindingsResponse = (serviceAccounts: RoleBindingsResponse[]) => {
  return serviceAccounts.map(({age, name, namespace, subjects, hasUpdated, uid}) => ({
    name: name,
    namespace: namespace,
    bindings: subjects.bindings.join(', '),
    age: age,
    hasUpdated: hasUpdated,
    uid: uid
  }));
};

export {
  formatRoleBindingsResponse
};