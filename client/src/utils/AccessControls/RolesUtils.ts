import { RolesResponse } from "@/types";

const formatRolesResponse = (roles: RolesResponse[]) => {
  return roles.map(({age, name, namespace, spec, hasUpdated}) => ({
    name: name,
    namespace: namespace,
    rules: spec.rules,
    age: age,
    hasUpdated: hasUpdated
  }));
};

export {
  formatRolesResponse
};