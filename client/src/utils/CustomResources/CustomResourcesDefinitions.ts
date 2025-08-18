import { CustomResourcesDefinitionsResponse } from "@/types";
const svgModules = import.meta.glob('/src/assets/icons/crds/*.svg'); // no eager!

const getAvailableCrdsIconNames = (): Set<string> => {
  const names = new Set<string>();
  for (const path in svgModules) {
    const fileName = path.split('/').pop();
    if (fileName) names.add(fileName);
  }
  return names;
};

/**
 * Resolve the best icon filename (including .svg) for a given CRD group.
 * Strategy:
 * - Try exact group match, e.g. monitoring.coreos.com.svg
 * - Try last 2 domain parts, e.g. coreos.com.svg
 * - Try last 3 domain parts (helps for x-k8s.io etc.), e.g. x-k8s.io.svg
 * - Otherwise return null and let the UI fall back to a generic icon
 */
const resolveCrdsIconFileName = (group: string): string | null => {
  if (!group) return null;
  const files = getAvailableCrdsIconNames();
  const parts = group.split('.');

  const candidates: string[] = [];
  // exact
  candidates.push(`${group}.svg`);
  // last 2 parts
  if (parts.length >= 2) {
    candidates.push(`${parts.slice(-2).join('.')}.svg`);
  }
  // last 3 parts
  if (parts.length >= 3) {
    candidates.push(`${parts.slice(-3).join('.')}.svg`);
  }

  for (const name of candidates) {
    if (files.has(name)) return name;
  }
  return null;
};

const formatCustomResourcesDefinitionsResponse = (customResourcesDefinitions: CustomResourcesDefinitionsResponse[]) => {
  return customResourcesDefinitions.map(({name, activeVersion, age, scope, spec, uid}) => ({
    name: name,
    // Prefer a logo matching the CRD group; fall back to whatever the backend sent
    icon: resolveCrdsIconFileName(spec.group) ?? spec.icon,
    resource: spec.names.kind,
    group: spec.group,
    version: activeVersion,
    scope: scope,
    age: age,
    uid: uid
  }));
};

const loadSvgByName = async (name: string): Promise<string | null> => {
  if (!name) return null;

  // Build candidate filenames to try
  const candidates = new Set<string>();
  if (name.endsWith('.svg')) {
    candidates.add(name);
  } else {
    candidates.add(`${name}.svg`);
    const resolved = resolveCrdsIconFileName(name);
    if (resolved) candidates.add(resolved);
  }

  for (const path in svgModules) {
    const fileName = path.split('/').pop();
    if (fileName && candidates.has(fileName)) {
      /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
      const mod: any = await svgModules[path]();
      return mod.default;
    }
  }

  return null;
};

export {
  formatCustomResourcesDefinitionsResponse,
  loadSvgByName,
  resolveCrdsIconFileName
};
