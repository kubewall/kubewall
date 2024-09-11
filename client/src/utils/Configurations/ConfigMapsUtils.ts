import { ConfigMapsResponse } from "@/types";

const formatConfigMapsResponse = (configMaps: ConfigMapsResponse[]) => {
  return configMaps.map(({namespace, name, count, age, keys, hasUpdated}) => ({
    namespace:namespace,
    name: name,
    count: count,
    keys: keys === null ? '—' :keys.toString(),
    age: age,
    hasUpdated: hasUpdated
  }));
};

export {
  formatConfigMapsResponse
};
