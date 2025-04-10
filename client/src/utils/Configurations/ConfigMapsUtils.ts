import { ConfigMapsResponse } from "@/types";

const formatConfigMapsResponse = (configMaps: ConfigMapsResponse[]) => {
  return configMaps.map(({namespace, name, count, age, keys, hasUpdated, uid}) => ({
    namespace:namespace,
    name: name,
    count: count,
    keys: keys === null ? '—' :keys.join(', '),
    age: age,
    hasUpdated: hasUpdated,
    uid: uid
  }));
};

export {
  formatConfigMapsResponse
};
