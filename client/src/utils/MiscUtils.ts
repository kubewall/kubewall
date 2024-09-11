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
  namespace
});

const getEventStreamUrl = (stream='', queryParmObject: Record<string, string>, extraRoutes = '', extraQueryParams = '') => {
  const queryParam = '?' + new URLSearchParams(queryParmObject).toString();
  return API_VERSION + '/' + stream + extraRoutes + queryParam + extraQueryParams;
};

const formatCustomResources = (customResources: CustomResources[]) => {
  const customResourcesNavigation = {} as CustomResourcesNavigation;

  customResources.reduce((acc, item) => {
    if (acc[item.spec.group]) {
      acc[item.spec.group].resources.push({
        name: item.spec.names.kind,
        route: item.queryParam
      });
    } else {
      acc[item.spec.group] = {
        resources: [{
          name: item.spec.names.kind,
          route: item.queryParam
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
  if(labels) {
    data.push({ fieldLabel: "Labels", defaultLabelCount: 10, data: labels });
  }
  if(conditions) {
    data.push({ fieldLabel: "Conditions", defaultLabelCount: 10, data: getConditionsCardDetails(conditions) });
  }
  if(data.length) {
    return data;
  }
  return null;
};

const getConditionsCardDetails = (conditions:undefined | null | KeyValueNull[]) => {
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
  getSystemTheme
};