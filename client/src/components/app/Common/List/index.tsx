import {
  CLUSTER_ROLES_ENDPOINT,
  CLUSTER_ROLE_BINDINGS_ENDPOINT,
  CONFIG_MAPS_ENDPOINT,
  CRON_JOBS_ENDPOINT,
  CUSTOM_RESOURCES_LIST_ENDPOINT,
  DAEMON_SETS_ENDPOINT,
  DEPLOYMENT_ENDPOINT,
  ENDPOINTS_ENDPOINT,
  HPA_ENDPOINT,
  INGRESSES_ENDPOINT,
  JOBS_ENDPOINT,
  LEASES_ENDPOINT,
  LIMIT_RANGE_ENDPOINT,
  NAMESPACES_ENDPOINT,
  NODES_ENDPOINT,
  PERSISTENT_VOLUMES_ENDPOINT,
  PERSISTENT_VOLUME_CLAIMS_ENDPOINT,
  PODS_ENDPOINT,
  POD_DISRUPTION_BUDGETS_ENDPOINT,
  PRIORITY_CLASSES_ENDPOINT,
  REPLICA_SETS_ENDPOINT,
  RESOURCE_QUOTAS_ENDPOINT,
  ROLES_ENDPOINT,
  ROLE_BINDINGS_ENDPOINT,
  RUNTIME_CLASSES_ENDPOINT,
  SECRETS_ENDPOINT,
  SERVICES_ENDPOINT,
  SERVICE_ACCOUNTS_ENDPOINT,
  STATEFUL_SETS_ENDPOINT,
  STORAGE_CLASSES_ENDPOINT
} from "@/constants";
import {
  ClusterRoleBindingsListHeader,
  ClusterRolesListHeader,
  ConfigMapsHeader,
  CronJobsHeader,
  CustomResourceHeaders,
  DaemonSetsHeader,
  DeploymentsTableHeaders,
  EndpointsHeaders,
  HPAsListHeader,
  HeaderList,
  IngressesHeaders,
  JobsHeader,
  LeasesListHeader,
  LimitRangesListHeader,
  NamespacesHeaders,
  NodesListHeaders,
  PersistentVolumeClaimsHeaders,
  PersistentVolumesHeaders,
  PodDisruptionBudgetsHeader,
  PodsHeaders,
  PriorityClassesHeaders,
  ReplicaSetsHeader,
  ResourceQuotasHeaders,
  RoleBindingsListHeader,
  RolesListHeader,
  RuntimeClassesHeader,
  SecretsListHeader,
  ServiceAccountsListHeader,
  ServicesListHeaders,
  StatefulSetsHeader,
  StorageClassesHeaders
} from "@/types";
import {
  clusterRoleBindingsColumnConfig,
  clusterRolesColumnConfig,
  configMapsColumnConfig,
  cronJobsColumnConfig,
  customResourcesColumnConfig,
  daemonSetsColumnConfig,
  deploymentsColumnConfig,
  endpointsColumnConfig,
  getTableConfig,
  hpasColumnConfig,
  ingressesColumnConfig,
  jobsColumnConfig,
  leasesColumnConfig,
  limitRangesColumnConfig,
  namespacesColumnConfig,
  nodesColumnConfig,
  persistentVolumeClaimsColumnConfig,
  persistentVolumesColumnConfig,
  podDisruptionBudgetsColumnConfig,
  podsColumnConfig,
  priorityClassesColumnConfig,
  replicaSetsColumnConfig,
  resourceQuotasColumnConfig,
  roleBindingsColumnConfig,
  rolesColumnConfig,
  runtimeClassesColumnConfig,
  secretsColumnConfig,
  serviceAccountsColumnConfig,
  servicesColumnConfig,
  stateSetsColumnConfig,
  storageClassesColumnConfig
} from "@/utils/ListType/ListDefinations";

import { CreateTable } from "@/components/app/Common/Hooks/Table";
import FourOFourError from "@/components/app/Errors/404Error";
import { RootState } from "@/redux/store";
import { kwList } from "@/routes";
import { updateClusterRoleBindingList } from "@/data/AccessControls/ClusterRoleBindings/ClusterRoleBindingsListSlice";
import { updateClusterRolesList } from "@/data/AccessControls/ClusterRoles/ClusterRolesListSlice";
import { updateConfigMapsList } from "@/data/Configurations/ConfigMaps/ConfigMapsSlice";
import { updateCronJobs } from "@/data/Workloads/CronJobs/CronJobsSlice";
import { updateCustomResourcesList } from "@/data/CustomResources/CustomResourcesListSlice";
import { updateDaemonSets } from "@/data/Workloads/DaemonSets/DaemonSetsSlices";
import { updateDeployments } from "@/data/Workloads/Deployments/DeploymentsSlice";
import { updateEndpointsList } from "@/data/Networks/Endpoint/EndpointListSlice";
import { updateHPAsList } from "@/data/Configurations/HPAs/HPAsListSlice";
import { updateIngressesList } from "@/data/Networks/Ingresses/IngressesListSlice";
import { updateJobs } from "@/data/Workloads/Jobs/JobsSlice";
import { updateLeasesList } from "@/data/Clusters/Leases/LeasesListSlice";
import { updateLimitRangesList } from "@/data/Configurations/LimitRange/LimitRangeListSlice";
import { updateNamspaces } from "@/data/Clusters/Namespaces/NamespacesSlice";
import { updateNodesList } from "@/data/Clusters/Nodes/NodeListSlice";
import { updatePersistentVolumeClaimsList } from "@/data/Storages/PersistentVolumeClaims/PersistentVolumeClaimsListSlice";
import { updatePersistentVolumesList } from "@/data/Storages/PersistentVolumes/PersistentVolumesListSlice";
import { updatePodDisruptionBudgetsList } from "@/data/Configurations/PodDisruptionBudgets/PodDisruptionBudgetsListSlice";
import { updatePodsList } from "@/data/Workloads/Pods/PodsSlice";
import { updatePriorityClassesList } from "@/data/Configurations/PriorityClasses/PriorityClassesListSlice";
import { updateReplicaSets } from "@/data/Workloads/ReplicaSets/ReplicaSetsSlice";
import { updateResourceQuotasList } from "@/data/Configurations/ResourceQuotas/ResourceQuotasListSlice";
import { updateRoleBindingList } from "@/data/AccessControls/RoleBindings/RoleBindingsListSlice";
import { updateRolesList } from "@/data/AccessControls/Roles/RolesListSlice";
import { updateRuntimeClassesList } from "@/data/Configurations/RuntimeClasses/RuntimeClassesListSlice";
import { updateSecretsList } from "@/data/Configurations/Secrets/SecretsListSlice";
import { updateServiceAccountsList } from "@/data/AccessControls/ServiceAccounts/ServiceAccountsListSlice";
import { updateServicesList } from "@/data/Networks/Services/ServicesListSlice";
import { updateStatefulSets } from "@/data/Workloads/StatefulSets/StatefulSetsSlice";
import { updateStorageClassesList } from "@/data/Storages/StorageClasses/StorageClassesListSlice";
import { useAppSelector } from "@/redux/hooks";

type ArrayElement<ArrayType extends readonly unknown[]> =
  ArrayType extends readonly (infer ElementType)[] ? ElementType : never;

export function KwList() {
  const { leases, loading: leasesLoading } = useAppSelector((state: RootState) => state.leases);
  const { namespaces, loading: namespacesLoading } = useAppSelector((state: RootState) => state.namespaces);
  const { nodes, loading: nodesLoading } = useAppSelector((state: RootState) => state.nodes);
  const { configMaps, loading: configMapsLoading } = useAppSelector((state: RootState) => state.configMaps);
  const { hpas, loading: hpasLoading } = useAppSelector((state: RootState) => state.hpas);
  const { limitRanges, loading: limitRagesLoading } = useAppSelector((state: RootState) => state.limitRanges);
  const { podDisruptionBudgets, loading: podDisruptionBudgetsLoading } = useAppSelector((state: RootState) => state.podDisruptionBudgets);
  const { priorityClasses, loading: priorityClassesLoading } = useAppSelector((state: RootState) => state.priorityClasses);
  const { resourceQuotas, loading: resourceQuotasLoading } = useAppSelector((state: RootState) => state.resourceQuotas);
  const { runtimeClasses, loading: runtimeClassesLoading } = useAppSelector((state: RootState) => state.runtimeClasses);
  const { secrets, loading: secretsLoading } = useAppSelector((state: RootState) => state.secrets);
  const { clusterRoleBindings, loading: clusterRoleBindingsLoading } = useAppSelector((state: RootState) => state.clusterRoleBindings);
  const { clusterRoles, loading: clusterRolesLoading } = useAppSelector((state: RootState) => state.clusterRoles);
  const { roleBindings, loading: roleBindingsLoading } = useAppSelector((state: RootState) => state.roleBindings);
  const { roles, loading: rolesLoading } = useAppSelector((state: RootState) => state.roles);
  const { serviceAccounts, loading: serviceAccountsLoading } = useAppSelector((state: RootState) => state.serviceAccounts);
  const { endpoints, loading: endpointsLoading } = useAppSelector((state: RootState) => state.endpoints);
  const { ingresses, loading: ingressesLoading } = useAppSelector((state: RootState) => state.ingresses);
  const { services, loading: servicesLoading } = useAppSelector((state: RootState) => state.services);
  const { persistentVolumes, loading: persistentVolumesLoading } = useAppSelector((state: RootState) => state.persistentVolumes);
  const { persistentVolumeClaims, loading: persistentVolumeClaimsLoading } = useAppSelector((state: RootState) => state.persistentVolumeClaims);
  const { storageClasses, loading: storageClassesLoading } = useAppSelector((state: RootState) => state.storageClasses);
  const { pods, loading: podsLoading } = useAppSelector((state: RootState) => state.pods);
  const { cronJobs, loading: cronJobsLoading } = useAppSelector((state: RootState) => state.cronJobs);
  const { daemonsets, loading: daemonsetsLoading } = useAppSelector((state: RootState) => state.daemonSets);
  const { deployments, loading: deploymentsLoading } = useAppSelector((state: RootState) => state.deployments);
  const { jobs, loading: jobsLoading } = useAppSelector((state: RootState) => state.jobs);
  const { replicaSets, loading: replicaSetsLoading } = useAppSelector((state: RootState) => state.replicaSets);
  const { statefulSets, loading: statefulSetsLoading } = useAppSelector((state: RootState) => state.statefulSets);
  const { customResourcesNavigation } = useAppSelector((state: RootState) => state.customResources);
  const { customResourcesList, loading: customResourcesListLoading } = useAppSelector((state: RootState) => state.customResourcesList);

  const { config } = kwList.useParams();
  const { cluster, resourcekind, group, kind, resource, version } = kwList.useSearch();

  const getTableData = (resourcekind: string) => {
    if (resourcekind === LEASES_ENDPOINT) {
      return getTableConfig<LeasesListHeader>(leases, LEASES_ENDPOINT, updateLeasesList, leasesLoading, leasesColumnConfig(config, cluster));
    } if (resourcekind === NAMESPACES_ENDPOINT) {
      return getTableConfig<NamespacesHeaders>(namespaces, NAMESPACES_ENDPOINT, updateNamspaces, namespacesLoading, namespacesColumnConfig(config, cluster));
    } if (resourcekind === NODES_ENDPOINT) {
      return getTableConfig<NodesListHeaders>(nodes, NODES_ENDPOINT, updateNodesList, nodesLoading, nodesColumnConfig(config, cluster));
    } if (resourcekind === CONFIG_MAPS_ENDPOINT) {
      return getTableConfig<ConfigMapsHeader>(configMaps, CONFIG_MAPS_ENDPOINT, updateConfigMapsList, configMapsLoading, configMapsColumnConfig(config, cluster));
    } if (resourcekind === HPA_ENDPOINT) {
      return getTableConfig<HPAsListHeader>(hpas, HPA_ENDPOINT, updateHPAsList, hpasLoading, hpasColumnConfig(config, cluster));
    } if (resourcekind === LIMIT_RANGE_ENDPOINT) {
      return getTableConfig<LimitRangesListHeader>(limitRanges, LIMIT_RANGE_ENDPOINT, updateLimitRangesList, limitRagesLoading, limitRangesColumnConfig(config, cluster));
    } if (resourcekind === POD_DISRUPTION_BUDGETS_ENDPOINT) {
      return getTableConfig<PodDisruptionBudgetsHeader>(podDisruptionBudgets, POD_DISRUPTION_BUDGETS_ENDPOINT, updatePodDisruptionBudgetsList, podDisruptionBudgetsLoading, podDisruptionBudgetsColumnConfig(config, cluster));
    } if (resourcekind === PRIORITY_CLASSES_ENDPOINT) {
      return getTableConfig<PriorityClassesHeaders>(priorityClasses, PRIORITY_CLASSES_ENDPOINT, updatePriorityClassesList, priorityClassesLoading, priorityClassesColumnConfig(config, cluster));
    } if (resourcekind === RESOURCE_QUOTAS_ENDPOINT) {
      return getTableConfig<ResourceQuotasHeaders>(resourceQuotas, RESOURCE_QUOTAS_ENDPOINT, updateResourceQuotasList, resourceQuotasLoading, resourceQuotasColumnConfig(config, cluster));
    } if (resourcekind === RUNTIME_CLASSES_ENDPOINT) {
      return getTableConfig<RuntimeClassesHeader>(runtimeClasses, RUNTIME_CLASSES_ENDPOINT, updateRuntimeClassesList, runtimeClassesLoading, runtimeClassesColumnConfig(config, cluster));
    } if (resourcekind === SECRETS_ENDPOINT) {
      return getTableConfig<SecretsListHeader>(secrets, SECRETS_ENDPOINT, updateSecretsList, secretsLoading, secretsColumnConfig(config, cluster));
    } if (resourcekind === CLUSTER_ROLE_BINDINGS_ENDPOINT) {
      return getTableConfig<ClusterRoleBindingsListHeader>(clusterRoleBindings, CLUSTER_ROLE_BINDINGS_ENDPOINT, updateClusterRoleBindingList, clusterRoleBindingsLoading, clusterRoleBindingsColumnConfig(config, cluster));
    } if (resourcekind === CLUSTER_ROLES_ENDPOINT) {
      return getTableConfig<ClusterRolesListHeader>(clusterRoles, CLUSTER_ROLES_ENDPOINT, updateClusterRolesList, clusterRolesLoading, clusterRolesColumnConfig(config, cluster));
    } if (resourcekind === ROLE_BINDINGS_ENDPOINT) {
      return getTableConfig<RoleBindingsListHeader>(roleBindings, ROLE_BINDINGS_ENDPOINT, updateRoleBindingList, roleBindingsLoading, roleBindingsColumnConfig(config, cluster));
    } if (resourcekind === ROLES_ENDPOINT) {
      return getTableConfig<RolesListHeader>(roles, ROLES_ENDPOINT, updateRolesList, rolesLoading, rolesColumnConfig(config, cluster));
    } if (resourcekind === SERVICE_ACCOUNTS_ENDPOINT) {
      return getTableConfig<ServiceAccountsListHeader>(serviceAccounts, SERVICE_ACCOUNTS_ENDPOINT, updateServiceAccountsList, serviceAccountsLoading, serviceAccountsColumnConfig(config, cluster));
    } if (resourcekind === ENDPOINTS_ENDPOINT) {
      return getTableConfig<EndpointsHeaders>(endpoints, ENDPOINTS_ENDPOINT, updateEndpointsList, endpointsLoading, endpointsColumnConfig(config, cluster));
    } if (resourcekind === INGRESSES_ENDPOINT) {
      return getTableConfig<IngressesHeaders>(ingresses, INGRESSES_ENDPOINT, updateIngressesList, ingressesLoading, ingressesColumnConfig(config, cluster));
    } if (resourcekind === SERVICES_ENDPOINT) {
      return getTableConfig<ServicesListHeaders>(services, SERVICES_ENDPOINT, updateServicesList, servicesLoading, servicesColumnConfig(config, cluster));
    } if (resourcekind === PERSISTENT_VOLUMES_ENDPOINT) {
      return getTableConfig<PersistentVolumesHeaders>(persistentVolumes, PERSISTENT_VOLUMES_ENDPOINT, updatePersistentVolumesList, persistentVolumesLoading, persistentVolumesColumnConfig(config, cluster));
    } if (resourcekind === PERSISTENT_VOLUME_CLAIMS_ENDPOINT) {
      return getTableConfig<PersistentVolumeClaimsHeaders>(persistentVolumeClaims, PERSISTENT_VOLUME_CLAIMS_ENDPOINT, updatePersistentVolumeClaimsList, persistentVolumeClaimsLoading, persistentVolumeClaimsColumnConfig(config, cluster));
    } if (resourcekind === STORAGE_CLASSES_ENDPOINT) {
      return getTableConfig<StorageClassesHeaders>(storageClasses, STORAGE_CLASSES_ENDPOINT, updateStorageClassesList, storageClassesLoading, storageClassesColumnConfig(config, cluster));
    } if (resourcekind === PODS_ENDPOINT) {
      return getTableConfig<PodsHeaders>(pods, PODS_ENDPOINT, updatePodsList, podsLoading, podsColumnConfig(config, cluster));
    } if (resourcekind === CRON_JOBS_ENDPOINT) {
      return getTableConfig<CronJobsHeader>(cronJobs, CRON_JOBS_ENDPOINT, updateCronJobs, cronJobsLoading, cronJobsColumnConfig(config, cluster));
    } if (resourcekind === DAEMON_SETS_ENDPOINT) {
      return getTableConfig<DaemonSetsHeader>(daemonsets, DAEMON_SETS_ENDPOINT, updateDaemonSets, daemonsetsLoading, daemonSetsColumnConfig(config, cluster));
    } if (resourcekind === DEPLOYMENT_ENDPOINT) {
      return getTableConfig<DeploymentsTableHeaders>(deployments, DEPLOYMENT_ENDPOINT, updateDeployments, deploymentsLoading, deploymentsColumnConfig(config, cluster));
    } if (resourcekind === JOBS_ENDPOINT) {
      return getTableConfig<JobsHeader>(jobs, JOBS_ENDPOINT, updateJobs, jobsLoading, jobsColumnConfig(config, cluster));
    } if (resourcekind === REPLICA_SETS_ENDPOINT) {
      return getTableConfig<ReplicaSetsHeader>(replicaSets, REPLICA_SETS_ENDPOINT, updateReplicaSets, replicaSetsLoading, replicaSetsColumnConfig(config, cluster));
    } if (resourcekind === STATEFUL_SETS_ENDPOINT) {
      return getTableConfig<StatefulSetsHeader>(statefulSets, STATEFUL_SETS_ENDPOINT, updateStatefulSets, statefulSetsLoading, stateSetsColumnConfig(config, cluster));
    } if (resourcekind === CUSTOM_RESOURCES_LIST_ENDPOINT) {
      const additionalPrinterColumns = customResourcesNavigation[group||'']?.resources.filter(({name}) => name === kind) || [];
      return getTableConfig<CustomResourceHeaders>(customResourcesList.list, CUSTOM_RESOURCES_LIST_ENDPOINT, updateCustomResourcesList, customResourcesListLoading, customResourcesColumnConfig(additionalPrinterColumns[0]?.additionalPrinterColumns, config, cluster, customResourcesListLoading, group, kind, resource, version));
    }
    return;
  };

  const tableData = getTableData(resourcekind);

  if (!tableData) {
    return <FourOFourError />;
  }

  document.title = `kubewall - ${tableData.instaceType}`;
  return (
    <CreateTable
      clusterName={cluster}
      configName={config}
      headersList={tableData.headersList as HeaderList[]}
      loading={tableData.loading}
      count={tableData.data.length}
      data={tableData.data as ArrayElement<typeof tableData.data>[]}
      queryParmObject={tableData.queryParams}
      instanceType={tableData.instaceType}
      endpoint={tableData.instaceType}
      dispatchMethod={tableData.dispatchMethod}
      showNamespaceFilter={tableData.showNamespaceFilter}
    />
  );
}
