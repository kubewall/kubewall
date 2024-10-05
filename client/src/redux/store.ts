import addConfigSlice from '@/data/KwClusters/AddConfigSlice';
import clusterEventsListSlice from '@/data/Clusters/Events/EventsListSlice';
import clusterRoleBindingDetailsSlice from '@/data/AccessControls/ClusterRoleBindings/ClusterRoleBindingDetailsSlice';
import clusterRoleBindingsListSlice from '@/data/AccessControls/ClusterRoleBindings/ClusterRoleBindingsListSlice';
import clusterRoleDetailsSlice from '@/data/AccessControls/ClusterRoles/ClusterRoleDetailsSlice';
import clusterRolesListSlice from '@/data/AccessControls/ClusterRoles/ClusterRolesListSlice';
import clustersSlice from '@/data/KwClusters/ClustersSlice';
import configMapDetailsSlice from '@/data/Configurations/ConfigMaps/ConfigMapDetailsSlice';
import configMapsSlice from '@/data/Configurations/ConfigMaps/ConfigMapsSlice';
import { configureStore } from '@reduxjs/toolkit';
import cronJobDetailsSlice from '@/data/Workloads/CronJobs/CronJobDetailsSlice';
import cronjobSlice from '@/data/Workloads/CronJobs/CronJobsSlice';
import customResourcesDefinitionDetailsSlice from '@/data/CustomResources/CustomResourcesDefinitionDetailsSlice';
import customResourcesDetailsSlice from '@/data/CustomResources/CustomResourcesDetailsSlice';
import customResourcesListSlice from '@/data/CustomResources/CustomResourcesListSlice';
import customResourcesSlice from '@/data/CustomResources/CustomResourcesSlice';
import daemonSetDetailsSlice from '@/data/Workloads/DaemonSets/DaemonSetDetailsSlice';
import daemonSetsSlice from '@/data/Workloads/DaemonSets/DaemonSetsSlices';
import deleteConfigSlice from '@/data/KwClusters/DeleteConfigSlice';
import deleteResourcesSlice from '@/data/Misc/DeleteResourceSlice';
import deploymentDetailsSlice from '@/data/Workloads/Deployments/DeploymentDetailsSlice';
import deploymentPodDetailsSlice from '@/data/Workloads/Deployments/DeploymentPodsSlice';
import deploymentSlice from '@/data/Workloads/Deployments/DeploymentsSlice';
import endpointDetailsSlice from '@/data/Networks/Endpoint/EndpointDetailsSlice';
import endpointListSlice from '@/data/Networks/Endpoint/EndpointListSlice';
import eventsSlice from '@/data/Events/EventsSlice';
import hpaDetailsSlice from '@/data/Configurations/HPAs/HPADetailsSlice';
import hpasListSlice from '@/data/Configurations/HPAs/HPAsListSlice';
import ingressDetailsSlice from '@/data/Networks/Ingresses/IngressDetailsSlice';
import ingressesListSlice from '@/data/Networks/Ingresses/IngressesListSlice';
import jobDetailsSlice from '@/data/Workloads/Jobs/JobDetailsSlice';
import jobsSlice from '@/data/Workloads/Jobs/JobsSlice';
import leaseDetailsSlice from '@/data/Clusters/Leases/LeaseDetailsSlice';
import leasesListSlice from '@/data/Clusters/Leases/LeasesListSlice';
import limitRangeDetailsSlice from '@/data/Configurations/LimitRange/LimitRangeDetailsSlice';
import limitRangeListSlice from '@/data/Configurations/LimitRange/LimitRangeListSlice';
import listTableFilterSlice from '@/data/Misc/ListTableFilterSlice';
import listTableNamesapceSlice from '@/data/Misc/ListTableNamesapceSlice';
import namespaceDetailsSlice from '@/data/Clusters/Namespaces/NamespaceDetailsSlice';
import namespacesSlice from '@/data/Clusters/Namespaces/NamespacesSlice';
import nodeDetailsSlice from '@/data/Clusters/Nodes/NodeDetailsSlice';
import nodeListSlice from '@/data/Clusters/Nodes/NodeListSlice';
import persistentVolumeClaimsDetailsSlice from '@/data/Storages/PersistentVolumeClaims/PersistentVolumeClaimDetailsSlice';
import persistentVolumeClaimsListSlice from '@/data/Storages/PersistentVolumeClaims/PersistentVolumeClaimsListSlice';
import persistentVolumeDetailsSlice from '@/data/Storages/PersistentVolumes/PersistentVolumeDetailsSlice';
import persistentVolumesListSlice from '@/data/Storages/PersistentVolumes/PersistentVolumesListSlice';
import podDetailsSlice from '@/data/Workloads/Pods/PodDetailsSlice';
import podDisruptionBudgetDetailsSlice from '@/data/Configurations/PodDisruptionBudgets/PodDisruptionBudgetDetailsSlice';
import podDisruptionBudgetsListSlice from '@/data/Configurations/PodDisruptionBudgets/PodDisruptionBudgetsListSlice';
import podLogsSlice from '@/data/Workloads/Pods/PodLogsSlice';
import podsSlice from '@/data/Workloads/Pods/PodsSlice';
import priorityClassDetailsSlice from '@/data/Configurations/PriorityClasses/PriorityClassDetailsSlice';
import priorityClassesListSlice from '@/data/Configurations/PriorityClasses/PriorityClassesListSlice';
import replicaSetDetailsSlice from '@/data/Workloads/ReplicaSets/ReplicaSetDetailsSlice';
import replicaSetsSlice from '@/data/Workloads/ReplicaSets/ReplicaSetsSlice';
import resourceQuotaDetailsSlice from '@/data/Configurations/ResourceQuotas/ResourceQuotaDetailsSlice';
import resourceQuotasListSlice from '@/data/Configurations/ResourceQuotas/ResourceQuotasListSlice';
import roleBindingDetailsSlice from '@/data/AccessControls/RoleBindings/RoleBindingDetailsSlice';
import roleBindingsListSlice from '@/data/AccessControls/RoleBindings/RoleBindingsListSlice';
import rolesDetailsSlice from '@/data/AccessControls/Roles/RolesDetailsSlice';
import rolesListSlice from '@/data/AccessControls/Roles/RolesListSlice';
import runtimeClassDetailsSlice from '@/data/Configurations/RuntimeClasses/RuntimeClassDetailsSlice';
import runtimeClassesListSlice from '@/data/Configurations/RuntimeClasses/RuntimeClassesListSlice';
import secretsDetailsSlice from '@/data/Configurations/Secrets/SecretsDetailsSlice';
import secretsListSlice from '@/data/Configurations/Secrets/SecretsListSlice';
import serviceAccountDetailsSlice from '@/data/AccessControls/ServiceAccounts/ServiceAccountDetailsSlice';
import serviceAccountsListSlice from '@/data/AccessControls/ServiceAccounts/ServiceAccountsListSlice';
import serviceDetailSlice from '@/data/Networks/Services/ServiceDetailSlice';
import servicesListSlice from '@/data/Networks/Services/ServicesListSlice';
import statefulSetDetailsSlice from '@/data/Workloads/StatefulSets/StatefulSetDetailsSlice';
import statefulSetsSlice from '@/data/Workloads/StatefulSets/StatefulSetsSlice';
import storageClassDetailsSlice from '@/data/Storages/StorageClasses/StorageClassDetailsSlice';
import storageClassesListSlice from '@/data/Storages/StorageClasses/StorageClassesListSlice';
import updateYamlSlice from '@/data/Yaml/YamlUpdateSlice';
import yamlSlice from '@/data/Yaml/YamlSlice';

const store = configureStore({
  reducer: {
    clusters: clustersSlice,
    cronJobs: cronjobSlice,
    cronJobDetails: cronJobDetailsSlice,
    daemonSets: daemonSetsSlice,
    daemonSetDetails: daemonSetDetailsSlice,
    deployments: deploymentSlice,
    deploymentDetails: deploymentDetailsSlice,
    deploymentPods: deploymentPodDetailsSlice,
    jobs: jobsSlice,
    jobDetails: jobDetailsSlice,
    pods: podsSlice,
    podDetails: podDetailsSlice,
    podLogs: podLogsSlice,
    namespaces: namespacesSlice,
    namespaceDetails: namespaceDetailsSlice,
    replicaSets: replicaSetsSlice,
    replicaSetDetails: replicaSetDetailsSlice,
    statefulSets: statefulSetsSlice,
    statefulSetDetails: statefulSetDetailsSlice,
    configMaps: configMapsSlice,
    yaml: yamlSlice,
    updateYaml: updateYamlSlice,
    events: eventsSlice,
    secrets: secretsListSlice,
    hpas: hpasListSlice,
    hpaDetails: hpaDetailsSlice,
    limitRanges: limitRangeListSlice,
    limitRangeDetails: limitRangeDetailsSlice,
    resourceQuotas: resourceQuotasListSlice,
    resourceQuotaDetails: resourceQuotaDetailsSlice,
    serviceAccounts: serviceAccountsListSlice,
    serviceAccountDetails: serviceAccountDetailsSlice,
    roles: rolesListSlice,
    roleDetails: rolesDetailsSlice,
    roleBindings: roleBindingsListSlice,
    roleBindingDetails: roleBindingDetailsSlice,
    clusterRoles: clusterRolesListSlice,
    clusterRoleDetails: clusterRoleDetailsSlice,
    priorityClasses: priorityClassesListSlice,
    priorityClassDetails: priorityClassDetailsSlice,
    runtimeClasses: runtimeClassesListSlice,
    runtimeClassDetails: runtimeClassDetailsSlice,
    leases: leasesListSlice,
    leaseDetails: leaseDetailsSlice,
    clusterRoleBindings: clusterRoleBindingsListSlice,
    clusterRoleBindingDetails: clusterRoleBindingDetailsSlice,
    persistentVolumes: persistentVolumesListSlice,
    persistentVolumeClaims: persistentVolumeClaimsListSlice,
    storageClasses: storageClassesListSlice,
    storageClassDetails: storageClassDetailsSlice,
    podDisruptionBudgets: podDisruptionBudgetsListSlice,
    podDisruptionBudgetDetails: podDisruptionBudgetDetailsSlice,
    services: servicesListSlice,
    ingresses: ingressesListSlice,
    endpoints: endpointListSlice,
    secretsDetails: secretsDetailsSlice,
    configMapDetails: configMapDetailsSlice,
    serviceDetails: serviceDetailSlice,
    endpointDetails: endpointDetailsSlice,
    ingressDetails: ingressDetailsSlice,
    persistentVolumeClaimDetails: persistentVolumeClaimsDetailsSlice,
    persistentVolumeDetails: persistentVolumeDetailsSlice,
    customResources: customResourcesSlice,
    customResourcesList: customResourcesListSlice,
    customResourceDetails: customResourcesDetailsSlice,
    addConfig: addConfigSlice,
    deleteConfig: deleteConfigSlice,
    listTableFilter: listTableFilterSlice,
    nodes: nodeListSlice,
    nodeDetails: nodeDetailsSlice,
    deleteResources: deleteResourcesSlice,
    listTableNamesapce: listTableNamesapceSlice,
    customResourcesDefinitionDetails: customResourcesDefinitionDetailsSlice,
    clusterEvents: clusterEventsListSlice
  },
});

export default store;
// Infer the `RootState` and `AppDispatch` types from the store itself
export type RootState = ReturnType<typeof store.getState>;
// Inferred type: {posts: PostsState, comments: CommentsState, users: UsersState}
export type AppDispatch = typeof store.dispatch;
