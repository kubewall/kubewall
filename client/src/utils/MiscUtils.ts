import { CustomResources, CustomResourcesNavigation, KeyValue, KeyValueNull } from "@/types";

import { API_VERSION } from "@/constants";

const mathFloor = (val = 0) => Math.floor(val);

const defaultOrValue = (value?: string | number | boolean | null) => value || '—';

const defaultOrValueObject = (value: object | Array<string | null> | string | unknown) => {
  if (Array.isArray(value)) {
    return value.filter((secretValue) => !!secretValue).toString() || '—';
  }
  if (typeof value === 'string') {
    return value;
  }
  return JSON.stringify(value);
};

const defaultSkeletonRow = () => Array(30).fill({});

const createEventStreamQueryObject = (config: string, cluster: string, namespace = '') => ({
  config,
  cluster,
  ...(namespace ? { namespace } : {})
});

const getEventStreamUrl = (stream = '', queryParmObject: Record<string, string>, extraRoutes = '', extraQueryParams = '') => {
  const queryParam = '?' + new URLSearchParams(queryParmObject).toString();
  return API_VERSION + '/' + stream + extraRoutes + queryParam + extraQueryParams;
};

const formatCustomResources = (customResources: CustomResources[]) => {
  const customResourcesNavigation = {} as CustomResourcesNavigation;

  customResources.reduce((acc, item) => {
    if (acc[item.spec.group]) {
      acc[item.spec.group].resources.push({
        name: item.spec.names.kind,
        route: item.queryParam,
        additionalPrinterColumns: item.additionalPrinterColumns,
      });
    } else {
      acc[item.spec.group] = {
        resources: [{
          name: item.spec.names.kind,
          route: item.queryParam,
          additionalPrinterColumns: item.additionalPrinterColumns,
        }]
      };
    }

    return acc;
  }, customResourcesNavigation);
  return customResourcesNavigation;
};

const getAnnotationCardDetails = (annotations: null | undefined | KeyValueNull) => {
  return annotations && Object.keys(annotations).length ?
    [{ fieldLabel: "Annotations", data: annotations, defaultLabelCount: 5 }] : null;
};

const getLabelConditionCardDetails = (labels: null | undefined | KeyValueNull, conditions: undefined | null | KeyValueNull[]) => {
  const data = [];
  if (labels) {
    data.push({ fieldLabel: "Labels", defaultLabelCount: 10, data: labels });
  }
  if (conditions) {
    data.push({ fieldLabel: "Conditions", defaultLabelCount: 10, data: getConditionsCardDetails(conditions) });
  }
  if (data.length) {
    return data;
  }
  return null;
};

const getConditionsCardDetails = (conditions: undefined | null | KeyValueNull[]) => {
  return conditions?.reduce(function (result, item) {
    if (result && item && item.type) {
      const key = item.type;
      result[key] = item.status;
    }
    return result;
  }, {} as KeyValue);
};

const getSystemTheme = () => {
  let theme = localStorage.getItem('kw-ui-theme');
  if (theme === 'system') {
    theme = window.matchMedia("(prefers-color-scheme: dark)").matches ? 'dark' : 'light';
  }
  if (theme === 'dark') {
    return 'vs-dark';
  }
  return 'light';
};

// IPv4 Segment
const v4Seg = '(?:25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])';
const v4Str = `(?:${v4Seg}\\.){3}${v4Seg}`;
const IPv4Reg = new RegExp(`^${v4Str}$`);

// IPv6 Segment
const v6Seg = '(?:[0-9a-fA-F]{1,4})';
const IPv6Reg = new RegExp('^(?:' +
  `(?:${v6Seg}:){7}(?:${v6Seg}|:)|` +
  `(?:${v6Seg}:){6}(?:${v4Str}|:${v6Seg}|:)|` +
  `(?:${v6Seg}:){5}(?::${v4Str}|(?::${v6Seg}){1,2}|:)|` +
  `(?:${v6Seg}:){4}(?:(?::${v6Seg}){0,1}:${v4Str}|(?::${v6Seg}){1,3}|:)|` +
  `(?:${v6Seg}:){3}(?:(?::${v6Seg}){0,2}:${v4Str}|(?::${v6Seg}){1,4}|:)|` +
  `(?:${v6Seg}:){2}(?:(?::${v6Seg}){0,3}:${v4Str}|(?::${v6Seg}){1,5}|:)|` +
  `(?:${v6Seg}:){1}(?:(?::${v6Seg}){0,4}:${v4Str}|(?::${v6Seg}){1,6}|:)|` +
  `(?::(?:(?::${v6Seg}){0,5}:${v4Str}|(?::${v6Seg}){1,7}|:))` +
  ')(?:%[0-9a-zA-Z-.:]{1,})?$');

const isIPv4 = (s: string) => IPv4Reg.test(s);

const isIPv6 = (s: string) => IPv6Reg.test(s);

const isIP = (s: string) => isIPv4(s) || isIPv6(s);

const toggleValueInCollection = (collection: string[], currentValue: string) => {
  if (collection.includes(currentValue)) {
    return collection.filter((item) => item !== currentValue);
  } else {
    return [...collection, currentValue];
  }
};

const toQueryParams = (collection: Record<string, string>) => {
  return new URLSearchParams(collection).toString();
};

export {
  createEventStreamQueryObject,
  defaultOrValue,
  defaultOrValueObject,
  defaultSkeletonRow,
  formatCustomResources,
  getEventStreamUrl,
  mathFloor,
  getAnnotationCardDetails,
  getConditionsCardDetails,
  getLabelConditionCardDetails,
  getSystemTheme,
  isIP,
  toggleValueInCollection,
  toQueryParams
};