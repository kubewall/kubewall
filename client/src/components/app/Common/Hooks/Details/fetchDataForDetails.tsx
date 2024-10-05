import { CLUSTER_ROLES_ENDPOINT, CLUSTER_ROLE_BINDINGS_ENDPOINT, CONFIG_MAPS_ENDPOINT, CRON_JOBS_ENDPOINT, CUSTOM_RESOURCES_ENDPOINT, CUSTOM_RESOURCES_LIST_ENDPOINT, DAEMON_SETS_ENDPOINT, DEPLOYMENT_ENDPOINT, ENDPOINTS_ENDPOINT, HPA_ENDPOINT, INGRESSES_ENDPOINT, JOBS_ENDPOINT, LEASES_ENDPOINT, LIMIT_RANGE_ENDPOINT, NAMESPACES_ENDPOINT, NODES_ENDPOINT, PERSISTENT_VOLUMES_ENDPOINT, PERSISTENT_VOLUME_CLAIMS_ENDPOINT, PODS_ENDPOINT, POD_DISRUPTION_BUDGETS_ENDPOINT, PRIORITY_CLASSES_ENDPOINT, REPLICA_SETS_ENDPOINT, RESOURCE_QUOTAS_ENDPOINT, ROLES_ENDPOINT, ROLE_BINDINGS_ENDPOINT, RUNTIME_CLASSES_ENDPOINT, SECRETS_ENDPOINT, SERVICES_ENDPOINT, SERVICE_ACCOUNTS_ENDPOINT, STATEFUL_SETS_ENDPOINT, STORAGE_CLASSES_ENDPOINT } from "@/constants";
import { useAppDispatch, useAppSelector } from "@/redux/hooks";

import { ActionCreatorWithPayload } from "@reduxjs/toolkit";
import { RootState } from "@/redux/store";
import { getEventStreamUrl } from "@/utils";
import { updateClusterRoleBindingDetails } from "@/data/AccessControls/ClusterRoleBindings/ClusterRoleBindingDetailsSlice";
import { updateClusterRoleDetails } from "@/data/AccessControls/ClusterRoles/ClusterRoleDetailsSlice";
import { updateConfigMapDetails } from "@/data/Configurations/ConfigMaps/ConfigMapDetailsSlice";
import { updateCronJobDetails } from "@/data/Workloads/CronJobs/CronJobDetailsSlice";
import { updateCustomResourceDetails } from "@/data/CustomResources/CustomResourcesDetailsSlice";
import { updateCustomResourcesDefinitionDetails } from "@/data/CustomResources/CustomResourcesDefinitionDetailsSlice";
import { updateDaemonSetDetails } from "@/data/Workloads/DaemonSets/DaemonSetDetailsSlice";
import { updateDeploymentsDetails } from "@/data/Workloads/Deployments/DeploymentDetailsSlice";
import { updateEndpointDetails } from "@/data/Networks/Endpoint/EndpointDetailsSlice";
import { updateHPADetails } from "@/data/Configurations/HPAs/HPADetailsSlice";
import { updateIngressDetails } from "@/data/Networks/Ingresses/IngressDetailsSlice";
import { updateJobDetails } from "@/data/Workloads/Jobs/JobDetailsSlice";
import { updateLeaseDetails } from "@/data/Clusters/Leases/LeaseDetailsSlice";
import { updateLimitRangeDetails } from "@/data/Configurations/LimitRange/LimitRangeDetailsSlice";
import { updateNamespaceDetails } from "@/data/Clusters/Namespaces/NamespaceDetailsSlice";
import { updateNodeDetails } from "@/data/Clusters/Nodes/NodeDetailsSlice";
import { updatePersistentVolumeClaimDetails } from "@/data/Storages/PersistentVolumeClaims/PersistentVolumeClaimDetailsSlice";
import { updatePersistentVolumeDetails } from "@/data/Storages/PersistentVolumes/PersistentVolumeDetailsSlice";
import { updatePodDetails } from "@/data/Workloads/Pods/PodDetailsSlice";
import { updatePodDisruptionBudgetDetails } from "@/data/Configurations/PodDisruptionBudgets/PodDisruptionBudgetDetailsSlice";
import { updatePriorityClassDetails } from "@/data/Configurations/PriorityClasses/PriorityClassDetailsSlice";
import { updateReplicaSetDetails } from "@/data/Workloads/ReplicaSets/ReplicaSetDetailsSlice";
import { updateResourceQuotaDetails } from "@/data/Configurations/ResourceQuotas/ResourceQuotaDetailsSlice";
import { updateRoleBindingDetails } from "@/data/AccessControls/RoleBindings/RoleBindingDetailsSlice";
import { updateRoleDetails } from "@/data/AccessControls/Roles/RolesDetailsSlice";
import { updateRuntimeClassDetails } from "@/data/Configurations/RuntimeClasses/RuntimeClassDetailsSlice";
import { updateSecretDetails } from "@/data/Configurations/Secrets/SecretsDetailsSlice";
import { updateServiceAccountDetails } from "@/data/AccessControls/ServiceAccounts/ServiceAccountDetailsSlice";
import { updateServiceDetails } from "@/data/Networks/Services/ServiceDetailSlice";
import { updateStatefulSetDetails } from "@/data/Workloads/StatefulSets/StatefulSetDetailsSlice";
import { updateStorageClassDetails } from "@/data/Storages/StorageClasses/StorageClassDetailsSlice";
import { useEventSource } from "../EventSource";

type FetchDataForDetailsProps = {
  config: string;
  cluster: string;
  resourcekind: string;
  resourcename: string;
  group?: string;
  kind?: string;
  resource?: string;
  version?: string;
  namespace?: string;
}
const useFetchDataForDetails = ({
  cluster,
  config,
  group,
  kind,
  resource,
  resourcekind,
  resourcename,
  version,
  namespace = '',
}: FetchDataForDetailsProps) => {
  const { loading: podDetailsLoading } = useAppSelector((state: RootState) => state.podDetails);
  const { loading: nodeDetailsLoading } = useAppSelector((state: RootState) => state.nodeDetails);
  const { loading: namespaceDetailsLoading } = useAppSelector((state: RootState) => state.namespaceDetails);
  const { loading: leaseDetailsLoading } = useAppSelector((state: RootState) => state.leaseDetails);
  const { loading: deploymentDetailsLoading } = useAppSelector((state: RootState) => state.deploymentDetails);
  const { loading: daemonSetDetailsLoading } = useAppSelector((state: RootState) => state.daemonSetDetails);
  const { loading: statefulSetDetailsLoading } = useAppSelector((state: RootState) => state.statefulSetDetails);
  const { loading: replicaSetDetailsLoading } = useAppSelector((state: RootState) => state.replicaSetDetails);
  const { loading: jobDetailsLoading } = useAppSelector((state: RootState) => state.jobDetails);
  const { loading: cronJobDetailsLoading } = useAppSelector((state: RootState) => state.cronJobDetails);
  const { loading: secretDetailsLoading } = useAppSelector((state: RootState) => state.secretsDetails);
  const { loading: configMapDetailsLoading } = useAppSelector((state: RootState) => state.configMapDetails);
  const { loading: hpaDetailsLoading } = useAppSelector((state: RootState) => state.hpaDetails);
  const { loading: limitRangeDetailsLoading } = useAppSelector((state: RootState) => state.limitRangeDetails);
  const { loading: resourceQuotaDetailsLoading } = useAppSelector((state: RootState) => state.resourceQuotaDetails);
  const { loading: priorityClassDetailsLoading } = useAppSelector((state: RootState) => state.priorityClassDetails);
  const { loading: runtimeClassDetailsLoading } = useAppSelector((state: RootState) => state.runtimeClassDetails);
  const { loading: podDisruptionBudgetDetailsLoading } = useAppSelector((state: RootState) => state.podDisruptionBudgetDetails);
  const { loading: serviceAccountDetailsLoading } = useAppSelector((state: RootState) => state.serviceAccountDetails);
  const { loading: roleDetailsLoading } = useAppSelector((state: RootState) => state.roleDetails);
  const { loading: roleBindingDetailsLoading } = useAppSelector((state: RootState) => state.roleBindingDetails);
  const { loading: clusterRoleDetailsLoading } = useAppSelector((state: RootState) => state.clusterRoleDetails);
  const { loading: clusterRoleBindingDetailsLoading } = useAppSelector((state: RootState) => state.clusterRoleBindingDetails);
  const { loading:  serviceDetailsLoading } = useAppSelector((state: RootState) => state.serviceDetails);
  const { loading:  ingressDetailsLoading } = useAppSelector((state: RootState) => state.ingressDetails);
  const { loading:  endpointDetailsLoading } = useAppSelector((state: RootState) => state.endpointDetails);
  const { loading: persistentVolumeClaimDetailsLoading } = useAppSelector((state: RootState) => state.persistentVolumeClaimDetails);
  const { loading: persistentVolumeDetailsLoading } = useAppSelector((state: RootState) => state.persistentVolumeDetails);
  const { loading: storageClassDetailsLoading } = useAppSelector((state: RootState) => state.storageClassDetails);
  const { loading: customResourceDetailsLoading } = useAppSelector((state: RootState) => state.customResourceDetails);
  const { loading: customResourcesDefintionsDetailsLoading } = useAppSelector((state: RootState) => state.customResourcesDefinitionDetails);
  const dispatch = useAppDispatch();

  type DataType = {
    label: string;
    // eslint-disable-next-line  @typescript-eslint/no-explicit-any
    dispatchMethod: ActionCreatorWithPayload<any, string>;
    loading: boolean;
    endpoint: string;
  }
  let data: null | DataType;
  if (resourcekind === NODES_ENDPOINT) {
    data = { label: 'Nodes', dispatchMethod: updateNodeDetails, loading: nodeDetailsLoading, endpoint: NODES_ENDPOINT };
  } else if (resourcekind === NAMESPACES_ENDPOINT) {
    data = { label: 'Namespaces', dispatchMethod: updateNamespaceDetails, loading: namespaceDetailsLoading, endpoint: NAMESPACES_ENDPOINT };
  } else if (resourcekind === LEASES_ENDPOINT) {
    data = { label: 'Leases', dispatchMethod: updateLeaseDetails, loading: leaseDetailsLoading, endpoint: LEASES_ENDPOINT };
  } else if (resourcekind === PODS_ENDPOINT) {
    data = { label: 'Pods', dispatchMethod: updatePodDetails, loading: podDetailsLoading, endpoint: PODS_ENDPOINT };
  } else if (resourcekind === DEPLOYMENT_ENDPOINT) {
    data = { label: 'Deployments', dispatchMethod: updateDeploymentsDetails, loading: deploymentDetailsLoading, endpoint: DEPLOYMENT_ENDPOINT };
  } else if (resourcekind === DAEMON_SETS_ENDPOINT) {
    data = { label: 'DaemonSets', dispatchMethod: updateDaemonSetDetails, loading: daemonSetDetailsLoading, endpoint: DAEMON_SETS_ENDPOINT };
  } else if (resourcekind === STATEFUL_SETS_ENDPOINT) {
    data = { label: 'StatefulSets', dispatchMethod: updateStatefulSetDetails, loading: statefulSetDetailsLoading, endpoint: STATEFUL_SETS_ENDPOINT };
  } else if (resourcekind === REPLICA_SETS_ENDPOINT) {
    data = { label: 'ReplicaSets', dispatchMethod: updateReplicaSetDetails, loading: replicaSetDetailsLoading, endpoint: REPLICA_SETS_ENDPOINT };
  } else if (resourcekind === JOBS_ENDPOINT) {
    data = { label: 'Jobs', dispatchMethod: updateJobDetails, loading: jobDetailsLoading, endpoint: JOBS_ENDPOINT };
  } else if (resourcekind === CRON_JOBS_ENDPOINT) {
    data = { label: 'CronJobs', dispatchMethod: updateCronJobDetails, loading: cronJobDetailsLoading, endpoint: CRON_JOBS_ENDPOINT };
  } else if (resourcekind === SECRETS_ENDPOINT) {
    data = { label: 'Secrets', dispatchMethod: updateSecretDetails, loading: secretDetailsLoading, endpoint: SECRETS_ENDPOINT };
  } else if (resourcekind === CONFIG_MAPS_ENDPOINT) {
    data = { label: 'ConfigMaps', dispatchMethod: updateConfigMapDetails, loading: configMapDetailsLoading, endpoint: CONFIG_MAPS_ENDPOINT };
  } else if (resourcekind === HPA_ENDPOINT) {
    data = { label: 'HPA', dispatchMethod: updateHPADetails, loading: hpaDetailsLoading, endpoint: HPA_ENDPOINT };
  } else if (resourcekind === LIMIT_RANGE_ENDPOINT) {
    data = { label: 'Limit Ranges', dispatchMethod: updateLimitRangeDetails, loading: limitRangeDetailsLoading, endpoint: LIMIT_RANGE_ENDPOINT };
  } else if (resourcekind === RESOURCE_QUOTAS_ENDPOINT) {
    data = { label: 'Resource Quotas', dispatchMethod: updateResourceQuotaDetails, loading: resourceQuotaDetailsLoading, endpoint: RESOURCE_QUOTAS_ENDPOINT };
  } else if (resourcekind === PRIORITY_CLASSES_ENDPOINT) {
    data = { label: 'Priority Classes', dispatchMethod: updatePriorityClassDetails, loading: priorityClassDetailsLoading, endpoint: PRIORITY_CLASSES_ENDPOINT };
  } else if (resourcekind === RUNTIME_CLASSES_ENDPOINT) {
    data = { label: 'Runtime Classes', dispatchMethod: updateRuntimeClassDetails, loading: runtimeClassDetailsLoading, endpoint: RUNTIME_CLASSES_ENDPOINT };
  } else if (resourcekind === POD_DISRUPTION_BUDGETS_ENDPOINT) {
    data = { label: 'Pod Distruption Budgets', dispatchMethod: updatePodDisruptionBudgetDetails, loading: podDisruptionBudgetDetailsLoading, endpoint: POD_DISRUPTION_BUDGETS_ENDPOINT };
  } else if (resourcekind === SERVICE_ACCOUNTS_ENDPOINT) {
    data = { label: 'Service Accounts', dispatchMethod: updateServiceAccountDetails, loading: serviceAccountDetailsLoading, endpoint: SERVICE_ACCOUNTS_ENDPOINT };
  } else if (resourcekind === ROLES_ENDPOINT) {
    data = { label: 'Roles', dispatchMethod: updateRoleDetails, loading: roleDetailsLoading, endpoint: ROLES_ENDPOINT };
  } else if (resourcekind === ROLE_BINDINGS_ENDPOINT) {
    data = { label: 'Role Bindings', dispatchMethod: updateRoleBindingDetails, loading: roleBindingDetailsLoading, endpoint: ROLE_BINDINGS_ENDPOINT };
  } else if (resourcekind === CLUSTER_ROLES_ENDPOINT) {
    data = { label: 'Cluster Roles', dispatchMethod: updateClusterRoleDetails, loading: clusterRoleDetailsLoading, endpoint: CLUSTER_ROLES_ENDPOINT };
  } else if (resourcekind === CLUSTER_ROLE_BINDINGS_ENDPOINT) {
    data = { label: 'Cluster Role Bindings', dispatchMethod: updateClusterRoleBindingDetails, loading: clusterRoleBindingDetailsLoading, endpoint: CLUSTER_ROLE_BINDINGS_ENDPOINT };
  } else if (resourcekind === SERVICES_ENDPOINT) {
    data = { label: 'Services', dispatchMethod: updateServiceDetails, loading: serviceDetailsLoading, endpoint: SERVICES_ENDPOINT };
  } else if (resourcekind === INGRESSES_ENDPOINT) {
    data = { label: 'Ingresses', dispatchMethod: updateIngressDetails, loading: ingressDetailsLoading, endpoint: INGRESSES_ENDPOINT };
  } else if (resourcekind === ENDPOINTS_ENDPOINT) {
    data = { label: 'Endpoints', dispatchMethod: updateEndpointDetails, loading: endpointDetailsLoading, endpoint: ENDPOINTS_ENDPOINT };
  } else if (resourcekind === PERSISTENT_VOLUME_CLAIMS_ENDPOINT) {
    data = { label: 'Persistent Volume Claims', dispatchMethod: updatePersistentVolumeClaimDetails, loading: persistentVolumeClaimDetailsLoading, endpoint: PERSISTENT_VOLUME_CLAIMS_ENDPOINT };
  } else if (resourcekind === PERSISTENT_VOLUMES_ENDPOINT) {
    data = { label: 'Persistent Volumes', dispatchMethod: updatePersistentVolumeDetails, loading: persistentVolumeDetailsLoading, endpoint: PERSISTENT_VOLUMES_ENDPOINT };
  } else if (resourcekind === STORAGE_CLASSES_ENDPOINT) {
    data = { label: 'Storage Classes', dispatchMethod: updateStorageClassDetails, loading: storageClassDetailsLoading, endpoint: STORAGE_CLASSES_ENDPOINT };
  } else if (resourcekind === CUSTOM_RESOURCES_LIST_ENDPOINT) {
    data = { label: 'Custom Resources', dispatchMethod: updateCustomResourceDetails, loading: customResourceDetailsLoading, endpoint: `${CUSTOM_RESOURCES_LIST_ENDPOINT}${namespace ? `/${namespace}`: ''}` };
  } else if (resourcekind === CUSTOM_RESOURCES_ENDPOINT) {
    data = { label: 'Custom Resources Definitions', dispatchMethod: updateCustomResourcesDefinitionDetails, loading: customResourcesDefintionsDetailsLoading, endpoint: `${CUSTOM_RESOURCES_ENDPOINT}${namespace ? `/${namespace}`: ''}` };
  }  else {
    data = null;
  }

  let queryParamObject: Record<string, string> = { cluster, config };
  if (resourcekind === CUSTOM_RESOURCES_LIST_ENDPOINT) {
    queryParamObject = {
      cluster,
      config,
      group: group || '',
      kind: kind || '',
      resource: resource || '',
      version: version || ''
    };
  } else if(resourcekind !== NAMESPACES_ENDPOINT) {
    queryParamObject = {
      ...queryParamObject,
      namespace
    };
  }
  const sendMessage = (message: object[]) => {
    if(data) {
      dispatch(data.dispatchMethod(message));
    }
  };

  useEventSource({
    url: getEventStreamUrl(data?.endpoint, queryParamObject, `/${resourcename}`),
    sendMessage,
  });

  if(!data) {
    return null;
  }

  return (
    {
      loading: data.loading,
      label: data.label
    }
  );
};

export {
  useFetchDataForDetails
};