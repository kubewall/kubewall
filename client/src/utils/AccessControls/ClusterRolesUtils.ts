import { ClusterRolesResponse } from "@/types";

const formatClusterRolesResponse = (roles: ClusterRolesResponse[]) => {
  return roles.map(({age, name, namespace, spec, hasUpdated}) => ({
    name: name,
    namespace: namespace,
    rules: spec.rules,
    age: age,
    hasUpdated: hasUpdated
  }));
};

export {
  formatClusterRolesResponse
};