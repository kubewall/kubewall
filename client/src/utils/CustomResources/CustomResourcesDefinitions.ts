import { CustomResourcesDefinitionsResponse } from "@/types";

const formatCustomResourcesDefinitionsResponse = (customResourcesDefinitions: CustomResourcesDefinitionsResponse[]) => {
  return customResourcesDefinitions.map(({name, activeVersion, age, scope, spec, uid}) => ({
    name: name,
    icon: spec.icon,
    resource: spec.names.kind,
    group: spec.group,
    version: activeVersion,
    scope: scope,
    age: age,
    uid: uid
  }));
};

export {
  formatCustomResourcesDefinitionsResponse
};
