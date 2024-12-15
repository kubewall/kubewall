import { LimitRangesResponse } from "@/types";

const formatLimitRangesResponse = (limitRange: LimitRangesResponse[]) => {
  return limitRange.map(({age, name, namespace, spec, hasUpdated, uid}) => ({
    name: name,
    namespace: namespace,
    limitCount: spec.limitCount,
    age: age,
    hasUpdated: hasUpdated,
    uid: uid
  }));
};

export {
  formatLimitRangesResponse
};