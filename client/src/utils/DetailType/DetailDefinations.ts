import { CSIDriverDetails, CSINodeDetails, ClusterRoleBindingDetails, ClusterRoleDetails, ConfigMapDetails, CronJobDetails, CustomResourceDetails, CustomResourcesDefinitionDetails, DaemonSetDetails, DeploymentDetails, EndpointDetails, HPADetails, IngressDetails, JobDetails, KeyValueNull, LeaseDetails, LimitRangeDetails, NamespaceDetails, NodeDetails, PersistentVolumeClaimDetails, PersistentVolumeDetails, PodDetails, PodDisruptionBudgetDetails, PriorityClassDetails, ReplicaSetDetails, ResourceQuotaDetails, RoleBindingDetails, RoleDetails, RuntimeClassDetails, SecretDetails, ServiceAccountDetails, ServiceDetails, NetworkPolicyDetails, StatefulSetDetails, StorageClassDetails, VolumeAttributesClassDetails } from "@/types";
import { defaultOrKeyValuePairs, defaultOrValue, defaultOrValueObject, getAnnotationCardDetails, getControlledByDetail, getLabelConditionCardDetails, getServiceAccountDetail } from "../MiscUtils";

// Cluster

const getNodeDetailsConfig = (details: NodeDetails, loading: boolean) => ({
  subHeading: !details.metadata ? '' : details.metadata.name,
  detailCard: [
    { label: 'Name', value: defaultOrValue(details.metadata.name) },
    { label: 'Namespace', value: defaultOrValue(details.metadata.namespace) },
    { label: 'Age', value: defaultOrValue(details.metadata.creationTimestamp) },
    getControlledByDetail(details.metadata.ownerReferences, details.metadata.namespace),
    { label: 'Unschedulable', value: defaultOrValue(details.spec.unschedulable) },
    { label: 'Provider Id', value: defaultOrValue(details.spec.providerID) },
    { label: 'External Id', value: defaultOrValue(details.spec.externalID) },
    { label: 'Generate Name', value: defaultOrValue(details.metadata.generateName) },
    { label: 'Generation', value: defaultOrValue(details.metadata.generation) },
    { label: 'Deletion Grace Period Seconds', value: defaultOrValue(details.metadata.deletionGracePeriodSeconds) },
    { label: 'Resource Version', value: defaultOrValue(details.metadata.resourceVersion) },
    { label: 'UID', value: defaultOrValue(details.metadata.uid) }
  ],
  loading,
  ...getCommonCardConfig(details.metadata.annotations, details.metadata.labels, details.status.conditions)
});

const getNamespaceDetailsConfig = (details: NamespaceDetails, loading: boolean) => ({
  subHeading: !details.metadata ? '' : details.metadata.name,
  detailCard: [
    { label: 'Name', value: defaultOrValue(details.metadata.name) },
    { label: 'Namespace', value: defaultOrValue(details.metadata.namespace) },
    { label: 'Age', value: defaultOrValue(details.metadata.creationTimestamp) },
    getControlledByDetail(details.metadata.ownerReferences, details.metadata.namespace),
    { label: 'Generate Name', value: defaultOrValue(details.metadata.generateName) },
    { label: 'Generation', value: defaultOrValue(details.metadata.generation) },
    { label: 'Deletion Grace Period Seconds', value: defaultOrValue(details.metadata.deletionGracePeriodSeconds) },
    { label: 'Resource Version', value: defaultOrValue(details.metadata.resourceVersion) },
    { label: 'UID', value: defaultOrValue(details.metadata.uid) }
  ],
  loading,
  ...getCommonCardConfig(details.metadata.annotations, details.metadata.labels, details.status.conditions)
});

const getLeaseDetailsConfig = (details: LeaseDetails, loading: boolean) => ({
  subHeading: !details.metadata ? '' : `${details.metadata.namespace}/${details.metadata.name}`,
  detailCard: [
    { label: 'Name', value: defaultOrValue(details.metadata.name) },
    { label: 'Namespace', value: defaultOrValue(details.metadata.namespace) },
    { label: 'Age', value: defaultOrValue(details.metadata.creationTimestamp) },
    getControlledByDetail(details.metadata.ownerReferences, details.metadata.namespace),
    { label: 'Generate Name', value: defaultOrValue(details.metadata.generateName) },
    { label: 'Generation', value: defaultOrValue(details.metadata.generation) },
    { label: 'Deletion Grace Period Seconds', value: defaultOrValue(details.metadata.deletionGracePeriodSeconds) },
    { label: 'Resource Version', value: defaultOrValue(details.metadata.resourceVersion) },
    { label: 'UID', value: defaultOrValue(details.metadata.uid) }
  ],
  loading,
  ...getCommonCardConfig(details.metadata.annotations, details.metadata.labels)
});

// Workload

const getPodDetailsConfig = (details: PodDetails, loading: boolean) => ({
  subHeading: !details.metadata ? '' : `${details.metadata.namespace}/${details.metadata.name}`,
  detailCard: [
    { label: 'Name', value: defaultOrValue(details.metadata.name) },
    { label: 'Namespace', value: defaultOrValue(details.metadata.namespace) },
    { label: 'Age', value: defaultOrValue(details.metadata.creationTimestamp) },
    getControlledByDetail(details.metadata.ownerReferences, details.metadata.namespace),
    { label: 'Phase', value: defaultOrValue(details.status.phase) },
    { label: 'Node Name', value: defaultOrValue(details.spec.nodeName) },
    { label: 'PodIp', value: defaultOrValue(details.status.podIP) },
    { label: 'HostIp', value: defaultOrValue(details.status.hostIP) },
    { label: 'QoS Class', value: defaultOrValue(details.status.qosClass) },
    getServiceAccountDetail(details.spec.serviceAccountName, details.metadata.namespace),
    { label: 'Restart Policy', value: defaultOrValue(details.spec.restartPolicy) },
    { label: 'DNS Policy', value: defaultOrValue(details.spec.dnsPolicy) },
    { label: 'Node Selector', value: defaultOrKeyValuePairs(details.spec.nodeSelector) },
    { label: 'Priority Class', value: defaultOrValue(details.spec.priorityClassName) },
    { label: 'Priority', value: defaultOrValue(details.spec.priority) },
    { label: 'Preemption Policy', value: defaultOrValue(details.spec.preemptionPolicy) },
    { label: 'Scheduler Name', value: defaultOrValue(details.spec.schedulerName) },
    { label: 'Termination GracePeriod Seconds', value: defaultOrValue(details.spec.terminationGracePeriodSeconds) },
    { label: 'Generate Name', value: defaultOrValue(details.metadata.generateName) },
    { label: 'Resource Version', value: defaultOrValue(details.metadata.resourceVersion) },
    { label: 'UID', value: defaultOrValue(details.metadata.uid) }
  ],
  loading,
  ...getCommonCardConfig(details.metadata.annotations, details.metadata.labels, details.status.conditions)
});

const getDeploymentDetailsConfig = (details: DeploymentDetails, loading: boolean) => ({
  subHeading: !details.metadata ? '' : `${details.metadata.namespace}/${details.metadata.name}`,
  detailCard: [
    { label: 'Name', value: defaultOrValue(details.metadata.name) },
    { label: 'Namespace', value: defaultOrValue(details.metadata.namespace) },
    { label: 'Age', value: defaultOrValue(details.metadata.creationTimestamp) },
    getControlledByDetail(details.metadata.ownerReferences, details.metadata.namespace),
    { label: 'Replicas', value: defaultOrValue(details.spec.replicas) },
    { label: 'Ready Replicas', value: defaultOrValue(details.status.readyReplicas) },
    { label: 'Available Replicas', value: defaultOrValue(details.status.availableReplicas) },
    { label: 'Updated Replicas', value: defaultOrValue(details.status.updatedReplicas) },
    { label: 'Unavailable Replicas', value: defaultOrValue(details.status.unavailableReplicas) },
    { label: 'Strategy Type', value: defaultOrValue(details.spec.strategy?.type) },
    { label: 'Max Surge', value: defaultOrValue(details.spec.strategy?.rollingUpdate?.maxSurge) },
    { label: 'Max Unavailable', value: defaultOrValue(details.spec.strategy?.rollingUpdate?.maxUnavailable) },
    { label: 'Min. Ready Seconds', value: defaultOrValue(details.spec.minReadySeconds) },
    { label: 'Progress Deadline Seconds', value: defaultOrValue(details.spec.progressDeadlineSeconds) },
    { label: 'Revision History Limit', value: defaultOrValue(details.spec.revisionHistoryLimit) },
    { label: 'Observed Generation', value: defaultOrValue(details.status.observedGeneration) },
    { label: 'Generation', value: defaultOrValue(details.metadata.generation) },
    { label: 'Resource Version', value: defaultOrValue(details.metadata.resourceVersion) },
    { label: 'UID', value: defaultOrValue(details.metadata.uid) }
  ],
  loading,
  ...getCommonCardConfig(details.metadata.annotations, details.metadata.labels, details.status.conditions)
});

const getDaemonSetDetailsConfig = (details: DaemonSetDetails, loading: boolean) => ({
  subHeading: !details.metadata ? '' : `${details.metadata.namespace}/${details.metadata.name}`,
  detailCard: [
    { label: 'Name', value: defaultOrValue(details.metadata.name) },
    { label: 'Namespace', value: defaultOrValue(details.metadata.namespace) },
    { label: 'Age', value: defaultOrValue(details.metadata.creationTimestamp) },
    getControlledByDetail(details.metadata.ownerReferences, details.metadata.namespace),
    { label: 'Ready', value: defaultOrValue(details.status.numberReady) },
    { label: 'Desired Number Scheduled', value: defaultOrValue(details.status.desiredNumberScheduled) },
    { label: 'Current Number Scheduled', value: defaultOrValue(details.status.currentNumberScheduled) },
    { label: 'Number Misscheduled', value: defaultOrValue(details.status.numberMisscheduled) },
    { label: 'Update Strategy', value: defaultOrValue(details.spec.updateStrategy?.type) },
    { label: 'Max Surge', value: defaultOrValue(details.spec.updateStrategy?.rollingUpdate?.maxSurge) },
    { label: 'Max Unavailable', value: defaultOrValue(details.spec.updateStrategy?.rollingUpdate?.maxUnavailable) },
    { label: 'Min. Ready Seconds', value: defaultOrValue(details.spec.minReadySeconds) },
    { label: 'Revision History Limit', value: defaultOrValue(details.spec.revisionHistoryLimit) },
    { label: 'Collision Count', value: defaultOrValue(details.status.collisionCount) },
    { label: 'Observed Generation', value: defaultOrValue(details.status.observedGeneration) },
    { label: 'Generate Name', value: defaultOrValue(details.metadata.generateName) },
    { label: 'Generation', value: defaultOrValue(details.metadata.generation) },
    { label: 'Resource Version', value: defaultOrValue(details.metadata.resourceVersion) },
    { label: 'UID', value: defaultOrValue(details.metadata.uid) }
  ],
  loading,
  ...getCommonCardConfig(details.metadata.annotations, details.metadata.labels, details.status.conditions)
});

const getStatefulSetDetailsConfig = (details: StatefulSetDetails, loading: boolean) => ({
  subHeading: !details.metadata ? '' : `${details.metadata.namespace}/${details.metadata.name}`,
  detailCard: [
    { label: 'Name', value: defaultOrValue(details.metadata.name) },
    { label: 'Namespace', value: defaultOrValue(details.metadata.namespace) },
    { label: 'Age', value: defaultOrValue(details.metadata.creationTimestamp) },
    getControlledByDetail(details.metadata.ownerReferences, details.metadata.namespace),
    { label: 'Ready Replicas', value: defaultOrValue(details.status.readyReplicas) },
    { label: 'Desired Replicas', value: defaultOrValue(details.status.replicas) },
    { label: 'Current Replicas', value: defaultOrValue(details.status.currentReplicas) },
    { label: 'Available Replicas', value: defaultOrValue(details.status.availableReplicas) },
    { label: 'Observed Replicas', value: defaultOrValue(details.spec.replicas) },
    { label: 'Min. Ready Seconds', value: defaultOrValue(details.spec.minReadySeconds) },
    { label: 'Observed Generation', value: defaultOrValue(details.status.observedGeneration) },
    { label: 'Generate Name', value: defaultOrValue(details.metadata.generateName) },
    { label: 'Generation', value: defaultOrValue(details.metadata.generation) },
    { label: 'Resource Version', value: defaultOrValue(details.metadata.resourceVersion) },
    { label: 'UID', value: defaultOrValue(details.metadata.uid) }
  ],
  loading,
  ...getCommonCardConfig(details.metadata.annotations, details.metadata.labels, details.status.conditions)
});

const getReplicaSetDetailsConfig = (details: ReplicaSetDetails, loading: boolean) => ({
  subHeading: !details.metadata ? '' : `${details.metadata.namespace}/${details.metadata.name}`,
  detailCard: [
    { label: 'Name', value: defaultOrValue(details.metadata.name) },
    { label: 'Namespace', value: defaultOrValue(details.metadata.namespace) },
    { label: 'Age', value: defaultOrValue(details.metadata.creationTimestamp) },
    getControlledByDetail(details.metadata.ownerReferences, details.metadata.namespace),
    { label: 'Ready Replicas', value: defaultOrValue(details.status.readyReplicas) },
    { label: 'Desired Replicas', value: defaultOrValue(details.status.replicas) },
    { label: 'Available Replicas', value: defaultOrValue(details.status.availableReplicas) },
    { label: 'Fully Labeled Replicas', value: defaultOrValue(details.status.fullyLabeledReplicas) },
    { label: 'Observed Replicas', value: defaultOrValue(details.spec.replicas) },
    { label: 'Min. Ready Seconds', value: defaultOrValue(details.spec.minReadySeconds) },
    { label: 'Observed Generation', value: defaultOrValue(details.status.observedGeneration) },
    { label: 'Generate Name', value: defaultOrValue(details.metadata.generateName) },
    { label: 'Generation', value: defaultOrValue(details.metadata.generation) },
    { label: 'Resource Version', value: defaultOrValue(details.metadata.resourceVersion) },
    { label: 'UID', value: defaultOrValue(details.metadata.uid) }
  ],
  loading,
  ...getCommonCardConfig(details.metadata.annotations, details.metadata.labels, details.status.conditions)
});

const getJobsDetailsConfig = (details: JobDetails, loading: boolean) => ({
  subHeading: !details.metadata ? '' : `${details.metadata.namespace}/${details.metadata.name}`,
  detailCard: [
    { label: 'Name', value: defaultOrValue(details.metadata.name) },
    { label: 'Namespace', value: defaultOrValue(details.metadata.namespace) },
    { label: 'Age', value: defaultOrValue(details.metadata.creationTimestamp) },
    getControlledByDetail(details.metadata.ownerReferences, details.metadata.namespace),
    { label: 'Ready', value: defaultOrValue(details.status.ready) },
    { label: 'Active', value: defaultOrValue(details.status.active) },
    { label: 'Failed', value: defaultOrValue(details.status.failed) },
    { label: 'Completions', value: defaultOrValue(details.spec.completions) },
    { label: 'Parallelism', value: defaultOrValue(details.spec.parallelism) },
    { label: 'Backoff Limit', value: defaultOrValue(details.spec.backoffLimit) },
    { label: 'Suspend', value: defaultOrValue(details.spec.suspend) },
    { label: 'Completion Mode', value: defaultOrValue(details.spec.completionMode) },
    { label: 'Completed Indexes', value: defaultOrValue(details.status.completedIndexes) },
    { label: 'Failed Indexes', value: defaultOrValue(details.status.failedIndexes) },
    { label: 'TTLSecondsAfterFinished', value: defaultOrValue(details.spec.ttlSecondsAfterFinished) },
    { label: 'Generate Name', value: defaultOrValue(details.metadata.generateName) },
    { label: 'Generation', value: defaultOrValue(details.metadata.generation) },
    { label: 'Resource Version', value: defaultOrValue(details.metadata.resourceVersion) },
    { label: 'UID', value: defaultOrValue(details.metadata.uid) }
  ],
  loading,
  ...getCommonCardConfig(details.metadata.annotations, details.metadata.labels, details.status.conditions)
});

const getCronJobsDetailsConfig = (details: CronJobDetails, loading: boolean) => ({
  subHeading: !details.metadata ? '' : `${details.metadata.namespace}/${details.metadata.name}`,
  detailCard: [
    { label: 'Name', value: defaultOrValue(details.metadata.name) },
    { label: 'Namespace', value: defaultOrValue(details.metadata.namespace) },
    { label: 'Age', value: defaultOrValue(details.metadata.creationTimestamp) },
    getControlledByDetail(details.metadata.ownerReferences, details.metadata.namespace),
    { label: 'Concurrency Policy', value: defaultOrValue(details.spec.concurrencyPolicy) },
    { label: 'Failed Jobs History Limit', value: defaultOrValue(details.spec.failedJobsHistoryLimit) },
    { label: 'Generate Name', value: defaultOrValue(details.metadata.generateName) },
    { label: 'Resource Version', value: defaultOrValue(details.metadata.resourceVersion) },
    { label: 'UID', value: defaultOrValue(details.metadata.uid) }
  ],
  loading,
  ...getCommonCardConfig(details.metadata.annotations, details.metadata.labels)
});

// Configuration
const getSecretDetailsConfig = (details: SecretDetails, loading: boolean) => ({
  subHeading: !details.metadata ? '' : `${details.metadata.namespace}/${details.metadata.name}`,
  detailCard: [
    { label: 'Name', value: defaultOrValue(details.metadata.name) },
    { label: 'Namespace', value: defaultOrValue(details.metadata.namespace) },
    { label: 'Age', value: defaultOrValue(details.metadata.creationTimestamp) },
    getControlledByDetail(details.metadata.ownerReferences, details.metadata.namespace),
    { label: 'Type', value: defaultOrValue(details.type) },
    { label: 'Immutable', value: defaultOrValue(typeof (details.immutable) === 'boolean' ? String(details.immutable) : details.immutable) },
    { label: 'Generate Name', value: defaultOrValue(details.metadata.generateName) },
    { label: 'Generation', value: defaultOrValue(details.metadata.generation) },
    { label: 'Resource Version', value: defaultOrValue(details.metadata.resourceVersion) },
    { label: 'UID', value: defaultOrValue(details.metadata.uid) }
  ],
  loading,
  ...getCommonCardConfig(details.metadata.annotations, details.metadata.labels)
});

const getConfigMapDetailsConfig = (details: ConfigMapDetails, loading: boolean) => ({
  subHeading: !details.metadata ? '' : `${details.metadata.namespace}/${details.metadata.name}`,
  detailCard: [
    { label: 'Name', value: defaultOrValue(details.metadata.name) },
    { label: 'Namespace', value: defaultOrValue(details.metadata.namespace) },
    { label: 'Age', value: defaultOrValue(details.metadata.creationTimestamp) },
    getControlledByDetail(details.metadata.ownerReferences, details.metadata.namespace),
    { label: 'Immutable', value: defaultOrValue(typeof (details.immutable) === 'boolean' ? String(details.immutable) : details.immutable) },
    { label: 'Generate Name', value: defaultOrValue(details.metadata.generateName) },
    { label: 'Generation', value: defaultOrValue(details.metadata.generation) },
    { label: 'Resource Version', value: defaultOrValue(details.metadata.resourceVersion) },
    { label: 'UID', value: defaultOrValue(details.metadata.uid) }
  ],
  loading,
  ...getCommonCardConfig(details.metadata.annotations, details.metadata.labels)
});

const getHPADetailsConfig = (details: HPADetails, loading: boolean) => ({
  subHeading: !details.metadata ? '' : `${details.metadata.namespace}/${details.metadata.name}`,
  detailCard: [
    { label: 'Name', value: defaultOrValue(details.metadata.name) },
    { label: 'Namespace', value: defaultOrValue(details.metadata.namespace) },
    { label: 'Age', value: defaultOrValue(details.metadata.creationTimestamp) },
    getControlledByDetail(details.metadata.ownerReferences, details.metadata.namespace),
    { label: 'Minimum Replicas', value: defaultOrValue(details.spec.minReplicas) },
    { label: 'Maximum Replicas', value: defaultOrValue(details.spec.maxReplicas) },
    { label: 'Generate Name', value: defaultOrValue(details.metadata.generateName) },
    { label: 'Generation', value: defaultOrValue(details.metadata.generation) },
    { label: 'Resource Version', value: defaultOrValue(details.metadata.resourceVersion) },
    { label: 'UID', value: defaultOrValue(details.metadata.uid) }
  ],
  loading,
  ...getCommonCardConfig(details.metadata.annotations, details.metadata.labels, details.status.conditions)
});

const getLimitRangeDetailsConfig = (details: LimitRangeDetails, loading: boolean) => ({
  subHeading: !details.metadata ? '' : `${details.metadata.namespace}/${details.metadata.name}`,
  detailCard: [
    { label: 'Name', value: defaultOrValue(details.metadata.name) },
    { label: 'Namespace', value: defaultOrValue(details.metadata.namespace) },
    { label: 'Age', value: defaultOrValue(details.metadata.creationTimestamp) },
    getControlledByDetail(details.metadata.ownerReferences, details.metadata.namespace),
    { label: 'Generate Name', value: defaultOrValue(details.metadata.generateName) },
    { label: 'Generation', value: defaultOrValue(details.metadata.generation) },
    { label: 'Resource Version', value: defaultOrValue(details.metadata.resourceVersion) },
    { label: 'UID', value: defaultOrValue(details.metadata.uid) }
  ],
  loading,
  ...getCommonCardConfig(details.metadata.annotations, details.metadata.labels)
});

const getResourceQuotaDetailsConfig = (details: ResourceQuotaDetails, loading: boolean) => ({
  subHeading: !details.metadata ? '' : `${details.metadata.namespace}/${details.metadata.name}`,
  detailCard: [
    { label: 'Name', value: defaultOrValue(details.metadata.name) },
    { label: 'Namespace', value: defaultOrValue(details.metadata.namespace) },
    { label: 'Age', value: defaultOrValue(details.metadata.creationTimestamp) },
    getControlledByDetail(details.metadata.ownerReferences, details.metadata.namespace),
    { label: 'Generate Name', value: defaultOrValue(details.metadata.generateName) },
    { label: 'Generation', value: defaultOrValue(details.metadata.generation) },
    { label: 'Resource Version', value: defaultOrValue(details.metadata.resourceVersion) },
    { label: 'UID', value: defaultOrValue(details.metadata.uid) }
  ],
  loading,
  ...getCommonCardConfig(details.metadata.annotations, details.metadata.labels)
});

const getPriorityClassDetailsConfig = (details: PriorityClassDetails, loading: boolean) => ({
  subHeading: !details.metadata ? '' : `${details.metadata.name}`,
  detailCard: [
    { label: 'Name', value: defaultOrValue(details.metadata.name) },
    { label: 'Namespace', value: defaultOrValue(details.metadata.namespace) },
    { label: 'Age', value: defaultOrValue(details.metadata.creationTimestamp) },
    getControlledByDetail(details.metadata.ownerReferences, details.metadata.namespace),
    { label: 'Generate Name', value: defaultOrValue(details.metadata.generateName) },
    { label: 'Generation', value: defaultOrValue(details.metadata.generation) },
    { label: 'Resource Version', value: defaultOrValue(details.metadata.resourceVersion) },
    { label: 'UID', value: defaultOrValue(details.metadata.uid) }
  ],
  loading,
  ...getCommonCardConfig(details.metadata.annotations, details.metadata.labels)
});

const getRuntimeClassDetailsConfig = (details: RuntimeClassDetails, loading: boolean) => ({
  subHeading: !details.metadata ? '' : `${details.metadata.name}`,
  detailCard: [
    { label: 'Name', value: defaultOrValue(details.metadata.name) },
    { label: 'Namespace', value: defaultOrValue(details.metadata.namespace) },
    { label: 'Age', value: defaultOrValue(details.metadata.creationTimestamp) },
    getControlledByDetail(details.metadata.ownerReferences, details.metadata.namespace),
    { label: 'Generate Name', value: defaultOrValue(details.metadata.generateName) },
    { label: 'Generation', value: defaultOrValue(details.metadata.generation) },
    { label: 'Resource Version', value: defaultOrValue(details.metadata.resourceVersion) },
    { label: 'UID', value: defaultOrValue(details.metadata.uid) }
  ],
  loading,
  ...getCommonCardConfig(details.metadata.annotations, details.metadata.labels)
});

const getPodDisruptionBudgetDetailsConfig = (details: PodDisruptionBudgetDetails, loading: boolean) => ({
  subHeading: !details.metadata ? '' : `${details.metadata.namespace}/${details.metadata.name}`,
  detailCard: [
    { label: 'Name', value: defaultOrValue(details.metadata.name) },
    { label: 'Namespace', value: defaultOrValue(details.metadata.namespace) },
    { label: 'Age', value: defaultOrValue(details.metadata.creationTimestamp) },
    getControlledByDetail(details.metadata.ownerReferences, details.metadata.namespace),
    { label: 'Current Healthy', value: defaultOrValue(details.status.currentHealthy.toString()) },
    { label: 'Desired Healthy', value: defaultOrValue(details.status.desiredHealthy.toString()) },
    { label: 'Disruptions Allowed', value: defaultOrValue(details.status.disruptionsAllowed.toString()) },
    { label: 'Expected Pods', value: defaultOrValue(details.status.expectedPods.toString()) },
    { label: 'Observed Generation', value: defaultOrValue(details.status.observedGeneration?.toString()) },
    { label: 'Generate Name', value: defaultOrValue(details.metadata.generateName) },
    { label: 'Generation', value: defaultOrValue(details.metadata.generation?.toString()) },
    { label: 'Resource Version', value: defaultOrValue(details.metadata.resourceVersion) },
    { label: 'UID', value: defaultOrValue(details.metadata.uid) }
  ],
  loading,
  ...getCommonCardConfig(details.metadata.annotations, details.metadata.labels, details.status.conditions)
});

// Access Control
const getServiceAccountDetailsConfig = (details: ServiceAccountDetails, loading: boolean) => ({
  subHeading: !details.metadata ? '' : `${details.metadata.namespace}/${details.metadata.name}`,
  detailCard: [
    { label: 'Name', value: defaultOrValue(details.metadata.name) },
    { label: 'Namespace', value: defaultOrValue(details.metadata.namespace) },
    { label: 'Age', value: defaultOrValue(details.metadata.creationTimestamp) },
    getControlledByDetail(details.metadata.ownerReferences, details.metadata.namespace),
    { label: 'AutoMount Service Account Token', value: defaultOrValue(typeof (details.automountServiceAccountToken) === 'boolean' ? String(details.automountServiceAccountToken) : details.automountServiceAccountToken) },
    { label: 'Generate Name', value: defaultOrValue(details.metadata.generateName) },
    { label: 'Generation', value: defaultOrValue(details.metadata.generation) },
    { label: 'Resource Version', value: defaultOrValue(details.metadata.resourceVersion) },
    { label: 'UID', value: defaultOrValue(details.metadata.uid) }
  ],
  loading,
  ...getCommonCardConfig(details.metadata.annotations, details.metadata.labels)
});

const getRoleDetailsConfig = (details: RoleDetails, loading: boolean) => ({
  subHeading: !details.metadata ? '' : `${details.metadata.namespace}/${details.metadata.name}`,
  detailCard: [
    { label: 'Name', value: defaultOrValue(details.metadata.name) },
    { label: 'Namespace', value: defaultOrValue(details.metadata.namespace) },
    { label: 'Age', value: defaultOrValue(details.metadata.creationTimestamp) },
    getControlledByDetail(details.metadata.ownerReferences, details.metadata.namespace),
    { label: 'Generate Name', value: defaultOrValue(details.metadata.generateName) },
    { label: 'Generation', value: defaultOrValue(details.metadata.generation) },
    { label: 'Deletion Grace Period Seconds', value: defaultOrValue(details.metadata.deletionGracePeriodSeconds) },
    { label: 'Resource Version', value: defaultOrValue(details.metadata.resourceVersion) },
    { label: 'UID', value: defaultOrValue(details.metadata.uid) }
  ],
  loading,
  ...getCommonCardConfig(details.metadata.annotations, details.metadata.labels)
});

const getRoleBindingDetailsConfig = (details: RoleBindingDetails, loading: boolean) => ({
  subHeading: !details.metadata ? '' : `${details.metadata.namespace}/${details.metadata.name}`,
  detailCard: [
    { label: 'Name', value: defaultOrValue(details.metadata.name) },
    { label: 'Namespace', value: defaultOrValue(details.metadata.namespace) },
    { label: 'Age', value: defaultOrValue(details.metadata.creationTimestamp) },
    getControlledByDetail(details.metadata.ownerReferences, details.metadata.namespace),
    { label: 'Resource Kind', value: defaultOrValue(details.roleRef?.kind) },
    { label: 'Group Name', value: defaultOrValue(details.roleRef?.name) },
    { label: 'API Group', value: defaultOrValue(details.roleRef?.apiGroup) },
    { label: 'Generate Name', value: defaultOrValue(details.metadata.generateName) },
    { label: 'Generation', value: defaultOrValue(details.metadata.generation) },
    { label: 'Deletion Grace Period Seconds', value: defaultOrValue(details.metadata.deletionGracePeriodSeconds) },
    { label: 'Resource Version', value: defaultOrValue(details.metadata.resourceVersion) },
    { label: 'UID', value: defaultOrValue(details.metadata.uid) }
  ],
  loading,
  ...getCommonCardConfig(details.metadata.annotations, details.metadata.labels)
});

const getClusterRoleDetailsConfig = (details: ClusterRoleDetails, loading: boolean) => ({
  subHeading: !details.metadata ? '' : `${details.metadata.name}`,
  detailCard: [
    { label: 'Name', value: defaultOrValue(details.metadata.name) },
    { label: 'Namespace', value: defaultOrValue(details.metadata.namespace) },
    { label: 'Age', value: defaultOrValue(details.metadata.creationTimestamp) },
    getControlledByDetail(details.metadata.ownerReferences, details.metadata.namespace),
    { label: 'Generate Name', value: defaultOrValue(details.metadata.generateName) },
    { label: 'Generation', value: defaultOrValue(details.metadata.generation) },
    { label: 'Deletion Grace Period Seconds', value: defaultOrValue(details.metadata.deletionGracePeriodSeconds) },
    { label: 'Resource Version', value: defaultOrValue(details.metadata.resourceVersion) },
    { label: 'UID', value: defaultOrValue(details.metadata.uid) }
  ],
  loading,
  ...getCommonCardConfig(details.metadata.annotations, details.metadata.labels)
});

const getClusterRoleBindingDetailsConfig = (details: ClusterRoleBindingDetails, loading: boolean) => ({
  subHeading: !details.metadata ? '' : `${details.metadata.name}`,
  detailCard: [
    { label: 'Name', value: defaultOrValue(details.metadata.name) },
    { label: 'Namespace', value: defaultOrValue(details.metadata.namespace) },
    { label: 'Age', value: defaultOrValue(details.metadata.creationTimestamp) },
    getControlledByDetail(details.metadata.ownerReferences, details.metadata.namespace),
    { label: 'Resource Kind', value: defaultOrValue(details.roleRef?.kind) },
    { label: 'Group Name', value: defaultOrValue(details.roleRef?.name) },
    { label: 'API Group', value: defaultOrValue(details.roleRef?.apiGroup) },
    { label: 'Generate Name', value: defaultOrValue(details.metadata.generateName) },
    { label: 'Generation', value: defaultOrValue(details.metadata.generation) },
    { label: 'Deletion Grace Period Seconds', value: defaultOrValue(details.metadata.deletionGracePeriodSeconds) },
    { label: 'Resource Version', value: defaultOrValue(details.metadata.resourceVersion) },
    { label: 'UID', value: defaultOrValue(details.metadata.uid) }
  ],
  loading,
  ...getCommonCardConfig(details.metadata.annotations, details.metadata.labels)
});

// Network
const getServiceDetailsConfig = (details: ServiceDetails, loading: boolean) => ({
  subHeading: !details.metadata ? '' : `${details.metadata.namespace}/${details.metadata.name}`,
  detailCard: [
    { label: 'Name', value: defaultOrValue(details.metadata.name) },
    { label: 'Namespace', value: defaultOrValue(details.metadata.namespace) },
    { label: 'Age', value: defaultOrValue(details.metadata.creationTimestamp) },
    getControlledByDetail(details.metadata.ownerReferences, details.metadata.namespace),
    { label: 'Type', value: defaultOrValue(details.spec.type) },
    { label: 'Cluster IP', value: defaultOrValue(details.spec.clusterIP) },
    { label: 'Internal Traffic Policy', value: defaultOrValue(details.spec.internalTrafficPolicy) },
    { label: 'IP Family Policy', value: defaultOrValue(details.spec.ipFamilyPolicy) },
    { label: 'Session Affinity', value: defaultOrValue(details.spec.sessionAffinity) },
    { label: 'Generate Name', value: defaultOrValue(details.metadata.generateName) },
    { label: 'Generation', value: defaultOrValue(details.metadata.generation) },
    { label: 'Resource Version', value: defaultOrValue(details.metadata.resourceVersion) },
    { label: 'UID', value: defaultOrValue(details.metadata.uid) }
  ],
  loading,
  ...getCommonCardConfig(details.metadata.annotations, details.metadata.labels, details.status.conditions)
});

const getNetworkPolicyDetailsConfig = (details: NetworkPolicyDetails, loading: boolean) => ({
  subHeading: !details.metadata ? '' : `${details.metadata.namespace}/${details.metadata.name}`,
  detailCard: [
    { label: 'Name', value: defaultOrValue(details.metadata?.name) },
    { label: 'Namespace', value: defaultOrValue(details.metadata?.namespace) },
    { label: 'Age', value: defaultOrValue(details.metadata?.creationTimestamp) },
    getControlledByDetail(details.metadata?.ownerReferences, details.metadata?.namespace),
    { label: 'Policy Types', value: defaultOrValueObject(details.spec?.policyTypes ?? []) },
    { label: 'Ingress Rules', value: String(details.spec?.ingress?.length ?? 0) },
    { label: 'Egress Rules', value: String(details.spec?.egress?.length ?? 0) },
    { label: 'Generate Name', value: defaultOrValue(details.metadata?.generateName) },
    { label: 'Generation', value: defaultOrValue(details.metadata?.generation) },
    { label: 'Resource Version', value: defaultOrValue(details.metadata?.resourceVersion) },
    { label: 'UID', value: defaultOrValue(details.metadata?.uid) }
  ],
  loading,
  ...getCommonCardConfig(details.metadata?.annotations, details.metadata?.labels)
});

const getIngressDetailsConfig = (details: IngressDetails, loading: boolean) => ({
  subHeading: !details.metadata ? '' : `${details.metadata.namespace}/${details.metadata.name}`,
  detailCard: [
    { label: 'Name', value: defaultOrValue(details.metadata.name) },
    { label: 'Namespace', value: defaultOrValue(details.metadata.namespace) },
    { label: 'Age', value: defaultOrValue(details.metadata.creationTimestamp) },
    getControlledByDetail(details.metadata.ownerReferences, details.metadata.namespace),
    { label: 'Ingress Class Name', value: defaultOrValue(details.spec.ingressClassName) },
    { label: 'Service Name', value: defaultOrValue(details.spec.defaultBackend?.service?.name) },
    { label: 'Port Number', value: defaultOrValue(details.spec.defaultBackend?.service?.port?.number) },
    { label: 'Port Name', value: defaultOrValue(details.spec.defaultBackend?.service?.port?.name) },
    { label: 'Resource Name', value: defaultOrValue(details.spec.defaultBackend?.resource?.name) },
    { label: 'Resource Kind', value: defaultOrValue(details.spec.defaultBackend?.resource?.kind) },
    { label: 'Resource API Group', value: defaultOrValue(details.spec.defaultBackend?.resource?.apiGroup) },
    { label: 'Generate Name', value: defaultOrValue(details.metadata.generateName) },
    { label: 'Generation', value: defaultOrValue(details.metadata.generation) },
    { label: 'Resource Version', value: defaultOrValue(details.metadata.resourceVersion) },
    { label: 'UID', value: defaultOrValue(details.metadata.uid) }
  ],
  loading,
  ...getCommonCardConfig(details.metadata.annotations, details.metadata.labels)
});

const getEndpointDetailsConfig = (details: EndpointDetails, loading: boolean) => ({
  subHeading: !details.metadata ? '' : `${details.metadata.namespace}/${details.metadata.name}`,
  detailCard: [
    { label: 'Name', value: defaultOrValue(details.metadata.name) },
    { label: 'Namespace', value: defaultOrValue(details.metadata.namespace) },
    { label: 'Age', value: defaultOrValue(details.metadata.creationTimestamp) },
    getControlledByDetail(details.metadata.ownerReferences, details.metadata.namespace),
    { label: 'Generate Name', value: defaultOrValue(details.metadata.generateName) },
    { label: 'Generation', value: defaultOrValue(details.metadata.generation) },
    { label: 'Resource Version', value: defaultOrValue(details.metadata.resourceVersion) },
    { label: 'UID', value: defaultOrValue(details.metadata.uid) }
  ],
  loading,
  ...getCommonCardConfig(details.metadata.annotations, details.metadata.labels)
});

// Storage

const getPersistentVolumeClaimDetailsConfig = (details: PersistentVolumeClaimDetails, loading: boolean) => ({
  subHeading: !details.metadata ? '' : `${details.metadata.namespace}/${details.metadata.name}`,
  detailCard: [
    { label: 'Name', value: defaultOrValue(details.metadata.name) },
    { label: 'Namespace', value: defaultOrValue(details.metadata.namespace) },
    { label: 'Age', value: defaultOrValue(details.metadata.creationTimestamp) },
    getControlledByDetail(details.metadata.ownerReferences, details.metadata.namespace),
    { label: 'Phase', value: defaultOrValue(details.status.phase) },
    { label: 'Storage ClassName', value: defaultOrValue(details.spec.storageClassName) },
    { label: 'Volume Mode', value: defaultOrValue(details.spec.volumeMode) },
    { label: 'Volume Attributes ClassName', value: defaultOrValue(details.spec.volumeAttributesClassName) },
    { label: 'Current Volume Attributes ClassName', value: defaultOrValue(details.status.currentVolumeAttributesClassName) },
    { label: 'Generate Name', value: defaultOrValue(details.metadata.generateName) },
    { label: 'Generation', value: defaultOrValue(details.metadata.generation) },
    { label: 'Resource Version', value: defaultOrValue(details.metadata.resourceVersion) },
    { label: 'UID', value: defaultOrValue(details.metadata.uid) }
  ],
  loading,
  ...getCommonCardConfig(details.metadata.annotations, details.metadata.labels, details.status.conditions)
});

const getPersistentVolumeDetailsConfig = (details: PersistentVolumeDetails, loading: boolean) => ({
  subHeading: !details.metadata ? '' : `${details.metadata.name}`,
  detailCard: [
    { label: 'Name', value: defaultOrValue(details.metadata.name) },
    { label: 'Namespace', value: defaultOrValue(details.metadata.namespace) },
    { label: 'Age', value: defaultOrValue(details.metadata.creationTimestamp) },
    getControlledByDetail(details.metadata.ownerReferences, details.metadata.namespace),
    { label: 'Phase', value: defaultOrValue(details.status.phase) },
    { label: 'Storage ClassName', value: defaultOrValue(details.spec.storageClassName) },
    { label: 'Volume Mode', value: defaultOrValue(details.spec.volumeMode) },
    { label: 'Reason', value: defaultOrValue(details.status.reason) },
    { label: 'Message', value: defaultOrValue(details.status.message) },
    { label: 'Last Phase Transition Time', value: defaultOrValue(details.status.lastPhaseTransitionTime) },
    { label: 'Volume Attributes ClassName', value: defaultOrValue(details.spec.volumeAttributesClassName) },
    { label: 'Generate Name', value: defaultOrValue(details.metadata.generateName) },
    { label: 'Generation', value: defaultOrValue(details.metadata.generation) },
    { label: 'Resource Version', value: defaultOrValue(details.metadata.resourceVersion) },
    { label: 'UID', value: defaultOrValue(details.metadata.uid) }
  ],
  loading,
  ...getCommonCardConfig(details.metadata.annotations, details.metadata.labels)
});

const getStorageClassDetailsConfig = (details: StorageClassDetails, loading: boolean) => ({
  subHeading: !details.metadata ? '' : `${details.metadata.name}`,
  detailCard: [
    { label: 'Name', value: defaultOrValue(details.metadata.name) },
    { label: 'Namespace', value: defaultOrValue(details.metadata.namespace) },
    { label: 'Age', value: defaultOrValue(details.metadata.creationTimestamp) },
    getControlledByDetail(details.metadata.ownerReferences, details.metadata.namespace),
    { label: 'Provisioner', value: defaultOrValue(details.provisioner) },
    { label: 'Reclaim Policy', value: defaultOrValue(details.reclaimPolicy) },
    { label: 'Volume Binding Mode', value: defaultOrValue(details.volumeBindingMode) },
    { label: 'Generate Name', value: defaultOrValue(details.metadata.generateName) },
    { label: 'Generation', value: defaultOrValue(details.metadata.generation) },
    { label: 'Deletion Grace Period Seconds', value: defaultOrValue(details.metadata.deletionGracePeriodSeconds) },
    { label: 'Deletion Timestamp', value: defaultOrValue(details.metadata.deletionTimestamp) },
    { label: 'Resource Version', value: defaultOrValue(details.metadata.resourceVersion) },
    { label: 'UID', value: defaultOrValue(details.metadata.uid) }
  ],
  loading,
  ...getCommonCardConfig(details.metadata.annotations, details.metadata.labels)
});

const getCSIDriverDetailsConfig = (details: CSIDriverDetails, loading: boolean) => ({
  subHeading: !details.metadata ? '' : `${details.metadata.name}`,
  detailCard: [
    { label: 'Name', value: defaultOrValue(details.metadata?.name) },
    { label: 'Namespace', value: defaultOrValue(details.metadata?.namespace) },
    { label: 'Age', value: defaultOrValue(details.metadata?.creationTimestamp) },
    getControlledByDetail(details.metadata?.ownerReferences),
    { label: 'Attach Required', value: defaultOrValue(details.spec?.attachRequired) },
    { label: 'Pod Info On Mount', value: defaultOrValue(details.spec?.podInfoOnMount) },
    { label: 'Storage Capacity', value: defaultOrValue(details.spec?.storageCapacity) },
    { label: 'FS Group Policy', value: defaultOrValue(details.spec?.fsGroupPolicy) },
    { label: 'SELinux Mount', value: defaultOrValue(details.spec?.seLinuxMount) },
    { label: 'Requires Republish', value: defaultOrValue(details.spec?.requiresRepublish) },
    { label: 'Volume Lifecycle Modes', value: defaultOrValueObject(details.spec?.volumeLifecycleModes ?? []) },
    { label: 'Generate Name', value: defaultOrValue(details.metadata?.generateName) },
    { label: 'Generation', value: defaultOrValue(details.metadata?.generation) },
    { label: 'Deletion Grace Period Seconds', value: defaultOrValue(details.metadata?.deletionGracePeriodSeconds) },
    { label: 'Deletion Timestamp', value: defaultOrValue(details.metadata?.deletionTimestamp) },
    { label: 'Resource Version', value: defaultOrValue(details.metadata?.resourceVersion) },
    { label: 'UID', value: defaultOrValue(details.metadata?.uid) }
  ],
  loading,
  ...getCommonCardConfig(details.metadata?.annotations, details.metadata?.labels)
});

const getCSINodeDetailsConfig = (details: CSINodeDetails, loading: boolean) => ({
  subHeading: !details.metadata ? '' : `${details.metadata.name}`,
  detailCard: [
    { label: 'Name', value: defaultOrValue(details.metadata?.name) },
    { label: 'Namespace', value: defaultOrValue(details.metadata?.namespace) },
    { label: 'Age', value: defaultOrValue(details.metadata?.creationTimestamp) },
    getControlledByDetail(details.metadata?.ownerReferences),
    { label: 'Drivers', value: defaultOrValueObject(details.spec?.drivers?.map((driver) => driver?.name) ?? []) },
    { label: 'Generate Name', value: defaultOrValue(details.metadata?.generateName) },
    { label: 'Generation', value: defaultOrValue(details.metadata?.generation) },
    { label: 'Deletion Grace Period Seconds', value: defaultOrValue(details.metadata?.deletionGracePeriodSeconds) },
    { label: 'Deletion Timestamp', value: defaultOrValue(details.metadata?.deletionTimestamp) },
    { label: 'Resource Version', value: defaultOrValue(details.metadata?.resourceVersion) },
    { label: 'UID', value: defaultOrValue(details.metadata?.uid) }
  ],
  loading,
  ...getCommonCardConfig(details.metadata?.annotations, details.metadata?.labels)
});

const getVolumeAttributesClassDetailsConfig = (details: VolumeAttributesClassDetails, loading: boolean) => ({
  subHeading: !details.metadata ? '' : `${details.metadata.name}`,
  detailCard: [
    { label: 'Name', value: defaultOrValue(details.metadata?.name) },
    { label: 'Namespace', value: defaultOrValue(details.metadata?.namespace) },
    { label: 'Age', value: defaultOrValue(details.metadata?.creationTimestamp) },
    getControlledByDetail(details.metadata?.ownerReferences),
    { label: 'Driver Name', value: defaultOrValue(details.driverName) },
    { label: 'Generate Name', value: defaultOrValue(details.metadata?.generateName) },
    { label: 'Generation', value: defaultOrValue(details.metadata?.generation) },
    { label: 'Deletion Grace Period Seconds', value: defaultOrValue(details.metadata?.deletionGracePeriodSeconds) },
    { label: 'Deletion Timestamp', value: defaultOrValue(details.metadata?.deletionTimestamp) },
    { label: 'Resource Version', value: defaultOrValue(details.metadata?.resourceVersion) },
    { label: 'UID', value: defaultOrValue(details.metadata?.uid) }
  ],
  loading,
  ...getCommonCardConfig(details.metadata?.annotations, details.metadata?.labels)
});

// Custom Resource
const getCustomResourceDefinitionsDetailsConfig = (details: CustomResourcesDefinitionDetails, loading: boolean) => ({
  subHeading: !details.metadata ? '' : `${details.metadata.name}`,
  detailCard: [
    { label: 'Name', value: defaultOrValue(details.metadata.name) },
    { label: 'Namespace', value: defaultOrValue(details.metadata.namespace) },
    { label: 'Age', value: defaultOrValue(details.metadata.creationTimestamp) },
    getControlledByDetail(details.metadata.ownerReferences),
    { label: 'Generation', value: defaultOrValue(details.metadata.generation) },
    { label: 'Resource Version', value: defaultOrValue(details.metadata.resourceVersion) },
    { label: 'UID', value: defaultOrValue(details.metadata.uid) }
  ],
  loading,
  ...getCommonCardConfig(details.metadata.annotations, details.metadata.labels)
});

const getCustomResourceDetailsConfig = (details: CustomResourceDetails, loading: boolean) => ({
  subHeading: !details.metadata ? '' : `${details.metadata.namespace ? details.metadata.namespace + '/' : ''}${details.metadata.name}`,
  detailCard: [
    { label: 'Name', value: defaultOrValue(details.metadata.name) },
    { label: 'Namespace', value: defaultOrValue(details.metadata.namespace) },
    { label: 'Age', value: defaultOrValue(details.metadata.creationTimestamp) },
    getControlledByDetail(details.metadata.ownerReferences, details.metadata.namespace),
    { label: 'Generation', value: defaultOrValue(details.metadata.generation) },
    { label: 'Resource Version', value: defaultOrValue(details.metadata.resourceVersion) },
    { label: 'UID', value: defaultOrValue(details.metadata.uid) }
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
  getNetworkPolicyDetailsConfig,
  getEndpointDetailsConfig,
  getPersistentVolumeClaimDetailsConfig,
  getPersistentVolumeDetailsConfig,
  getStorageClassDetailsConfig,
  getCSIDriverDetailsConfig,
  getCSINodeDetailsConfig,
  getVolumeAttributesClassDetailsConfig,
  getCustomResourceDetailsConfig,
  getCustomResourceDefinitionsDetailsConfig
};