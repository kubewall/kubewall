import { CLUSTER_ROLES_ENDPOINT, CLUSTER_ROLE_BINDINGS_ENDPOINT, CONFIG_MAPS_ENDPOINT, CRON_JOBS_ENDPOINT, CUSTOM_RESOURCES_ENDPOINT, CUSTOM_RESOURCES_LIST_ENDPOINT, DAEMON_SETS_ENDPOINT, DEPLOYMENT_ENDPOINT, ENDPOINTS_ENDPOINT, HPA_ENDPOINT, INGRESSES_ENDPOINT, JOBS_ENDPOINT, LEASES_ENDPOINT, LIMIT_RANGE_ENDPOINT, NAMESPACES_ENDPOINT, NODES_ENDPOINT, PERSISTENT_VOLUMES_ENDPOINT, PERSISTENT_VOLUME_CLAIMS_ENDPOINT, PODS_ENDPOINT, POD_DISRUPTION_BUDGETS_ENDPOINT, PRIORITY_CLASSES_ENDPOINT, REPLICA_SETS_ENDPOINT, RESOURCE_QUOTAS_ENDPOINT, ROLES_ENDPOINT, ROLE_BINDINGS_ENDPOINT, RUNTIME_CLASSES_ENDPOINT, SECRETS_ENDPOINT, SERVICES_ENDPOINT, SERVICE_ACCOUNTS_ENDPOINT, STATEFUL_SETS_ENDPOINT, STORAGE_CLASSES_ENDPOINT } from "@/constants";
import { ClusterRoleBindingDetailsContainer, ClusterRoleDetailsContainer, ConfigMapDetailsContainer, CustomResourceDetailsContainer, DeploymentDetailsContainer, EndpointDetailsContainer, LimitRangeDetailsContainer, NamespaceDetailsContainer, NodeDetailsContainer, PodDetailsContainer, PodDisruptionBudgetDetailsContainer, ResourceQuotaDetailsContainer, RoleBindingDetailsContainer, RoleDetailsContainer, RuntimeClassDetailsContainer, SecretDetailsContainer, ServiceAccountDetailsContainer, ServiceDetailsContainer } from "@/components/app/MiscDetailsContainer";
import { getClusterRoleBindingDetailsConfig, getClusterRoleDetailsConfig, getConfigMapDetailsConfig, getCronJobsDetailsConfig, getCustomResourceDefinitionsDetailsConfig, getCustomResourceDetailsConfig, getDaemonSetDetailsConfig, getDeploymentDetailsConfig, getEndpointDetailsConfig, getHPADetailsConfig, getIngressDetailsConfig, getJobsDetailsConfig, getLeaseDetailsConfig, getLimitRangeDetailsConfig, getNamespaceDetailsConfig, getNodeDetailsConfig, getPersistentVolumeClaimDetailsConfig, getPersistentVolumeDetailsConfig, getPodDetailsConfig, getPodDisruptionBudgetDetailsConfig, getPriorityClassDetailsConfig, getReplicaSetDetailsConfig, getResourceQuotaDetailsConfig, getRoleBindingDetailsConfig, getRoleDetailsConfig, getRuntimeClassDetailsConfig, getSecretDetailsConfig, getServiceAccountDetailsConfig, getServiceDetailsConfig, getStatefulSetDetailsConfig, getStorageClassDetailsConfig } from "@/utils/DetailType/DetailDefinations";

import { RootState } from "@/redux/store";
import { useAppSelector } from "@/redux/hooks";

type DetailsWapperProps = {
  loading: boolean;
  resourcekind: string;
}
const useDetailsWrapper = ({ loading, resourcekind }: DetailsWapperProps) => {
  const { nodeDetails } = useAppSelector((state: RootState) => state.nodeDetails);
  const { namespaceDetails } = useAppSelector((state: RootState) => state.namespaceDetails);
  const { leaseDetails } = useAppSelector((state: RootState) => state.leaseDetails);
  const { podDetails } = useAppSelector((state: RootState) => state.podDetails);
  const { deploymentDetails } = useAppSelector((state: RootState) => state.deploymentDetails);
  const { daemonSetDetails } = useAppSelector((state: RootState) => state.daemonSetDetails);
  const { statefulSetDetails } = useAppSelector((state: RootState) => state.statefulSetDetails);
  const { replicaSetDetails } = useAppSelector((state: RootState) => state.replicaSetDetails);
  const { jobDetails } = useAppSelector((state: RootState) => state.jobDetails);
  const { cronJobDetails } = useAppSelector((state: RootState) => state.cronJobDetails);
  const { secretsDetails } = useAppSelector((state: RootState) => state.secretsDetails);
  const { configMapDetails } = useAppSelector((state: RootState) => state.configMapDetails);
  const { hpaDetails } = useAppSelector((state: RootState) => state.hpaDetails);
  const { limitRangeDetails } = useAppSelector((state: RootState) => state.limitRangeDetails);
  const { resourceQuotaDetails } = useAppSelector((state: RootState) => state.resourceQuotaDetails);
  const { priorityClassDetails } = useAppSelector((state: RootState) => state.priorityClassDetails);
  const { runtimeClassDetails } = useAppSelector((state: RootState) => state.runtimeClassDetails);
  const { podDisruptionBudgetDetails } = useAppSelector((state: RootState) => state.podDisruptionBudgetDetails);
  const { serviceAccountDetails } = useAppSelector((state: RootState) => state.serviceAccountDetails);
  const { roleDetails } = useAppSelector((state: RootState) => state.roleDetails);
  const { roleBindingDetails } = useAppSelector((state: RootState) => state.roleBindingDetails);
  const { clusterRoleDetails } = useAppSelector((state: RootState) => state.clusterRoleDetails);
  const { clusterRoleBindingDetails } = useAppSelector((state: RootState) => state.clusterRoleBindingDetails);
  const { serviceDetails } = useAppSelector((state: RootState) => state.serviceDetails);
  const { ingressDetails } = useAppSelector((state: RootState) => state.ingressDetails);
  const { endpointDetails } = useAppSelector((state: RootState) => state.endpointDetails);
  const { persistentVolumeClaimDetails } = useAppSelector((state: RootState) => state.persistentVolumeClaimDetails);
  const { persistentVolumeDetails } = useAppSelector((state: RootState) => state.persistentVolumeDetails);
  const { storageClassDetails } = useAppSelector((state: RootState) => state.storageClassDetails);
  const { customResourceDetails } = useAppSelector((state: RootState) => state.customResourceDetails);
  const { customResourcesDefinitionDetails } = useAppSelector((state: RootState) => state.customResourcesDefinitionDetails);


  if (loading) return;

  if (resourcekind === NODES_ENDPOINT) {
    return { ...getNodeDetailsConfig(nodeDetails, loading), miscComponent: <NodeDetailsContainer /> };
  }
  if (resourcekind === NAMESPACES_ENDPOINT) {
    return { ...getNamespaceDetailsConfig(namespaceDetails, loading), miscComponent: <NamespaceDetailsContainer/> };
  }
  if (resourcekind === LEASES_ENDPOINT) {
    return { ...getLeaseDetailsConfig(leaseDetails, loading), miscComponent: <></> };
  }
  if (resourcekind === PODS_ENDPOINT) {
    return { ...getPodDetailsConfig(podDetails, loading), miscComponent: <PodDetailsContainer/> };
  }
  if (resourcekind === DEPLOYMENT_ENDPOINT) {
    return { ...getDeploymentDetailsConfig(deploymentDetails, loading), miscComponent: <DeploymentDetailsContainer/> };
  }
  if (resourcekind === DAEMON_SETS_ENDPOINT) {
    return { ...getDaemonSetDetailsConfig(daemonSetDetails, loading), miscComponent: <></> };
  }
  if (resourcekind === STATEFUL_SETS_ENDPOINT) {
    return { ...getStatefulSetDetailsConfig(statefulSetDetails, loading), miscComponent: <></> };
  }
  if (resourcekind === REPLICA_SETS_ENDPOINT) {
    return { ...getReplicaSetDetailsConfig(replicaSetDetails, loading), miscComponent: <></> };
  }
  if (resourcekind === JOBS_ENDPOINT) {
    return { ...getJobsDetailsConfig(jobDetails, loading), miscComponent: <></> };
  }
  if (resourcekind === CRON_JOBS_ENDPOINT) {
    return { ...getCronJobsDetailsConfig(cronJobDetails, loading), miscComponent: <></> };
  }
  if (resourcekind === SECRETS_ENDPOINT) {
    return { ...getSecretDetailsConfig(secretsDetails, loading), miscComponent: <SecretDetailsContainer/> };
  }
  if (resourcekind === CONFIG_MAPS_ENDPOINT) {
    return { ...getConfigMapDetailsConfig(configMapDetails, loading), miscComponent: <ConfigMapDetailsContainer/> };
  }
  if (resourcekind === HPA_ENDPOINT) {
    return { ...getHPADetailsConfig(hpaDetails, loading), miscComponent: <></> };
  }
  if (resourcekind === LIMIT_RANGE_ENDPOINT) {
    return { ...getLimitRangeDetailsConfig(limitRangeDetails, loading), miscComponent: <LimitRangeDetailsContainer/> };
  }
  if (resourcekind === RESOURCE_QUOTAS_ENDPOINT) {
    return { ...getResourceQuotaDetailsConfig(resourceQuotaDetails, loading), miscComponent: <ResourceQuotaDetailsContainer/> };
  }
  if (resourcekind === PRIORITY_CLASSES_ENDPOINT) {
    return { ...getPriorityClassDetailsConfig(priorityClassDetails, loading), miscComponent: <></> };
  }
  if (resourcekind === RUNTIME_CLASSES_ENDPOINT) {
    return { ...getRuntimeClassDetailsConfig(runtimeClassDetails, loading), miscComponent: <RuntimeClassDetailsContainer/> };
  }
  if (resourcekind === POD_DISRUPTION_BUDGETS_ENDPOINT) {
    return { ...getPodDisruptionBudgetDetailsConfig(podDisruptionBudgetDetails, loading), miscComponent: <PodDisruptionBudgetDetailsContainer/> };
  }
  if (resourcekind === SERVICE_ACCOUNTS_ENDPOINT) {
    return { ...getServiceAccountDetailsConfig(serviceAccountDetails, loading), miscComponent: <ServiceAccountDetailsContainer/> };
  }
  if (resourcekind === ROLES_ENDPOINT) {
    return { ...getRoleDetailsConfig(roleDetails, loading), miscComponent: <RoleDetailsContainer/> };
  }
  if (resourcekind === ROLE_BINDINGS_ENDPOINT) {
    return { ...getRoleBindingDetailsConfig(roleBindingDetails, loading), miscComponent: <RoleBindingDetailsContainer/> };
  }
  if (resourcekind === CLUSTER_ROLES_ENDPOINT) {
    return { ...getClusterRoleDetailsConfig(clusterRoleDetails, loading), miscComponent: <ClusterRoleDetailsContainer/> };
  }
  if (resourcekind === CLUSTER_ROLE_BINDINGS_ENDPOINT) {
    return { ...getClusterRoleBindingDetailsConfig(clusterRoleBindingDetails, loading), miscComponent: <ClusterRoleBindingDetailsContainer/> };
  }
  if (resourcekind === SERVICES_ENDPOINT) {
    return { ...getServiceDetailsConfig(serviceDetails, loading), miscComponent: <ServiceDetailsContainer/> };
  }
  if (resourcekind === INGRESSES_ENDPOINT) {
    return { ...getIngressDetailsConfig(ingressDetails, loading), miscComponent: <></> };
  }
  if (resourcekind === ENDPOINTS_ENDPOINT) {
    return { ...getEndpointDetailsConfig(endpointDetails, loading), miscComponent: <EndpointDetailsContainer/> };
  }
  if (resourcekind === PERSISTENT_VOLUME_CLAIMS_ENDPOINT) {
    return { ...getPersistentVolumeClaimDetailsConfig(persistentVolumeClaimDetails, loading), miscComponent: <></> };
  }
  if (resourcekind === PERSISTENT_VOLUMES_ENDPOINT) {
    return { ...getPersistentVolumeDetailsConfig(persistentVolumeDetails, loading), miscComponent: <></> };
  }
  if (resourcekind === STORAGE_CLASSES_ENDPOINT) {
    return { ...getStorageClassDetailsConfig(storageClassDetails, loading), miscComponent: <></> };
  }
  if (resourcekind === CUSTOM_RESOURCES_LIST_ENDPOINT) {
    return { ...getCustomResourceDetailsConfig(customResourceDetails, loading), miscComponent: <CustomResourceDetailsContainer/>};
  }
  if (resourcekind === CUSTOM_RESOURCES_ENDPOINT) {
    return { ...getCustomResourceDefinitionsDetailsConfig(customResourcesDefinitionDetails, loading), miscComponent: <></>};
  }
};

export {
  useDetailsWrapper
};