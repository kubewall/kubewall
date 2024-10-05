import { ClusterRoleBindingDetails, ClusterRoleDetails, ConfigMapDetails, CronJobDetails, CustomResourceDetails, CustomResourcesDefinitionDetails, DaemonSetDetails, DeploymentDetails, EndpointDetails, HPADetails, IngressDetails, JobDetails, KeyValueNull, LeaseDetails, LimitRangeDetails, NamespaceDetails, NodeDetails, PersistentVolumeClaimDetails, PersistentVolumeDetails, PodDetails, PodDisruptionBudgetDetails, PriorityClassDetails, ReplicaSetDetails, ResourceQuotaDetails, RoleBindingDetails, RoleDetails, RuntimeClassDetails, SecretDetails, ServiceAccountDetails, ServiceDetails, StatefulSetDetails, StorageClassDetails } from "@/types";
import { defaultOrValue, getAnnotationCardDetails, getLabelConditionCardDetails } from "../MiscUtils";

// Cluster

const getNodeDetailsConfig = (details: NodeDetails, loading: boolean) => ({
  subHeading: !details.metadata ? '' : details.metadata.name,
  detailCard: [
    { label: 'Name', value: defaultOrValue(details.metadata.name) },
    { label: 'Resource Version', value: defaultOrValue(details.metadata.resourceVersion) },
    { label: 'Namespace', value: defaultOrValue(details.metadata.namespace) },
    { label: 'UID', value: defaultOrValue(details.metadata.uid) },
    { label: 'Age', value: defaultOrValue(details.metadata.creationTimestamp) },
    { label: 'Deletion Grace Period Seconds', value: defaultOrValue(details.metadata.deletionGracePeriodSeconds) },
    { label: 'Generate Name', value: defaultOrValue(details.metadata.generateName) },
    { label: 'Generation', value: defaultOrValue(details.metadata.generation) },
    { label: 'External Id', value: defaultOrValue(details.spec.externalID) },
    { label: 'Unschedulable', value: defaultOrValue(details.spec.unschedulable) },
    { label: 'Provider Id', value: defaultOrValue(details.spec.providerID) },
  ],
  loading,
  ...getCommonCardConfig(details.metadata.annotations, details.metadata.labels, details.status.conditions)
});

const getNamespaceDetailsConfig = (details: NamespaceDetails, loading: boolean) => ({
  subHeading: !details.metadata ? '' : details.metadata.name,
  detailCard: [
    { label: 'Name', value: defaultOrValue(details.metadata.name) },
    { label: 'Resource Version', value: defaultOrValue(details.metadata.resourceVersion) },
    { label: 'Namespace', value: defaultOrValue(details.metadata.namespace) },
    { label: 'UID', value: defaultOrValue(details.metadata.uid) },
    { label: 'Age', value: defaultOrValue(details.metadata.creationTimestamp) },
    { label: 'Deletion Grace Period Seconds', value: defaultOrValue(details.metadata.deletionGracePeriodSeconds) },
    { label: 'Generate Name', value: defaultOrValue(details.metadata.generateName) },
    { label: 'Generation', value: defaultOrValue(details.metadata.generation) },
  ],
  loading,
  ...getCommonCardConfig(details.metadata.annotations, details.metadata.labels, details.status.conditions)
});

const getLeaseDetailsConfig = (details: LeaseDetails, loading: boolean) => ({
  subHeading: !details.metadata ? '' : details.metadata.name,
  detailCard: [
    { label: 'Name', value: defaultOrValue(details.metadata.name) },
    { label: 'Resource Version', value: defaultOrValue(details.metadata.resourceVersion) },
    { label: 'Namespace', value: defaultOrValue(details.metadata.namespace) },
    { label: 'UID', value: defaultOrValue(details.metadata.uid) },
    { label: 'Age', value: defaultOrValue(details.metadata.creationTimestamp) },
    { label: 'Deletion Grace Period Seconds', value: defaultOrValue(details.metadata.deletionGracePeriodSeconds) },
    { label: 'Generate Name', value: defaultOrValue(details.metadata.generateName) },
    { label: 'Generation', value: defaultOrValue(details.metadata.generation) },
  ],
  loading,
  ...getCommonCardConfig(details.metadata.annotations, details.metadata.labels)
});

// Workload

const getPodDetailsConfig = (details: PodDetails, loading: boolean) => ({
  subHeading: !details.metadata ? '' : `${details.metadata.namespace}/${details.metadata.name}`,
  detailCard: [
    { label: 'Name', value: defaultOrValue(details.metadata.name) },
    { label: 'Resource Version', value: defaultOrValue(details.metadata.resourceVersion) },
    { label: 'Namespace', value: defaultOrValue(details.metadata.namespace) },
    { label: 'UID', value: defaultOrValue(details.metadata.uid) },
    { label: 'Age', value: defaultOrValue(details.metadata.creationTimestamp) },
    { label: 'Generation', value: defaultOrValue(details.metadata.generateName) },
    { label: 'Phase', value: defaultOrValue(details.status.phase) },
    { label: 'HostIp', value: defaultOrValue(details.status.hostIP) },
    { label: 'PodIp', value: defaultOrValue(details.status.podIP) },
    { label: 'DNS Policy', value: defaultOrValue(details.spec.dnsPolicy) },
    { label: 'Node Name', value: defaultOrValue(details.spec.nodeName) },
    { label: 'Preemption Policy', value: defaultOrValue(details.spec.preemptionPolicy) },
    { label: 'Priority', value: defaultOrValue(details.spec.priority) },
    { label: 'Restart Policy', value: defaultOrValue(details.spec.restartPolicy) },
    { label: 'Scheduler Name', value: defaultOrValue(details.spec.schedulerName) },
    { label: 'Service Account', value: defaultOrValue(details.spec.serviceAccount) },
    { label: 'Service Account Name', value: defaultOrValue(details.spec.serviceAccountName) },
    { label: 'Termination GracePeriod Seconds', value: defaultOrValue(details.spec.terminationGracePeriodSeconds) }
  ],
  loading,
  ...getCommonCardConfig(details.metadata.annotations, details.metadata.labels, details.status.conditions)
});

const getDeploymentDetailsConfig = (details: DeploymentDetails, loading: boolean) => ({
  subHeading: !details.metadata ? '' : `${details.metadata.namespace}/${details.metadata.name}`,
  detailCard: [
    { label: 'Name', value: defaultOrValue(details.metadata.name) },
    { label: 'Resource Version', value: defaultOrValue(details.metadata.resourceVersion) },
    { label: 'Namespace', value: defaultOrValue(details.metadata.namespace) },
    { label: 'UID', value: defaultOrValue(details.metadata.uid) },
    { label: 'Age', value: defaultOrValue(details.metadata.creationTimestamp) },
    { label: 'Generation', value: defaultOrValue(details.metadata.generation) },
    { label: 'Observed Generation', value: defaultOrValue(details.status.observedGeneration) },
    { label: 'Replicas', value: defaultOrValue(details.spec.replicas) },
    { label: 'Updated Replicas', value: defaultOrValue(details.status.updatedReplicas) },
    { label: 'Ready Replicas', value: defaultOrValue(details.status.readyReplicas) },
    { label: 'Available Replicas', value: defaultOrValue(details.status.availableReplicas) },
    { label: 'Unavailable Replicas', value: defaultOrValue(details.status.unavailableReplicas) },
    { label: 'Min. Ready Seconds', value: defaultOrValue(details.spec.minReadySeconds) },
    { label: 'Progress Deadline Seconds', value: defaultOrValue(details.spec.progressDeadlineSeconds) },
    { label: 'Revision History Limit', value: defaultOrValue(details.spec.revisionHistoryLimit) },
    { label: 'Strategy Type', value: defaultOrValue(details.spec.strategy?.type) },
    { label: 'Max Surge', value: defaultOrValue(details.spec.strategy?.rollingUpdate?.maxSurge) },
    { label: 'Max Unavailable', value: defaultOrValue(details.spec.strategy?.rollingUpdate?.maxUnavailable) }
  ],
  loading,
  ...getCommonCardConfig(details.metadata.annotations, details.metadata.labels, details.status.conditions)
});

const getDaemonSetDetailsConfig = (details: DaemonSetDetails, loading: boolean) => ({
  subHeading: !details.metadata ? '' : `${details.metadata.namespace}/${details.metadata.name}`,
  detailCard: [
    { label: 'Name', value: defaultOrValue(details.metadata.name) },
    { label: 'Resource Version', value: defaultOrValue(details.metadata.resourceVersion) },
    { label: 'Namespace', value: defaultOrValue(details.metadata.namespace) },
    { label: 'UID', value: defaultOrValue(details.metadata.uid) },
    { label: 'Age', value: defaultOrValue(details.metadata.creationTimestamp) },
    { label: 'Generation', value: defaultOrValue(details.metadata.generation) },
    { label: 'Generate Name', value: defaultOrValue(details.metadata.generateName) },
    { label: 'Observed Generation', value: defaultOrValue(details.status.observedGeneration) },
    { label: 'Current Number Scheduled', value: defaultOrValue(details.status.currentNumberScheduled) },
    { label: 'Desired Number Scheduled', value: defaultOrValue(details.status.desiredNumberScheduled) },
    { label: 'Number Misscheduled', value: defaultOrValue(details.status.numberMisscheduled) },
    { label: 'Ready', value: defaultOrValue(details.status.numberReady) },
    { label: 'Collision Count', value: defaultOrValue(details.status.collisionCount) },
    { label: 'Min. Ready Seconds', value: defaultOrValue(details.spec.minReadySeconds) },
    { label: 'Revision History Limit', value: defaultOrValue(details.spec.revisionHistoryLimit) },
    { label: 'Update Strategy', value: defaultOrValue(details.spec.updateStrategy?.type) },
    { label: 'Max Surge', value: defaultOrValue(details.spec.updateStrategy?.rollingUpdate?.maxSurge) },
    { label: 'Max Unavailable', value: defaultOrValue(details.spec.updateStrategy?.rollingUpdate?.maxUnavailable) }
  ],
  loading,
  ...getCommonCardConfig(details.metadata.annotations, details.metadata.labels, details.status.conditions)
});

const getStatefulSetDetailsConfig = (details: StatefulSetDetails, loading: boolean) => ({
  subHeading: !details.metadata ? '' : `${details.metadata.namespace}/${details.metadata.name}`,
  detailCard: [
    { label: 'Name', value: defaultOrValue(details.metadata.name) },
    { label: 'Resource Version', value: defaultOrValue(details.metadata.resourceVersion) },
    { label: 'Namespace', value: defaultOrValue(details.metadata.namespace) },
    { label: 'UID', value: defaultOrValue(details.metadata.uid) },
    { label: 'Age', value: defaultOrValue(details.metadata.creationTimestamp) },
    { label: 'Generation', value: defaultOrValue(details.metadata.generation) },
    { label: 'Generate Name', value: defaultOrValue(details.metadata.generateName) },
    { label: 'Observed Generation', value: defaultOrValue(details.status.observedGeneration) },
    { label: 'Desired Replicas', value: defaultOrValue(details.status.replicas) },
    { label: 'Current Replicas', value: defaultOrValue(details.status.currentReplicas) },
    { label: 'Ready Replicas', value: defaultOrValue(details.status.readyReplicas) },
    { label: 'Available Replicas', value: defaultOrValue(details.status.availableReplicas) },
    { label: 'Min. Ready Seconds', value: defaultOrValue(details.spec.minReadySeconds) },
    { label: 'Observed Replicas', value: defaultOrValue(details.spec.replicas) },
  ],
  loading,
  ...getCommonCardConfig(details.metadata.annotations, details.metadata.labels, details.status.conditions)
});

const getReplicaSetDetailsConfig = (details: ReplicaSetDetails, loading: boolean) => ({
  subHeading: !details.metadata ? '' : `${details.metadata.namespace}/${details.metadata.name}`,
  detailCard: [
    { label: 'Name', value: defaultOrValue(details.metadata.name) },
    { label: 'Resource Version', value: defaultOrValue(details.metadata.resourceVersion) },
    { label: 'Namespace', value: defaultOrValue(details.metadata.namespace) },
    { label: 'UID', value: defaultOrValue(details.metadata.uid) },
    { label: 'Age', value: defaultOrValue(details.metadata.creationTimestamp) },
    { label: 'Generation', value: defaultOrValue(details.metadata.generation) },
    { label: 'Generate Name', value: defaultOrValue(details.metadata.generateName) },
    { label: 'Observed Generation', value: defaultOrValue(details.status.observedGeneration) },
    { label: 'Desired Replicas', value: defaultOrValue(details.status.replicas) },
    { label: 'Fully Labeled Replicas', value: defaultOrValue(details.status.fullyLabeledReplicas) },
    { label: 'Ready Replicas', value: defaultOrValue(details.status.readyReplicas) },
    { label: 'Available Replicas', value: defaultOrValue(details.status.availableReplicas) },
    { label: 'Min. Ready Seconds', value: defaultOrValue(details.spec.minReadySeconds) },
    { label: 'Observed Replicas', value: defaultOrValue(details.spec.replicas) },
  ],
  loading,
  ...getCommonCardConfig(details.metadata.annotations, details.metadata.labels, details.status.conditions)
});

const getJobsDetailsConfig = (details: JobDetails, loading: boolean) => ({
  subHeading: !details.metadata ? '' : `${details.metadata.namespace}/${details.metadata.name}`,
  detailCard: [
    { label: 'Name', value: defaultOrValue(details.metadata.name) },
    { label: 'Resource Version', value: defaultOrValue(details.metadata.resourceVersion) },
    { label: 'Namespace', value: defaultOrValue(details.metadata.namespace) },
    { label: 'UID', value: defaultOrValue(details.metadata.uid) },
    { label: 'Age', value: defaultOrValue(details.metadata.creationTimestamp) },
    { label: 'Generation', value: defaultOrValue(details.metadata.generation) },
    { label: 'Generate Name', value: defaultOrValue(details.metadata.generateName) },
    { label: 'Active', value: defaultOrValue(details.status.active) },
    { label: 'Completed Indexes', value: defaultOrValue(details.status.completedIndexes) },
    { label: 'Failed', value: defaultOrValue(details.status.failed) },
    {label: 'Failed Indexes', value: defaultOrValue(details.status.failedIndexes)},
    {label: 'Ready',value: defaultOrValue(details.status.ready)},
    { label: 'Parallelism', value: defaultOrValue(details.spec.parallelism) },
    { label: 'Backoff Limit', value: defaultOrValue(details.spec.backoffLimit) },
    { label: 'Completions', value: defaultOrValue(details.spec.completions) },
    { label: 'Completion Mode', value: defaultOrValue(details.spec.completionMode) },
    { label: 'Suspend', value: defaultOrValue(details.spec.suspend) },
    { label: 'TTLSecondsAfterFinished', value: defaultOrValue(details.spec.ttlSecondsAfterFinished) }
  ],
  loading,
  ...getCommonCardConfig(details.metadata.annotations, details.metadata.labels, details.status.conditions)
});

const getCronJobsDetailsConfig = (details: CronJobDetails, loading: boolean) => ({
  subHeading: !details.metadata ? '' : `${details.metadata.namespace}/${details.metadata.name}`,
  detailCard: [
    { label: 'Name', value: defaultOrValue(details.metadata.name) },
    { label: 'Resource Version', value: defaultOrValue(details.metadata.resourceVersion) },
    { label: 'Namespace', value: defaultOrValue(details.metadata.namespace) },
    { label: 'UID', value: defaultOrValue(details.metadata.uid) },
    { label: 'Age', value: defaultOrValue(details.metadata.creationTimestamp) },
    { label: 'Generation', value: defaultOrValue(details.metadata.generateName) },
    { label: 'Concurrency Policy', value: defaultOrValue(details.spec.concurrencyPolicy) },
    { label: 'Failed Jobs History Limit', value: defaultOrValue(details.spec.failedJobsHistoryLimit) }
  ],
  loading,
  ...getCommonCardConfig(details.metadata.annotations, details.metadata.labels)
});

// Configuration
const getSecretDetailsConfig = (details: SecretDetails, loading: boolean) => ({
  subHeading: !details.metadata ? '' : `${details.metadata.namespace}/${details.metadata.name}`,
  detailCard: [
    {label: 'Name',value: defaultOrValue(details.metadata.name) },
    {label: 'Resource Version',value: defaultOrValue(details.metadata.resourceVersion) },
    {label: 'Namespace',value: defaultOrValue(details.metadata.namespace) },
    {label: 'UID',value: defaultOrValue(details.metadata.uid) },
    {label: 'Age',value: defaultOrValue(details.metadata.creationTimestamp) },
    {label: 'Type',value: defaultOrValue(details.type) },
    {label: 'Immutable',value: defaultOrValue(typeof(details.immutable) === 'boolean' ? String(details.immutable) : details.immutable) },
    {label: 'Generate Name',value: defaultOrValue(details.metadata.generateName) },
    {label: 'Generation',value: defaultOrValue(details.metadata.generation) }
  ],
  loading,
  ...getCommonCardConfig(details.metadata.annotations, details.metadata.labels)
});

const getConfigMapDetailsConfig = (details: ConfigMapDetails, loading: boolean) => ({
  subHeading: !details.metadata ? '' : `${details.metadata.namespace}/${details.metadata.name}`,
  detailCard: [
    {label: 'Name',value: defaultOrValue(details.metadata.name) },
    {label: 'Resource Version',value: defaultOrValue(details.metadata.resourceVersion) },
    {label: 'Namespace',value: defaultOrValue(details.metadata.namespace) },
    {label: 'UID',value: defaultOrValue(details.metadata.uid) },
    {label: 'Age',value: defaultOrValue(details.metadata.creationTimestamp) },
    {label: 'Immutable',value: defaultOrValue(typeof(details.immutable) === 'boolean' ? String(details.immutable) : details.immutable) },
    {label: 'Generate Name',value: defaultOrValue(details.metadata.generateName) },
    {label: 'Generation',value: defaultOrValue(details.metadata.generation) }
  ],
  loading,
  ...getCommonCardConfig(details.metadata.annotations, details.metadata.labels)
});

const getHPADetailsConfig = (details: HPADetails, loading: boolean) => ({
  subHeading: !details.metadata ? '' : `${details.metadata.namespace}/${details.metadata.name}`,
  detailCard: [
    { label: 'Name', value: defaultOrValue(details.metadata.name) },
    { label: 'Resource Version', value: defaultOrValue(details.metadata.resourceVersion) },
    { label: 'Namespace', value: defaultOrValue(details.metadata.namespace) },
    { label: 'UID', value: defaultOrValue(details.metadata.uid) },
    { label: 'Age', value: defaultOrValue(details.metadata.creationTimestamp) },
    { label: 'Generate Name', value: defaultOrValue(details.metadata.generateName) },
    { label: 'Generation', value: defaultOrValue(details.metadata.generation) },
    { label: 'Minimum Replicas', value: defaultOrValue(details.spec.minReplicas) },
    { label: 'Maximum Replicas', value: defaultOrValue(details.spec.maxReplicas) }
  ],
  loading,
  ...getCommonCardConfig(details.metadata.annotations, details.metadata.labels, details.status.conditions)
});

const getLimitRangeDetailsConfig = (details: LimitRangeDetails, loading: boolean) => ({
  subHeading: !details.metadata ? '' : `${details.metadata.namespace}/${details.metadata.name}`,
  detailCard: [
    { label: 'Name', value: defaultOrValue(details.metadata.name) },
    { label: 'Resource Version', value: defaultOrValue(details.metadata.resourceVersion) },
    { label: 'Namespace', value: defaultOrValue(details.metadata.namespace) },
    { label: 'UID', value: defaultOrValue(details.metadata.uid) },
    { label: 'Age', value: defaultOrValue(details.metadata.creationTimestamp) },
    { label: 'Generate Name', value: defaultOrValue(details.metadata.generateName) },
    { label: 'Generation', value: defaultOrValue(details.metadata.generation) }
  ],
  loading,
  ...getCommonCardConfig(details.metadata.annotations, details.metadata.labels)
});

const getResourceQuotaDetailsConfig = (details: ResourceQuotaDetails, loading: boolean) => ({
  subHeading: !details.metadata ? '' : `${details.metadata.namespace}/${details.metadata.name}`,
  detailCard: [
    { label: 'Name', value: defaultOrValue(details.metadata.name) },
    { label: 'Resource Version', value: defaultOrValue(details.metadata.resourceVersion) },
    { label: 'Namespace', value: defaultOrValue(details.metadata.namespace) },
    { label: 'UID', value: defaultOrValue(details.metadata.uid) },
    { label: 'Age', value: defaultOrValue(details.metadata.creationTimestamp) },
    { label: 'Generate Name', value: defaultOrValue(details.metadata.generateName) },
    { label: 'Generation', value: defaultOrValue(details.metadata.generation) }
  ],
  loading,
  ...getCommonCardConfig(details.metadata.annotations, details.metadata.labels)
});

const getPriorityClassDetailsConfig = (details: PriorityClassDetails, loading: boolean) => ({
  subHeading: !details.metadata ? '' : `${details.metadata.name}`,
  detailCard: [
    { label: 'Name', value: defaultOrValue(details.metadata.name) },
    { label: 'Resource Version', value: defaultOrValue(details.metadata.resourceVersion) },
    { label: 'UID', value: defaultOrValue(details.metadata.uid) },
    { label: 'Age', value: defaultOrValue(details.metadata.creationTimestamp) },
    { label: 'Generate Name', value: defaultOrValue(details.metadata.generateName) },
    { label: 'Generation', value: defaultOrValue(details.metadata.generation) }
  ],
  loading,
  ...getCommonCardConfig(details.metadata.annotations, details.metadata.labels)
});

const getRuntimeClassDetailsConfig = (details: RuntimeClassDetails, loading: boolean) => ({
  subHeading: !details.metadata ? '' : `${details.metadata.name}`,
  detailCard: [
    { label: 'Name', value: defaultOrValue(details.metadata.name) },
    { label: 'Resource Version', value: defaultOrValue(details.metadata.resourceVersion) },
    { label: 'UID', value: defaultOrValue(details.metadata.uid) },
    { label: 'Age', value: defaultOrValue(details.metadata.creationTimestamp) },
    { label: 'Generate Name', value: defaultOrValue(details.metadata.generateName) },
    { label: 'Generation', value: defaultOrValue(details.metadata.generation) }
  ],
  loading,
  ...getCommonCardConfig(details.metadata.annotations, details.metadata.labels)
});

const getPodDisruptionBudgetDetailsConfig = (details: PodDisruptionBudgetDetails, loading: boolean) => ({
  subHeading: !details.metadata ? '' : `${details.metadata.namespace}/${details.metadata.name}`,
  detailCard: [
    { label: 'Name', value: defaultOrValue(details.metadata.name) },
    { label: 'Resource Version', value: defaultOrValue(details.metadata.resourceVersion) },
    { label: 'Namespace', value: defaultOrValue(details.metadata.namespace) },
    { label: 'UID', value: defaultOrValue(details.metadata.uid) },
    { label: 'Age', value: defaultOrValue(details.metadata.creationTimestamp) },
    { label: 'Generate Name', value: defaultOrValue(details.metadata.generateName) },
    { label: 'Generation', value: defaultOrValue(details.metadata.generation?.toString()) },
    { label: 'Current Healthy', value: defaultOrValue(details.status.currentHealthy.toString()) },
    { label: 'Desired Healthy', value: defaultOrValue(details.status.desiredHealthy.toString()) },
    { label: 'Disruptions Allowed', value: defaultOrValue(details.status.disruptionsAllowed.toString()) },
    { label: 'Expected Pods', value: defaultOrValue(details.status.expectedPods.toString()) },
    { label: 'Observed Generation', value: defaultOrValue(details.status.observedGeneration?.toString()) }
  ],
  loading,
  ...getCommonCardConfig(details.metadata.annotations, details.metadata.labels, details.status.conditions)
});

// Access Control
const getServiceAccountDetailsConfig = (details: ServiceAccountDetails, loading: boolean) => ({
  subHeading: !details.metadata ? '' : `${details.metadata.namespace}/${details.metadata.name}`,
  detailCard: [
    {label: 'Name',value: defaultOrValue(details.metadata.name) },
    {label: 'Resource Version',value: defaultOrValue(details.metadata.resourceVersion) },
    {label: 'Namespace',value: defaultOrValue(details.metadata.namespace) },
    {label: 'UID',value: defaultOrValue(details.metadata.uid) },
    {label: 'Age',value: defaultOrValue(details.metadata.creationTimestamp) },
    {label: 'AutoMount Service Account Token',value: defaultOrValue(typeof(details.automountServiceAccountToken) === 'boolean' ? String(details.automountServiceAccountToken) : details.automountServiceAccountToken) },
    {label: 'Generate Name',value: defaultOrValue(details.metadata.generateName) },
    {label: 'Generation',value: defaultOrValue(details.metadata.generation) }
  ],
  loading,
  ...getCommonCardConfig(details.metadata.annotations, details.metadata.labels)
});

const getRoleDetailsConfig = (details: RoleDetails, loading: boolean) => ({
  subHeading: !details.metadata ? '' : `${details.metadata.namespace}/${details.metadata.name}`,
  detailCard: [
    {label: 'Name',value: defaultOrValue(details.metadata.name) },
    {label: 'Resource Version',value: defaultOrValue(details.metadata.resourceVersion) },
    {label: 'Namespace',value: defaultOrValue(details.metadata.namespace) },
    {label: 'UID',value: defaultOrValue(details.metadata.uid) },
    {label: 'Age',value: defaultOrValue(details.metadata.creationTimestamp) },
    {label: 'Generate Name',value: defaultOrValue(details.metadata.generateName) },
    {label: 'Generation',value: defaultOrValue(details.metadata.generation) },
    {label: 'Deletion Grace Period Seconds', value: defaultOrValue(details.metadata.deletionGracePeriodSeconds)},
  ],
  loading,
  ...getCommonCardConfig(details.metadata.annotations, details.metadata.labels)
});

const getRoleBindingDetailsConfig = (details: RoleBindingDetails, loading: boolean) => ({
  subHeading: !details.metadata ? '' : `${details.metadata.namespace}/${details.metadata.name}`,
  detailCard: [
    { label: 'Name', value: defaultOrValue(details.metadata.name) },
    { label: 'Resource Version', value: defaultOrValue(details.metadata.resourceVersion) },
    { label: 'Namespace', value: defaultOrValue(details.metadata.namespace) },
    { label: 'UID', value: defaultOrValue(details.metadata.uid) },
    { label: 'Age', value: defaultOrValue(details.metadata.creationTimestamp) },
    { label: 'Deletion Grace Period Seconds', value: defaultOrValue(details.metadata.deletionGracePeriodSeconds) },
    { label: 'Generate Name', value: defaultOrValue(details.metadata.generateName) },
    { label: 'Generation', value: defaultOrValue(details.metadata.generation) },
    { label: 'API Group', value: defaultOrValue(details.roleRef?.apiGroup) },
    { label: 'Resource Kind', value: defaultOrValue(details.roleRef?.kind) },
    { label: 'Group Name', value: defaultOrValue(details.roleRef?.name) }
  ],
  loading,
  ...getCommonCardConfig(details.metadata.annotations, details.metadata.labels)
});

const getClusterRoleDetailsConfig = (details: ClusterRoleDetails, loading: boolean) => ({
  subHeading: !details.metadata ? '' : `${details.metadata.name}`,
  detailCard: [
    { label: 'Name', value: defaultOrValue(details.metadata.name) },
    { label: 'Resource Version', value: defaultOrValue(details.metadata.resourceVersion) },
    { label: 'Namespace', value: defaultOrValue(details.metadata.namespace) },
    { label: 'UID', value: defaultOrValue(details.metadata.uid) },
    { label: 'Age', value: defaultOrValue(details.metadata.creationTimestamp) },
    { label: 'Deletion Grace Period Seconds', value: defaultOrValue(details.metadata.deletionGracePeriodSeconds) },
    { label: 'Generate Name', value: defaultOrValue(details.metadata.generateName) },
    { label: 'Generation', value: defaultOrValue(details.metadata.generation) }
  ],
  loading,
  ...getCommonCardConfig(details.metadata.annotations, details.metadata.labels)
});

const getClusterRoleBindingDetailsConfig = (details: ClusterRoleBindingDetails, loading: boolean) => ({
  subHeading: !details.metadata ? '' : `${details.metadata.name}`,
  detailCard: [
    { label: 'Name', value: defaultOrValue(details.metadata.name) },
    { label: 'Resource Version', value: defaultOrValue(details.metadata.resourceVersion) },
    { label: 'Namespace', value: defaultOrValue(details.metadata.namespace) },
    { label: 'UID', value: defaultOrValue(details.metadata.uid) },
    { label: 'Age', value: defaultOrValue(details.metadata.creationTimestamp) },
    { label: 'Deletion Grace Period Seconds', value: defaultOrValue(details.metadata.deletionGracePeriodSeconds) },
    { label: 'Generate Name', value: defaultOrValue(details.metadata.generateName) },
    { label: 'Generation', value: defaultOrValue(details.metadata.generation) },
    { label: 'API Group', value: defaultOrValue(details.roleRef?.apiGroup) },
    { label: 'Resource Kind', value: defaultOrValue(details.roleRef?.kind) },
    { label: 'Group Name', value: defaultOrValue(details.roleRef?.name) }
  ],
  loading,
  ...getCommonCardConfig(details.metadata.annotations, details.metadata.labels)
});

// Network
const getServiceDetailsConfig = (details: ServiceDetails, loading: boolean) => ({
  subHeading: !details.metadata ? '' : `${details.metadata.namespace}/${details.metadata.name}`,
  detailCard: [
    { label: 'Name', value: defaultOrValue(details.metadata.name) },
    { label: 'Resource Version', value: defaultOrValue(details.metadata.resourceVersion) },
    { label: 'Namespace', value: defaultOrValue(details.metadata.namespace) },
    { label: 'UID', value: defaultOrValue(details.metadata.uid) },
    { label: 'Age', value: defaultOrValue(details.metadata.creationTimestamp) },
    { label: 'Generate Name', value: defaultOrValue(details.metadata.generateName) },
    { label: 'Generation', value: defaultOrValue(details.metadata.generation) },
    { label: 'Type', value: defaultOrValue(details.spec.type) },
    { label: 'Cluster IP', value: defaultOrValue(details.spec.clusterIP) },
    { label: 'Session Affinity', value: defaultOrValue(details.spec.sessionAffinity) },
    { label: 'IP Family Policy', value: defaultOrValue(details.spec.ipFamilyPolicy) },
    { label: 'Internal Traffic Policy', value: defaultOrValue(details.spec.internalTrafficPolicy) }
  ],
  loading,
  ...getCommonCardConfig(details.metadata.annotations, details.metadata.labels, details.status.conditions)
});

const getIngressDetailsConfig = (details: IngressDetails, loading: boolean) => ({
  subHeading: !details.metadata ? '' : `${details.metadata.namespace}/${details.metadata.name}`,
  detailCard: [
    {label: 'Name',value: defaultOrValue(details.metadata.name) },
    {label: 'Resource Version',value: defaultOrValue(details.metadata.resourceVersion) },
    {label: 'Namespace',value: defaultOrValue(details.metadata.namespace) },
    {label: 'UID',value: defaultOrValue(details.metadata.uid) },
    {label: 'Age',value: defaultOrValue(details.metadata.creationTimestamp) },
    {label: 'Generate Name',value: defaultOrValue(details.metadata.generateName) },
    {label: 'Generation',value: defaultOrValue(details.metadata.generation) },
    {label: 'Resource Name',value: defaultOrValue(details.spec.defaultBackend?.resource?.name) },
    {label: 'Resource API Group',value: defaultOrValue(details.spec.defaultBackend?.resource?.apiGroup) },
    {label: 'Resource Kind',value: defaultOrValue(details.spec.defaultBackend?.resource?.kind) },
    {label: 'Service Name',value: defaultOrValue(details.spec.defaultBackend?.service?.name) },
    {label: 'Port Name',value: defaultOrValue(details.spec.defaultBackend?.service?.port?.name) },
    {label: 'Port Number',value: defaultOrValue(details.spec.defaultBackend?.service?.port?.number) },
    {label: 'Ingress Class Name',value: defaultOrValue(details.spec.ingressClassName) }
  ],
  loading,
  ...getCommonCardConfig(details.metadata.annotations, details.metadata.labels)
});

const getEndpointDetailsConfig = (details: EndpointDetails, loading: boolean) => ({
  subHeading: !details.metadata ? '' : `${details.metadata.namespace}/${details.metadata.name}`,
  detailCard: [
    {label: 'Name',value: defaultOrValue(details.metadata.name) },
    {label: 'Resource Version',value: defaultOrValue(details.metadata.resourceVersion) },
    {label: 'Namespace',value: defaultOrValue(details.metadata.namespace) },
    {label: 'UID',value: defaultOrValue(details.metadata.uid) },
    {label: 'Age',value: defaultOrValue(details.metadata.creationTimestamp) },
    {label: 'Generate Name',value: defaultOrValue(details.metadata.generateName) },
    {label: 'Generation',value: defaultOrValue(details.metadata.generation) }
  ],
  loading,
  ...getCommonCardConfig(details.metadata.annotations, details.metadata.labels)
});

// Storage

const getPersistentVolumeClaimDetailsConfig = (details: PersistentVolumeClaimDetails, loading: boolean) => ({
  subHeading: !details.metadata ? '' : `${details.metadata.namespace}/${details.metadata.name}`,
  detailCard: [
    { label: 'Name', value: defaultOrValue(details.metadata.name) },
    { label: 'Resource Version', value: defaultOrValue(details.metadata.resourceVersion) },
    { label: 'Namespace', value: defaultOrValue(details.metadata.namespace) },
    { label: 'UID', value: defaultOrValue(details.metadata.uid) },
    { label: 'Age', value: defaultOrValue(details.metadata.creationTimestamp) },
    { label: 'Generate Name', value: defaultOrValue(details.metadata.generateName) },
    { label: 'Generation', value: defaultOrValue(details.metadata.generation) },
    { label: 'Storage ClassName', value: defaultOrValue(details.spec.storageClassName) },
    { label: 'Volume Attributes ClassName', value: defaultOrValue(details.spec.volumeAttributesClassName) },
    { label: 'Volume Mode', value: defaultOrValue(details.spec.volumeMode) },
    { label: 'Current Volume Attributes ClassName', value: defaultOrValue(details.status.currentVolumeAttributesClassName) },
    { label: 'Phase', value: defaultOrValue(details.status.phase) },

  ],
  loading,
  ...getCommonCardConfig(details.metadata.annotations, details.metadata.labels, details.status.conditions)
});

const getPersistentVolumeDetailsConfig = (details: PersistentVolumeDetails, loading: boolean) => ({
  subHeading: !details.metadata ? '' : `${details.metadata.name}`,
  detailCard: [
    { label: 'Name', value: defaultOrValue(details.metadata.name) },
    { label: 'Resource Version', value: defaultOrValue(details.metadata.resourceVersion) },
    { label: 'UID', value: defaultOrValue(details.metadata.uid) },
    { label: 'Age', value: defaultOrValue(details.metadata.creationTimestamp) },
    { label: 'Generate Name', value: defaultOrValue(details.metadata.generateName) },
    { label: 'Generation', value: defaultOrValue(details.metadata.generation) },
    { label: 'Storage ClassName', value: defaultOrValue(details.spec.storageClassName) },
    { label: 'Volume Attributes ClassName', value: defaultOrValue(details.spec.volumeAttributesClassName) },
    { label: 'Volume Mode', value: defaultOrValue(details.spec.volumeMode) },
    { label: 'Last Phase Transition Time', value: defaultOrValue(details.status.lastPhaseTransitionTime) },
    { label: 'Message', value: defaultOrValue(details.status.message) },
    { label: 'Phase', value: defaultOrValue(details.status.phase) },
    { label: 'Reason', value: defaultOrValue(details.status.reason) },

  ],
  loading,
  ...getCommonCardConfig(details.metadata.annotations, details.metadata.labels)
});

const getStorageClassDetailsConfig = (details: StorageClassDetails, loading: boolean) => ({
  subHeading: !details.metadata ? '' : `${details.metadata.name}`,
  detailCard: [
    {label: 'Name',value: defaultOrValue(details.metadata.name) },
    {label: 'Resource Version',value: defaultOrValue(details.metadata.resourceVersion) },
    {label: 'UID',value: defaultOrValue(details.metadata.uid) },
    {label: 'Age',value: defaultOrValue(details.metadata.creationTimestamp) },
    {label: 'Generate Name',value: defaultOrValue(details.metadata.generateName) },
    {label: 'Generation',value: defaultOrValue(details.metadata.generation) },
    {label: 'Deletion Grace Period Seconds',value: defaultOrValue(details.metadata.deletionGracePeriodSeconds) },
    {label: 'Deletion Timestamp',value: defaultOrValue(details.metadata.deletionTimestamp) },
    {label: 'Provisioner',value: defaultOrValue(details.provisioner) },
    {label: 'Reclaim Policy',value: defaultOrValue(details.reclaimPolicy) },
    {label: 'Volume Binding Mode',value: defaultOrValue(details.volumeBindingMode) }

  ],
  loading,
  ...getCommonCardConfig(details.metadata.annotations, details.metadata.labels)
});

// Custom Resource
const getCustomResourceDefinitionsDetailsConfig = (details: CustomResourcesDefinitionDetails, loading: boolean) => ({
  subHeading: !details.metadata ? '' : `${details.metadata.name}`,
  detailCard: [
    {label: 'Name',value: defaultOrValue(details.metadata.name) },
    {label: 'Resource Version',value: defaultOrValue(details.metadata.resourceVersion) },
    {label: 'UID',value: defaultOrValue(details.metadata.uid) },
    {label: 'Age',value: defaultOrValue(details.metadata.creationTimestamp) },
    {label: 'Generation',value: defaultOrValue(details.metadata.generation) }
  ],
  loading,
  ...getCommonCardConfig(details.metadata.annotations, details.metadata.labels)
});

const getCustomResourceDetailsConfig = (details: CustomResourceDetails, loading: boolean) => ({
  subHeading: !details.metadata ? '' : `${details.metadata.name}`,
  detailCard: [
    {label: 'Name',value: defaultOrValue(details.metadata.name) },
    {label: 'Resource Version',value: defaultOrValue(details.metadata.resourceVersion) },
    {label: 'Namespace',value: defaultOrValue(details.metadata.namespace) },
    {label: 'UID',value: defaultOrValue(details.metadata.uid) },
    {label: 'Age',value: defaultOrValue(details.metadata.creationTimestamp) },
    {label: 'Generation',value: defaultOrValue(details.metadata.generation) }
  ],
  loading,
  ...getCommonCardConfig(details.metadata.annotations, details.metadata.labels)
});

const getCommonCardConfig = (
  annotations: null | undefined | KeyValueNull,
  labels: null | undefined | KeyValueNull,
  conditions?: undefined | null | KeyValueNull[]
) => ({
  annotationCardDetails: getAnnotationCardDetails(annotations),
  lableConditionsCardDetails: getLabelConditionCardDetails(labels, conditions)
});

export {
  getNodeDetailsConfig,
  getNamespaceDetailsConfig,
  getLeaseDetailsConfig,
  getPodDetailsConfig,
  getDeploymentDetailsConfig,
  getDaemonSetDetailsConfig,
  getStatefulSetDetailsConfig,
  getReplicaSetDetailsConfig,
  getJobsDetailsConfig,
  getCronJobsDetailsConfig,
  getSecretDetailsConfig,
  getConfigMapDetailsConfig,
  getHPADetailsConfig,
  getLimitRangeDetailsConfig,
  getResourceQuotaDetailsConfig,
  getPriorityClassDetailsConfig,
  getRuntimeClassDetailsConfig,
  getPodDisruptionBudgetDetailsConfig,
  getServiceAccountDetailsConfig,
  getRoleDetailsConfig,
  getRoleBindingDetailsConfig,
  getClusterRoleDetailsConfig,
  getClusterRoleBindingDetailsConfig,
  getServiceDetailsConfig,
  getIngressDetailsConfig,
  getEndpointDetailsConfig,
  getPersistentVolumeClaimDetailsConfig,
  getPersistentVolumeDetailsConfig,
  getStorageClassDetailsConfig,
  getCustomResourceDetailsConfig,
  getCustomResourceDefinitionsDetailsConfig
};