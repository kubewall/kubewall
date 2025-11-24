import { CustomResourcesPrinterColumns, HeaderList } from "@/types";

import { ActionCreatorWithPayload } from "@reduxjs/toolkit";

type ResourcesCustomProps = {
  headersList: HeaderList[],
  queryParams: { config: string, cluster: string },
  showNamespaceFilter: boolean
}

const getTableConfig = <T>(
  data: T[],
  instaceType: string,
  // eslint-disable-next-line  @typescript-eslint/no-explicit-any
  dispatchMethod: ActionCreatorWithPayload<any, string>,
  loading: boolean,
  resourceCustomProps: ResourcesCustomProps,
) => ({
  data,
  instaceType,
  dispatchMethod,
  loading,
  ...resourceCustomProps
});

// Cluster

const leasesColumnConfig = (config: string, cluster: string) => ({
  headersList: [
    { title: 'Select', accessorKey: 'select', enableSorting: false, },
    { title: 'Namespace', accessorKey: 'namespace', enableGlobalFilter: true },
    { title: 'Name', accessorKey: 'name', enableGlobalFilter: true },
    { title: 'Holder Identity', accessorKey: 'holderIdentity' },
    { title: 'Lease Duration Seconds', accessorKey: 'leaseDurationSeconds' },
    { title: 'Age', accessorKey: 'age' },
  ],
  queryParams: { config, cluster },
  showNamespaceFilter: true
});

const clusterEventsColumnConfig = (config: string, cluster: string) => ({
  headersList: [
    { title: 'Select', accessorKey: 'select', enableSorting: false, },
    { title: 'Type', accessorKey: 'type', enableGlobalFilter: true },
    { title: 'Message', accessorKey: 'message', enableGlobalFilter: true },
    { title: 'Namespace', accessorKey: 'namespace' },
    { title: 'Kind', accessorKey: 'kind' },
    { title: 'Api Version', accessorKey: 'apiVersion' },
    { title: 'Source', accessorKey: 'source' },
    { title: 'Count', accessorKey: 'count' },
    { title: 'Age', accessorKey: 'age' },
  ],
  queryParams: { config, cluster },
  showNamespaceFilter: true
});

const namespacesColumnConfig = (config: string, cluster: string) => ({
  headersList: [
    { title: 'Select', accessorKey: 'select', enableSorting: false, },
    { title: 'Name', accessorKey: 'name', enableGlobalFilter: true },
    { title: 'Phase', accessorKey: 'phase' },
    { title: 'UID', accessorKey: 'uid' },
    { title: 'Age', accessorKey: 'age' },
  ],
  queryParams: { config, cluster },
  showNamespaceFilter: false
});

const nodesColumnConfig = (config: string, cluster: string) => ({
  headersList: [
    { title: 'Name', accessorKey: 'name', enableGlobalFilter: true },
    { title: 'Resource Version', accessorKey: 'resourceVersion' },
    { title: 'Age', accessorKey: 'age' },
    { title: 'Roles', accessorKey: 'roles' },
    { title: 'Condition Status', accessorKey: 'conditionStatus' },
    { title: 'Architecture', accessorKey: 'architecture' },
    { title: 'BootId', accessorKey: 'bootID' },
    { title: 'Container Runtime Version', accessorKey: 'containerRuntimeVersion' },
    { title: 'Kernel Version', accessorKey: 'kernelVersion' },
    { title: 'Kube Proxy Version', accessorKey: 'kubeProxyVersion' },
    { title: 'Kubelet Version', accessorKey: 'kubeletVersion' },
    { title: 'MachineId', accessorKey: 'machineID' },
    { title: 'Operating System', accessorKey: 'operatingSystem' },
    { title: 'Os Image', accessorKey: 'osImage' },
    { title: 'System UUID', accessorKey: 'systemUUID' }
  ],
  queryParams: { config, cluster },
  showNamespaceFilter: false
});

// Configurations

const configMapsColumnConfig = (config: string, cluster: string) => ({
  headersList: [
    { title: 'Select', accessorKey: 'select', enableSorting: false, },
    { title: 'Namespace', accessorKey: 'namespace', enableGlobalFilter: true },
    { title: 'Name', accessorKey: 'name', enableGlobalFilter: true },
    { title: 'Keys Count', accessorKey: 'count' },
    { title: 'Keys', accessorKey: 'keys' },
    { title: 'Age', accessorKey: 'age' }
  ],
  queryParams: { config, cluster },
  showNamespaceFilter: true
});

const hpasColumnConfig = (config: string, cluster: string) => ({
  headersList: [
    { title: 'Select', accessorKey: 'select', enableSorting: false, },
    { title: 'Namespace', accessorKey: 'namespace', enableGlobalFilter: true },
    { title: 'Name', accessorKey: 'name', enableGlobalFilter: true },
    { title: 'Minimum Pods', accessorKey: 'minPods' },
    { title: 'Maximum Pods', accessorKey: 'maxPods' },
    { title: 'Age', accessorKey: 'age' }
  ],
  queryParams: { config, cluster },
  showNamespaceFilter: true
});

const limitRangesColumnConfig = (config: string, cluster: string) => ({
  headersList: [
    { title: 'Select', accessorKey: 'select', enableSorting: false, },
    { title: 'Namespace', accessorKey: 'namespace', enableGlobalFilter: true },
    { title: 'Name', accessorKey: 'name', enableGlobalFilter: true },
    { title: 'Limit Count', accessorKey: 'limitCount' },
    { title: 'Age', accessorKey: 'age' }
  ],
  queryParams: { config, cluster },
  showNamespaceFilter: true
});

const podDisruptionBudgetsColumnConfig = (config: string, cluster: string) => ({
  headersList: [
    { title: 'Select', accessorKey: 'select', enableSorting: false, },
    { title: 'Namespace', accessorKey: 'namespace', enableGlobalFilter: true },
    { title: 'Name', accessorKey: 'name', enableGlobalFilter: true },
    { title: 'Minimum Available', accessorKey: 'minAvailable' },
    { title: 'Maximum Unavailable', accessorKey: 'maxUnavailable' },
    { title: 'Current Healthy', accessorKey: 'currentHealthy' },
    { title: 'Age', accessorKey: 'age' }
  ],
  queryParams: { config, cluster },
  showNamespaceFilter: true
});

const priorityClassesColumnConfig = (config: string, cluster: string) => ({
  headersList: [
    { title: 'Select', accessorKey: 'select', enableSorting: false, },
    { title: 'Name', accessorKey: 'name', enableGlobalFilter: true },
    { title: 'Value', accessorKey: 'value' },
    { title: 'Global Default', accessorKey: 'globalDefault' },
    { title: 'Preemption Policy', accessorKey: 'preemptionPolicy' },
    { title: 'Age', accessorKey: 'age' }
  ],
  queryParams: { config, cluster },
  showNamespaceFilter: false
});

const resourceQuotasColumnConfig = (config: string, cluster: string) => ({
  headersList: [
    { title: 'Select', accessorKey: 'select', enableSorting: false, },
    { title: 'Namespace', accessorKey: 'namespace', enableGlobalFilter: true },
    { title: 'Name', accessorKey: 'name', enableGlobalFilter: true },
    { title: 'Age', accessorKey: 'age' }
  ],
  queryParams: { config, cluster },
  showNamespaceFilter: true
});

const runtimeClassesColumnConfig = (config: string, cluster: string) => ({
  headersList: [
    { title: 'Select', accessorKey: 'select', enableSorting: false, },
    { title: 'Name', accessorKey: 'name', enableGlobalFilter: true },
    { title: 'Handler', accessorKey: 'handler' },
    { title: 'Age', accessorKey: 'age' }
  ],
  queryParams: { config, cluster },
  showNamespaceFilter: false
});

const secretsColumnConfig = (config: string, cluster: string) => ({
  headersList: [
    { title: 'Select', accessorKey: 'select', enableSorting: false, },
    { title: 'Namespace', accessorKey: 'namespace', enableGlobalFilter: true },
    { title: 'Name', accessorKey: 'name', enableGlobalFilter: true },
    { title: 'Type', accessorKey: 'type' },
    { title: 'Keys', accessorKey: 'keys' },
    { title: 'Age', accessorKey: 'age' }
  ],
  queryParams: { config, cluster },
  showNamespaceFilter: true
});

// Access Controls

const clusterRoleBindingsColumnConfig = (config: string, cluster: string) => ({
  headersList: [
    { title: 'Select', accessorKey: 'select', enableSorting: false, },
    { title: 'Name', accessorKey: 'name', enableGlobalFilter: true },
    { title: 'Bindings', accessorKey: 'bindings' },
    { title: 'Age', accessorKey: 'age' }
  ],
  queryParams: { config, cluster },
  showNamespaceFilter: false
});

const clusterRolesColumnConfig = (config: string, cluster: string) => ({
  headersList: [
    { title: 'Select', accessorKey: 'select', enableSorting: false, },
    { title: 'Name', accessorKey: 'name', enableGlobalFilter: true },
    { title: 'Rules', accessorKey: 'rules' },
    { title: 'Age', accessorKey: 'age' }
  ],
  queryParams: { config, cluster },
  showNamespaceFilter: false
});

const roleBindingsColumnConfig = (config: string, cluster: string) => ({
  headersList: [
    { title: 'Select', accessorKey: 'select', enableSorting: false, },
    { title: 'Namespace', accessorKey: 'namespace', enableGlobalFilter: true },
    { title: 'Name', accessorKey: 'name', enableGlobalFilter: true },
    { title: 'Bindings', accessorKey: 'bindings' },
    { title: 'Age', accessorKey: 'age' }
  ],
  queryParams: { config, cluster },
  showNamespaceFilter: true
});

const rolesColumnConfig = (config: string, cluster: string) => ({
  headersList: [
    { title: 'Select', accessorKey: 'select', enableSorting: false, },
    { title: 'Namespace', accessorKey: 'namespace', enableGlobalFilter: true },
    { title: 'Name', accessorKey: 'name', enableGlobalFilter: true },
    { title: 'Rules', accessorKey: 'rules' },
    { title: 'Age', accessorKey: 'age' }
  ],
  queryParams: { config, cluster },
  showNamespaceFilter: true
});

const serviceAccountsColumnConfig = (config: string, cluster: string) => ({
  headersList: [
    { title: 'Select', accessorKey: 'select', enableSorting: false, },
    { title: 'Namespace', accessorKey: 'namespace', enableGlobalFilter: true },
    { title: 'Name', accessorKey: 'name', enableGlobalFilter: true },
    { title: 'Secrets', accessorKey: 'secrets' },
    { title: 'Age', accessorKey: 'age' }
  ],
  queryParams: { config, cluster },
  showNamespaceFilter: true
});

// Network

const endpointsColumnConfig = (config: string, cluster: string) => ({
  headersList: [
    { title: 'Select', accessorKey: 'select', enableSorting: false, },
    { title: 'Namespace', accessorKey: 'namespace', enableGlobalFilter: true },
    { title: 'Name', accessorKey: 'name', enableGlobalFilter: true },
    { title: 'Addresses', accessorKey: 'addresses' },
    { title: 'Ports', accessorKey: 'ports' },
    { title: 'Age', accessorKey: 'age' }
  ],
  queryParams: { config, cluster },
  showNamespaceFilter: true
});

const ingressesColumnConfig = (config: string, cluster: string) => ({
  headersList: [
    { title: 'Select', accessorKey: 'select', enableSorting: false, },
    { title: 'Namespace', accessorKey: 'namespace', enableGlobalFilter: true },
    { title: 'Name', accessorKey: 'name', enableGlobalFilter: true },
    { title: 'Rules', accessorKey: 'rules' },
    { title: 'Age', accessorKey: 'age' }
  ],
  queryParams: { config, cluster },
  showNamespaceFilter: true
});

const servicesColumnConfig = (config: string, cluster: string) => ({
  headersList: [
    { title: 'Select', accessorKey: 'select', enableSorting: false, },
    { title: 'Namespace', accessorKey: 'namespace', enableGlobalFilter: true },
    { title: 'Name', accessorKey: 'name', enableGlobalFilter: true },
    { title: 'Type', accessorKey: 'type', enableGlobalFilter: true },
    { title: 'Cluster IP', accessorKey: 'clusterIP', enableGlobalFilter: true },
    { title: 'External IP', accessorKey: 'externalIP', enableGlobalFilter: true },
    { title: 'Ports', accessorKey: 'ports', enableGlobalFilter: true },
    { title: 'Session Affinity', accessorKey: 'sessionAffinity' },
    { title: 'IP Family Policy', accessorKey: 'ipFamilyPolicy' },
    { title: 'Internal Traffic Policy', accessorKey: 'internalTrafficPolicy' },
    { title: 'Age', accessorKey: 'age' }
  ],
  queryParams: { config, cluster },
  showNamespaceFilter: true
});

const portForwardingColumnConfig = (config: string, cluster: string) => ({
  headersList: [
    { title: 'Select', accessorKey: 'select', enableSorting: false, },
    { title: 'Namespace', accessorKey: 'namespace', enableGlobalFilter: true },
    { title: 'Kind', accessorKey: 'kind', enableGlobalFilter: true },
    { title: 'Name', accessorKey: 'name', enableGlobalFilter: true },
    { title: 'Pod', accessorKey: 'pod', enableGlobalFilter: true },
    { title: 'Container Port', accessorKey: 'containerPort' },
    { title: 'Local Port', accessorKey: 'localPort' },
  ],
  queryParams: { config, cluster },
  showNamespaceFilter: true
});

// Storage

const persistentVolumeClaimsColumnConfig = (config: string, cluster: string) => ({
  headersList: [
    { title: 'Select', accessorKey: 'select', enableSorting: false, },
    { title: 'Namespace', accessorKey: 'namespace', enableGlobalFilter: true },
    { title: 'Name', accessorKey: 'name', enableGlobalFilter: true },
    { title: 'Storage Class Name', accessorKey: 'storageClassName' },
    { title: 'Volume Name', accessorKey: 'volumeName' },
    { title: 'Volume Mode', accessorKey: 'volumeMode' },
    { title: 'Storage', accessorKey: 'storage' },
    { title: 'Phase', accessorKey: 'phase' },
    { title: 'Age', accessorKey: 'age' }
  ],
  queryParams: { config, cluster },
  showNamespaceFilter: true
});

const persistentVolumesColumnConfig = (config: string, cluster: string) => ({
  headersList: [
    { title: 'Select', accessorKey: 'select', enableSorting: false, },
    { title: 'Name', accessorKey: 'name', enableGlobalFilter: true },
    { title: 'Storage Class Name', accessorKey: 'storageClassName' },
    { title: 'Volume Mode', accessorKey: 'volumeMode' },
    { title: 'Claim Ref', accessorKey: 'claimRef' },
    { title: 'Phase', accessorKey: 'phase' },
    { title: 'Age', accessorKey: 'age' }
  ],
  queryParams: { config, cluster },
  showNamespaceFilter: false
});

const storageClassesColumnConfig = (config: string, cluster: string) => ({
  headersList: [
    { title: 'Select', accessorKey: 'select', enableSorting: false, },
    { title: 'Name', accessorKey: 'name', enableGlobalFilter: true },
    { title: 'Provisioner', accessorKey: 'provisioner' },
    { title: 'Reclaim Policy', accessorKey: 'reclaimPolicy' },
    { title: 'Volume Binding Mode', accessorKey: 'VolumeBindingMode' },
    { title: 'Age', accessorKey: 'age' }
  ],
  queryParams: { config, cluster },
  showNamespaceFilter: false
});

// Workloads

const podsColumnConfig = (config: string, cluster: string, isSelectable = true) => ({
  headersList: [
    { title: 'Select', accessorKey: 'select', enableSorting: false, },
    { title: 'Namespace', accessorKey: 'namespace', enableGlobalFilter: true },
    { title: 'Name', accessorKey: 'name', enableGlobalFilter: true },
    { title: 'Node', accessorKey: 'node', enableGlobalFilter: true },
    { title: 'Ready', accessorKey: 'ready', enableSorting: false, },
    { title: 'Status', accessorKey: 'status', enableGlobalFilter: true },
    { title: 'CPU', accessorKey: 'cpu', },
    { title: 'Memory', accessorKey: 'memory', },
    { title: 'Restarts', accessorKey: 'restarts', },
    { title: 'Last Restart', accessorKey: 'lastRestartAt', },
    { title: 'IP', accessorKey: 'podIP', enableGlobalFilter: true },
    { title: 'Age', accessorKey: 'age' }
  ].filter(({ title }) => isSelectable || (!isSelectable && title.toLowerCase() !== 'select')),
  queryParams: { config, cluster },
  showNamespaceFilter: true
});

const cronJobsColumnConfig = (config: string, cluster: string) => ({
  headersList: [
    { title: 'Select', accessorKey: 'select', enableSorting: false, },
    { title: 'Namespace', accessorKey: 'namespace', enableGlobalFilter: true },
    { title: 'Name', accessorKey: 'name', enableGlobalFilter: true },
    { title: 'Schedule', accessorKey: 'schedule' },
    { title: 'Active Jobs', accessorKey: 'activeJobs' },
    { title: 'Last Schedule', accessorKey: 'lastSchedule' },
    { title: 'Suspend', accessorKey: 'suspend' },
    { title: 'Age', accessorKey: 'age' }
  ],
  queryParams: { config, cluster },
  showNamespaceFilter: true
});

const daemonSetsColumnConfig = (config: string, cluster: string) => ({
  headersList: [
    { title: 'Select', accessorKey: 'select', enableSorting: false, },
    { title: 'Namespace', accessorKey: 'namespace', enableGlobalFilter: true },
    { title: 'Name', accessorKey: 'name', enableGlobalFilter: true },
    { title: 'Current', accessorKey: 'current', enableSorting: false },
    { title: 'Ready', accessorKey: 'ready', enableSorting: false },
    { title: 'Updated', accessorKey: 'updated' },
    { title: 'Available', accessorKey: 'available' },
    { title: 'Age', accessorKey: 'age' }
  ],
  queryParams: { config, cluster },
  showNamespaceFilter: true
});

const deploymentsColumnConfig = (config: string, cluster: string) => ({
  headersList: [
    { title: 'Select', accessorKey: 'select', enableSorting: false, },
    { title: 'Namespace', accessorKey: 'namespace', enableGlobalFilter: true },
    { title: 'Name', accessorKey: 'name', enableGlobalFilter: true },
    { title: 'Ready', accessorKey: 'ready', enableSorting: false },
    { title: 'Desired', accessorKey: 'desired' },
    { title: 'Updated', accessorKey: 'updated' },
    { title: 'Available', accessorKey: 'available' },
    { title: 'Conditions', accessorKey: 'conditions' },
    { title: 'Age', accessorKey: 'age' }
  ],
  queryParams: { config, cluster },
  showNamespaceFilter: true
});

const jobsColumnConfig = (config: string, cluster: string) => ({
  headersList: [
    { title: 'Select', accessorKey: 'select', enableSorting: false, },
    { title: 'Namespace', accessorKey: 'namespace', enableGlobalFilter: true },
    { title: 'Name', accessorKey: 'name', enableGlobalFilter: true },
    { title: 'Completions', accessorKey: 'completions', enableSorting: false },
    { title: 'Conditions', accessorKey: 'conditions' },
    { title: 'Duration', accessorKey: 'duration' },
    { title: 'Age', accessorKey: 'age' }
  ],
  queryParams: { config, cluster },
  showNamespaceFilter: true
});

const replicaSetsColumnConfig = (config: string, cluster: string) => ({
  headersList: [
    { title: 'Select', accessorKey: 'select', enableSorting: false, },
    { title: 'Namespace', accessorKey: 'namespace', enableGlobalFilter: true },
    { title: 'Name', accessorKey: 'name', enableGlobalFilter: true },
    { title: 'Ready', accessorKey: 'ready', enableSorting: false },
    { title: 'Available', accessorKey: 'available' },
    { title: 'Age', accessorKey: 'age' }
  ],
  queryParams: { config, cluster },
  showNamespaceFilter: true
});

const stateSetsColumnConfig = (config: string, cluster: string) => ({
  headersList: [
    { title: 'Select', accessorKey: 'select', enableSorting: false, },
    { title: 'Namespace', accessorKey: 'namespace', enableGlobalFilter: true },
    { title: 'Name', accessorKey: 'name', enableGlobalFilter: true },
    { title: 'Ready', accessorKey: 'ready', enableSorting: false },
    { title: 'Available', accessorKey: 'available' },
    { title: 'Age', accessorKey: 'age' }
  ],
  queryParams: { config, cluster },
  showNamespaceFilter: true
});

// Custom Resources

const customResourceDefinitionsColumnConfig = (config: string, cluster: string) => ({
  headersList: [
    { title: 'Select', accessorKey: 'select', enableSorting: false, },
    { title: 'Name', accessorKey: 'name', enableGlobalFilter: true },
    { title: 'Resource', accessorKey: 'resource', enableGlobalFilter: true },
    { title: 'Group', accessorKey: 'group', enableGlobalFilter: true },
    { title: 'Version', accessorKey: 'version' },
    { title: 'Scope', accessorKey: 'scope' },
    { title: 'Age', accessorKey: 'age' }
  ],
  queryParams: { config, cluster },
  showNamespaceFilter: false
});

const customResourcesColumnConfig = (additionalPrinterColumns: CustomResourcesPrinterColumns[] = [], config: string, cluster: string, loading: boolean, group?: string, kind?: string, resource?: string, version?: string) => ({
  headersList: [
    { title: 'Select', accessorKey: 'select', enableSorting: false, },
    ...additionalPrinterColumns.map((columns) => {
      return {
        title: columns.name,
        accessorKey: loading ? '' : columns.jsonPath.slice(1),
        ...(columns.name === 'Name' || columns.name === 'Namespace' ? { enableGlobalFilter: true } : {})
      };
    })
  ],
  queryParams: {
    cluster,
    config,
    group,
    kind,
    resource,
    version
  },
  showNamespaceFilter: additionalPrinterColumns.filter(({ name }) => name === 'Namespace').length > 0
});

export {
  getTableConfig,
  leasesColumnConfig,
  clusterEventsColumnConfig,
  namespacesColumnConfig,
  podsColumnConfig,
  nodesColumnConfig,
  configMapsColumnConfig,
  hpasColumnConfig,
  limitRangesColumnConfig,
  podDisruptionBudgetsColumnConfig,
  priorityClassesColumnConfig,
  resourceQuotasColumnConfig,
  runtimeClassesColumnConfig,
  secretsColumnConfig,
  clusterRoleBindingsColumnConfig,
  clusterRolesColumnConfig,
  roleBindingsColumnConfig,
  rolesColumnConfig,
  serviceAccountsColumnConfig,
  endpointsColumnConfig,
  ingressesColumnConfig,
  servicesColumnConfig,
  portForwardingColumnConfig,
  persistentVolumeClaimsColumnConfig,
  persistentVolumesColumnConfig,
  storageClassesColumnConfig,
  cronJobsColumnConfig,
  daemonSetsColumnConfig,
  deploymentsColumnConfig,
  jobsColumnConfig,
  replicaSetsColumnConfig,
  stateSetsColumnConfig,
  customResourceDefinitionsColumnConfig,
  customResourcesColumnConfig
};
