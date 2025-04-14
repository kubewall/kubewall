import { CustomResourcesDefinitionsResponse } from "@/types";
const svgModules = import.meta.glob('/src/assets/icons/crds/*.svg') // no eager!

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

const loadSvgByName = async (name: string): Promise<string | null> => {
  for (const path in svgModules) {
    const fileName = path.split('/').pop()
    if (fileName === name) {
      const mod: any = await svgModules[path]()
      return mod.default
    }
  }

  return null
}

export {
  formatCustomResourcesDefinitionsResponse,
  loadSvgByName
};
