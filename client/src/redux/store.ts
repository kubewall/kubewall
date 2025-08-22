import DeploymentScaleSlice from '@/data/Workloads/Deployments/DeploymentScaleSlice';
import DeploymentRestartSlice from '@/data/Workloads/Deployments/DeploymentRestartSlice';
import StatefulSetScaleSlice from '@/data/Workloads/StatefulSets/StatefulSetScaleSlice';
import StatefulSetRestartSlice from '@/data/Workloads/StatefulSets/StatefulSetRestartSlice';
import DaemonSetRestartSlice from '@/data/Workloads/DaemonSets/DaemonSetRestartSlice';
import CronJobTriggerSlice from '@/data/Workloads/CronJobs/CronJobTriggerSlice';
import JobPodsSlice from '@/data/Workloads/Jobs/JobPodsSlice';
import CronJobJobsSlice from '@/data/Workloads/CronJobs/CronJobJobsSlice';
import addConfigSlice from '@/data/KwClusters/AddConfigSlice';
import validateConfigSlice from '@/data/KwClusters/ValidateConfigSlice';
import validateAllConfigsSlice from '@/data/KwClusters/ValidateAllConfigsSlice';
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
import daemonSetPodsSlice from '@/data/Workloads/DaemonSets/DaemonSetPodsSlice';
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
import listTableNodeSlice from '@/data/Misc/ListTableNodeSlice';
import listTableStatusSlice from '@/data/Misc/ListTableStatusSlice';
import listTableQosSlice from '@/data/Misc/ListTableQosSlice';
import namespaceDetailsSlice from '@/data/Clusters/Namespaces/NamespaceDetailsSlice';
import namespacePodsSlice from '@/data/Clusters/Namespaces/NamespacePodsSlice';
import namespacesSlice from '@/data/Clusters/Namespaces/NamespacesSlice';
import nodeDetailsSlice from '@/data/Clusters/Nodes/NodeDetailsSlice';
import nodeListSlice from '@/data/Clusters/Nodes/NodeListSlice';
import nodePodsSlice from '@/data/Clusters/Nodes/NodePodsSlice';
import nodeMetricsSlice from '@/data/Clusters/Nodes/NodeMetricsSlice';
import persistentVolumeClaimsDetailsSlice from '@/data/Storages/PersistentVolumeClaims/PersistentVolumeClaimDetailsSlice';
import persistentVolumeClaimsListSlice from '@/data/Storages/PersistentVolumeClaims/PersistentVolumeClaimsListSlice';
import persistentVolumeClaimPodsSlice from '@/data/Storages/PersistentVolumeClaims/PersistentVolumeClaimPodsSlice';
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
import replicaSetPodsSlice from '@/data/Workloads/ReplicaSets/ReplicaSetPodsSlice';
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
import secretDependenciesSlice from '@/data/Configurations/Secrets/SecretDependenciesSlice';
import configMapDependenciesSlice from '@/data/Configurations/ConfigMaps/ConfigMapDependenciesSlice';
import serviceAccountDetailsSlice from '@/data/AccessControls/ServiceAccounts/ServiceAccountDetailsSlice';
import serviceAccountsListSlice from '@/data/AccessControls/ServiceAccounts/ServiceAccountsListSlice';
import serviceDetailSlice from '@/data/Networks/Services/ServiceDetailSlice';
import servicesListSlice from '@/data/Networks/Services/ServicesListSlice';
import statefulSetDetailsSlice from '@/data/Workloads/StatefulSets/StatefulSetDetailsSlice';
import statefulSetsSlice from '@/data/Workloads/StatefulSets/StatefulSetsSlice';
import statefulSetPodsSlice from '@/data/Workloads/StatefulSets/StatefulSetPodsSlice';
import storageClassDetailsSlice from '@/data/Storages/StorageClasses/StorageClassDetailsSlice';
import storageClassesListSlice from '@/data/Storages/StorageClasses/StorageClassesListSlice';
import updateYamlSlice from '@/data/Yaml/YamlUpdateSlice';
import yamlSlice from '@/data/Yaml/YamlSlice';
import { helmReleasesReducer, helmReleaseDetailsReducer } from '@/data/Helm';
import helmReleaseResourcesReducer from '@/data/Helm/HelmReleaseResourcesSlice';
import helmActionsReducer from '@/data/Helm/HelmActionsSlice';
import helmChartsReducer from '@/data/Helm/HelmChartsSlice';
import cloudShellSlice from '@/data/CloudShell/CloudShellSlice';
import permissionErrorsSlice from '@/data/PermissionErrors/PermissionErrorsSlice';
import listTableRefreshSlice from '@/data/Misc/ListTableRefreshSlice';
import nodeActionsSlice from '@/data/Clusters/Nodes/NodeActionsSlice';
import persistentVolumeClaimScaleSlice from '@/data/Storages/PersistentVolumeClaims/PersistentVolumeClaimScaleSlice';
import listTableNodeArchitectureSlice from '@/data/Misc/ListTableNodeArchitectureSlice';
import listTableNodeConditionSlice from '@/data/Misc/ListTableNodeConditionSlice';
import listTableNodeOperatingSystemSlice from '@/data/Misc/ListTableNodeOperatingSystemSlice';
import clusterOverviewSlice from '@/data/Overview/ClusterOverviewSlice';
import tracingSlice from '@/data/Tracing/TracingSlice';

const store = configureStore({
  reducer: {
    clusters: clustersSlice,
    cronJobs: cronjobSlice,
    cronJobDetails: cronJobDetailsSlice,
    daemonSets: daemonSetsSlice,
    daemonSetDetails: daemonSetDetailsSlice,
    daemonSetPods: daemonSetPodsSlice,
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
    namespacePods: namespacePodsSlice,
    replicaSets: replicaSetsSlice,
    replicaSetDetails: replicaSetDetailsSlice,
    replicaSetPods: replicaSetPodsSlice,
    statefulSets: statefulSetsSlice,
    statefulSetDetails: statefulSetDetailsSlice,
    statefulSetPods: statefulSetPodsSlice,
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
    persistentVolumeClaimPods: persistentVolumeClaimPodsSlice,
    persistentVolumeDetails: persistentVolumeDetailsSlice,
    customResources: customResourcesSlice,
    customResourcesList: customResourcesListSlice,
    customResourceDetails: customResourcesDetailsSlice,
    addConfig: addConfigSlice,
    validateConfig: validateConfigSlice,
    validateAllConfigs: validateAllConfigsSlice,
    deleteConfig: deleteConfigSlice,
    listTableFilter: listTableFilterSlice,
    nodes: nodeListSlice,
    nodeDetails: nodeDetailsSlice,
    nodePods: nodePodsSlice,
    nodeMetrics: nodeMetricsSlice,
    deleteResources: deleteResourcesSlice,
    listTableNamesapce: listTableNamesapceSlice,
    listTableNode: listTableNodeSlice,
    listTableStatus: listTableStatusSlice,
    listTableQos: listTableQosSlice,
    customResourcesDefinitionDetails: customResourcesDefinitionDetailsSlice,
    clusterEvents: clusterEventsListSlice,
    cloudShell: cloudShellSlice,
    deploymentScale: DeploymentScaleSlice,
    deploymentRestart: DeploymentRestartSlice,
    statefulSetScale: StatefulSetScaleSlice,
    statefulSetRestart: StatefulSetRestartSlice,
    daemonSetRestart: DaemonSetRestartSlice,
    cronJobTrigger: CronJobTriggerSlice,
    jobPods: JobPodsSlice,
    cronJobJobs: CronJobJobsSlice,
    helmReleases: helmReleasesReducer,
    helmReleaseDetails: helmReleaseDetailsReducer,
    helmReleaseResources: helmReleaseResourcesReducer,
    helmActions: helmActionsReducer,
    helmCharts: helmChartsReducer,
    permissionErrors: permissionErrorsSlice,
    listTableRefresh: listTableRefreshSlice,
    nodeActions: nodeActionsSlice,
    persistentVolumeClaimScale: persistentVolumeClaimScaleSlice,
    secretDependencies: secretDependenciesSlice,
    configMapDependencies: configMapDependenciesSlice,
    listTableNodeArchitecture: listTableNodeArchitectureSlice,
    listTableNodeCondition: listTableNodeConditionSlice,
    listTableNodeOperatingSystem: listTableNodeOperatingSystemSlice,
    clusterOverview: clusterOverviewSlice,
    tracing: tracingSlice,
  },
});

export default store;
// Infer the `RootState` and `AppDispatch` types from the store itself
export type RootState = ReturnType<typeof store.getState>;
// Inferred type: {posts: PostsState, comments: CommentsState, users: UsersState}
export type AppDispatch = typeof store.dispatch;
