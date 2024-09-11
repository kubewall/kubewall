import { LimitRangesResponse } from "@/types";

const formatLimitRangesResponse = (limitRange: LimitRangesResponse[]) => {
  return limitRange.map(({age, name, namespace, spec, hasUpdated}) => ({
    name: name,
    namespace: namespace,
    limitCount: spec.limitCount,
    age: age,
    hasUpdated: hasUpdated
  }));
};

export {
  formatLimitRangesResponse
};