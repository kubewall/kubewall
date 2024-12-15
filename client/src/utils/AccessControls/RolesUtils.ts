import { RolesResponse } from "@/types";

const formatRolesResponse = (roles: RolesResponse[]) => {
  return roles.map(({age, name, namespace, spec, hasUpdated, uid}) => ({
    name: name,
    namespace: namespace,
    rules: spec.rules,
    age: age,
    hasUpdated: hasUpdated,
    uid: uid
  }));
};

export {
  formatRolesResponse
};