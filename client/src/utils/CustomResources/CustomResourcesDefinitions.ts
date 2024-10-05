import { CustomResourcesDefinitionsResponse } from "@/types";

const formatCustomResourcesDefinitionsResponse = (customResourcesDefinitions: CustomResourcesDefinitionsResponse[]) => {
  return customResourcesDefinitions.map(({name, activeVersion, age, scope, spec}) => ({
    name: name,
    resource: spec.names.kind,
    group: spec.group,
    version: activeVersion,
    scope: scope,
    age: age,
  }));
};

export {
  formatCustomResourcesDefinitionsResponse
};
