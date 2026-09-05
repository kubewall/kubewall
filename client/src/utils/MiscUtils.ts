import { CustomResources, CustomResourcesNavigation, KeyValue, KeyValueNull, OwnerReference } from "@/types";

import { API_VERSION, CRON_JOBS_ENDPOINT, CUSTOM_RESOURCES_LIST_ENDPOINT, DAEMON_SETS_ENDPOINT, DEPLOYMENT_ENDPOINT, JOBS_ENDPOINT, NAMESPACES_ENDPOINT, NODES_ENDPOINT, PERSISTENT_VOLUMES_ENDPOINT, PERSISTENT_VOLUME_CLAIMS_ENDPOINT, PODS_ENDPOINT, REPLICA_SETS_ENDPOINT, SERVICES_ENDPOINT, SERVICE_ACCOUNTS_ENDPOINT, STATEFUL_SETS_ENDPOINT } from "@/constants";

const mathFloor = (val = 0) => Math.floor(val);

const NO_VALUE = '—';

// A boolean is a real value, not a missing one: React renders `true` as nothing
// at all, and `false` would otherwise take the `||` branch and read as unset.
const defaultOrValue = (value?: string | number | boolean | null) =>
  typeof value === 'boolean' ? String(value) : value || NO_VALUE;

const defaultOrKeyValuePairs = (pairs?: KeyValue | null) =>
  defaultOrValue(Object.entries(pairs ?? {}).map(([key, value]) => `${key}=${value}`).join(', '));

const defaultOrValueObject = (value: object | Array<string | null> | string | unknown) => {
  if (Array.isArray(value)) {
    return value.filter((secretValue) => !!secretValue).toString() || NO_VALUE;
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
        icon: item.spec.icon,
        route: item.queryParam,
        scope: item.scope,
        additionalPrinterColumns: item.additionalPrinterColumns,
      });
    } else {
      acc[item.spec.group] = {
        resources: [{
          name: item.spec.names.kind,
          icon: item.spec.icon,
          route: item.queryParam,
          scope: item.scope,
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

const CONTROLLED_BY_LABEL = 'Controlled By';

const detailsRouteByOwnerKind: Record<string, { resourcekind: string, namespaced: boolean }> = {
  CronJob: { resourcekind: CRON_JOBS_ENDPOINT, namespaced: true },
  DaemonSet: { resourcekind: DAEMON_SETS_ENDPOINT, namespaced: true },
  Deployment: { resourcekind: DEPLOYMENT_ENDPOINT, namespaced: true },
  Job: { resourcekind: JOBS_ENDPOINT, namespaced: true },
  Namespace: { resourcekind: NAMESPACES_ENDPOINT, namespaced: false },
  Node: { resourcekind: NODES_ENDPOINT, namespaced: false },
  PersistentVolume: { resourcekind: PERSISTENT_VOLUMES_ENDPOINT, namespaced: false },
  PersistentVolumeClaim: { resourcekind: PERSISTENT_VOLUME_CLAIMS_ENDPOINT, namespaced: true },
  Pod: { resourcekind: PODS_ENDPOINT, namespaced: true },
  ReplicaSet: { resourcekind: REPLICA_SETS_ENDPOINT, namespaced: true },
  Service: { resourcekind: SERVICES_ENDPOINT, namespaced: true },
  ServiceAccount: { resourcekind: SERVICE_ACCOUNTS_ENDPOINT, namespaced: true },
  StatefulSet: { resourcekind: STATEFUL_SETS_ENDPOINT, namespaced: true }
};

const getOwnerLink = (owner: OwnerReference, namespace?: string | null) => {
  const namespaceParam = namespace ? { namespace } : {};
  const ownerRoute = detailsRouteByOwnerKind[owner.kind];
  if (ownerRoute) {
    return {
      resourcekind: ownerRoute.resourcekind,
      resourcename: owner.name,
      ...(ownerRoute.namespaced ? namespaceParam : {})
    };
  }

  return {
    resourcekind: CUSTOM_RESOURCES_LIST_ENDPOINT,
    resourcename: owner.name,
    customResource: { group: (owner.apiVersion ?? '').includes('/') ? owner.apiVersion!.split('/')[0] : '', kind: owner.kind },
    ...namespaceParam
  };
};

const getControlledByDetail = (ownerReferences?: (OwnerReference | null)[] | null, namespace?: string | null) => {
  const controller = ownerReferences?.find((owner) => owner?.controller);
  if (!controller) {
    return { label: CONTROLLED_BY_LABEL, value: NO_VALUE };
  }

  return {
    label: CONTROLLED_BY_LABEL,
    value: `${controller.kind}/${controller.name}`,
    link: getOwnerLink(controller, namespace)
  };
};

const getServiceAccountDetail = (serviceAccountName?: string | null, namespace?: string | null) => ({
  label: 'Service Account',
  value: defaultOrValue(serviceAccountName),
  link: serviceAccountName ? {
    resourcekind: SERVICE_ACCOUNTS_ENDPOINT,
    resourcename: serviceAccountName,
    ...(namespace ? { namespace } : {})
  } : undefined
});

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

const getDisplayTime = (ts: number): string => {
  const totalSeconds = Math.floor(ts / 1000);

  if (totalSeconds < 0)  return '0s';
  if (totalSeconds < 120) return `${totalSeconds}s`;

  const totalMinutes = Math.floor(totalSeconds / 60);
  if (totalMinutes < 10) {
    const s = totalSeconds % 60;
    return s === 0 ? `${totalMinutes}m` : `${totalMinutes}m${s}s`;
  }
  if (totalMinutes < 180) return `${totalMinutes}m`;

  const totalHours = Math.floor(totalMinutes / 60);
  if (totalHours < 8) {
    const m = totalMinutes % 60;
    return m === 0 ? `${totalHours}h` : `${totalHours}h${m}m`;
  }
  if (totalHours < 48) return `${totalHours}h`;

  const days = Math.floor(totalHours / 24);
  if (totalHours < 24 * 8) {
    const h = totalHours % 24;
    return h === 0 ? `${days}d` : `${days}d${h}h`;
  }
  if (totalHours < 24 * 365 * 2) return `${days}d`;

  const years = Math.floor(days / 365);
  if (totalHours < 24 * 365 * 8) {
    const dy = days % 365;
    return dy === 0 ? `${years}y` : `${years}y${dy}d`;
  }
  return `${years}y`;
};

export {
  createEventStreamQueryObject,
  defaultOrKeyValuePairs,
  defaultOrValue,
  defaultOrValueObject,
  defaultSkeletonRow,
  formatCustomResources,
  getEventStreamUrl,
  mathFloor,
  getAnnotationCardDetails,
  getConditionsCardDetails,
  getControlledByDetail,
  getLabelConditionCardDetails,
  getServiceAccountDetail,
  getSystemTheme,
  isIP,
  toggleValueInCollection,
  toQueryParams,
  getDisplayTime
};