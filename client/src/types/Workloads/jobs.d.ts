type JobsResponse = {
  namespace: string,
  name: string,
  age: string,
  spec: {
    completions: number,
    backoffLimit: number,
    completionMode: number,
    suspend: boolean
  },
  status: {
    conditions: {
        type: string,
        status: string,
        lastProbeTime: string,
        lastTransitionTime: string
      }[],
    active: number,
    ready: number,
    failed: number,
    succeeded: number,
    startTime: string
  };
  hasUpdated: boolean;
};

type JobsHeader = {
  namespace: string;
  name: string;
  completions: string;
  conditions: string;
  duration: string;
  age: string;
};

type Jobs = JobsHeader;

type JobDetailsMetada = {
  /**
   * Annotations is an unstructured key value map stored with a resource that may be set by external tools to store and retrieve arbitrary metadata. They are not queryable and should be preserved when modifying objects. More info: https://kubernetes.io/docs/concepts/overview/working-with-objects/annotations
   */
  annotations?: {
    [k: string]: string | null
  } | null
  /**
   * Time is a wrapper around time.Time which supports correct marshaling to YAML and JSON.  Wrappers are provided for many of the factory methods that the time package offers.
   */
  creationTimestamp?: string | null
  /**
   * Number of seconds allowed for this object to gracefully terminate before it will be removed from the system. Only set when deletionTimestamp is also set. May only be shortened. Read-only.
   */
  deletionGracePeriodSeconds?: number | null
  /**
   * Time is a wrapper around time.Time which supports correct marshaling to YAML and JSON.  Wrappers are provided for many of the factory methods that the time package offers.
   */
  deletionTimestamp?: string | null
  /**
   * Must be empty before the object is deleted from the registry. Each entry is an identifier for the responsible component that will remove the entry from the list. If the deletionTimestamp of the object is non-nil, entries in this list can only be removed. Finalizers may be processed and removed in any order.  Order is NOT enforced because it introduces significant risk of stuck finalizers. finalizers is a shared field, any actor with permission can reorder it. If the finalizer list is processed in order, then this can lead to a situation in which the component responsible for the first finalizer in the list is waiting for a signal (field value, external system, or other) produced by a component responsible for a finalizer later in the list, resulting in a deadlock. Without enforced ordering finalizers are free to order amongst themselves and are not vulnerable to ordering changes in the list.
   */
  finalizers?: (string | null)[] | null
  /**
   * GenerateName is an optional prefix, used by the server, to generate a unique name ONLY IF the Name field has not been provided. If this field is used, the name returned to the client will be different than the name passed. This value will also be combined with a unique suffix. The provided value has the same validation rules as the Name field, and may be truncated by the length of the suffix required to make the value unique on the server.
   *
   * If this field is specified and the generated name exists, the server will return a 409.
   *
   * Applied only if Name is not specified. More info: https://git.k8s.io/community/contributors/devel/sig-architecture/api-conventions.md#idempotency
   */
  generateName?: string | null
  /**
   * A sequence number representing a specific generation of the desired state. Populated by the system. Read-only.
   */
  generation?: number | null
  /**
   * Map of string keys and values that can be used to organize and categorize (scope and select) objects. May match selectors of replication controllers and services. More info: https://kubernetes.io/docs/concepts/overview/working-with-objects/labels
   */
  labels?: {
    [k: string]: string | null
  } | null
  /**
   * ManagedFields maps workflow-id and version to the set of fields that are managed by that workflow. This is mostly for internal housekeeping, and users typically shouldn't need to set or understand this field. A workflow can be the user's name, a controller's name, or the name of a specific apply path like "ci-cd". The set of fields is always in the version that the workflow used when modifying the object.
   */
  managedFields?:
    | ({
        /**
         * APIVersion defines the version of this resource that this field set applies to. The format is "group/version" just like the top-level APIVersion field. It is necessary to track the version of a field set because it cannot be automatically converted.
         */
        apiVersion?: string | null
        /**
         * FieldsType is the discriminator for the different fields format and version. There is currently only one possible value: "FieldsV1"
         */
        fieldsType?: string | null
        /**
         * FieldsV1 stores a set of fields in a data structure like a Trie, in JSON format.
         *
         * Each key is either a '.' representing the field itself, and will always map to an empty set, or a string representing a sub-field or item. The string will follow one of these four formats: 'f:<name>', where <name> is the name of a field in a struct, or key in a map 'v:<value>', where <value> is the exact json formatted value of a list item 'i:<index>', where <index> is position of a item in a list 'k:<keys>', where <keys> is a map of  a list item's key fields to their unique values If a key maps to an empty Fields value, the field that key represents is part of the set.
         *
         * The exact format is defined in sigs.k8s.io/structured-merge-diff
         */
        fieldsV1?: {
          [k: string]: unknown
        } | null
        /**
         * Manager is an identifier of the workflow managing these fields.
         */
        manager?: string | null
        /**
         * Operation is the type of operation which lead to this ManagedFieldsEntry being created. The only valid values for this field are 'Apply' and 'Update'.
         */
        operation?: string | null
        /**
         * Subresource is the name of the subresource used to update that object, or empty string if the object was updated through the main resource. The value of this field is used to distinguish between managers, even if they share the same name. For example, a status update will be distinct from a regular update using the same manager name. Note that the APIVersion field is not related to the Subresource field and it always corresponds to the version of the main resource.
         */
        subresource?: string | null
        /**
         * Time is a wrapper around time.Time which supports correct marshaling to YAML and JSON.  Wrappers are provided for many of the factory methods that the time package offers.
         */
        time?: string | null
      } | null)[]
    | null
  /**
   * Name must be unique within a namespace. Is required when creating resources, although some resources may allow a client to request the generation of an appropriate name automatically. Name is primarily intended for creation idempotence and configuration definition. Cannot be updated. More info: https://kubernetes.io/docs/concepts/overview/working-with-objects/names#names
   */
  name?: string | null
  /**
   * Namespace defines the space within which each name must be unique. An empty namespace is equivalent to the "default" namespace, but "default" is the canonical representation. Not all objects are required to be scoped to a namespace - the value of this field for those objects will be empty.
   *
   * Must be a DNS_LABEL. Cannot be updated. More info: https://kubernetes.io/docs/concepts/overview/working-with-objects/namespaces
   */
  namespace?: string | null
  /**
   * List of objects depended by this object. If ALL objects in the list have been deleted, this object will be garbage collected. If this object is managed by a controller, then an entry in this list will point to this controller, with the controller field set to true. There cannot be more than one managing controller.
   */
  ownerReferences?:
    | ({
        /**
         * API version of the referent.
         */
        apiVersion: string
        /**
         * If true, AND if the owner has the "foregroundDeletion" finalizer, then the owner cannot be deleted from the key-value store until this reference is removed. See https://kubernetes.io/docs/concepts/architecture/garbage-collection/#foreground-deletion for how the garbage collector interacts with this field and enforces the foreground deletion. Defaults to false. To set this field, a user needs "delete" permission of the owner, otherwise 422 (Unprocessable Entity) will be returned.
         */
        blockOwnerDeletion?: boolean | null
        /**
         * If true, this reference points to the managing controller.
         */
        controller?: boolean | null
        /**
         * Kind of the referent. More info: https://git.k8s.io/community/contributors/devel/sig-architecture/api-conventions.md#types-kinds
         */
        kind: string
        /**
         * Name of the referent. More info: https://kubernetes.io/docs/concepts/overview/working-with-objects/names#names
         */
        name: string
        /**
         * UID of the referent. More info: https://kubernetes.io/docs/concepts/overview/working-with-objects/names#uids
         */
        uid: string
      } | null)[]
    | null
  /**
   * An opaque value that represents the internal version of this object that can be used by clients to determine when objects have changed. May be used for optimistic concurrency, change detection, and the watch operation on a resource or set of resources. Clients must treat these values as opaque and passed unmodified back to the server. They may only be valid for a particular resource or set of resources.
   *
   * Populated by the system. Read-only. Value must be treated as opaque by clients and . More info: https://git.k8s.io/community/contributors/devel/sig-architecture/api-conventions.md#concurrency-control-and-consistency
   */
  resourceVersion?: string | null
  /**
   * Deprecated: selfLink is a legacy read-only field that is no longer populated by the system.
   */
  selfLink?: string | null
  /**
   * UID is the unique in time and space value for this object. It is typically generated by the server on successful creation of a resource and is not allowed to change on PUT operations.
   *
   * Populated by the system. Read-only. More info: https://kubernetes.io/docs/concepts/overview/working-with-objects/names#uids
   */
  uid?: string | null
};

type JobDetailsSpec = {
  /**
   * Specifies the duration in seconds relative to the startTime that the job may be continuously active before the system tries to terminate it; value must be positive integer. If a Job is suspended (at creation or through an update), this timer will effectively be stopped and reset when the Job is resumed again.
   */
  activeDeadlineSeconds?: number | null
  /**
   * Specifies the number of retries before marking this job failed. Defaults to 6
   */
  backoffLimit?: number | null
  /**
   * Specifies the limit for the number of retries within an index before marking this index as failed. When enabled the number of failures per index is kept in the pod's batch.kubernetes.io/job-index-failure-count annotation. It can only be set when Job's completionMode=Indexed, and the Pod's restart policy is Never. The field is immutable. This field is beta-level. It can be used when the `JobBackoffLimitPerIndex` feature gate is enabled (enabled by default).
   */
  backoffLimitPerIndex?: number | null
  /**
   * completionMode specifies how Pod completions are tracked. It can be `NonIndexed` (default) or `Indexed`.
   *
   * `NonIndexed` means that the Job is considered complete when there have been .spec.completions successfully completed Pods. Each Pod completion is homologous to each other.
   *
   * `Indexed` means that the Pods of a Job get an associated completion index from 0 to (.spec.completions - 1), available in the annotation batch.kubernetes.io/job-completion-index. The Job is considered complete when there is one successfully completed Pod for each index. When value is `Indexed`, .spec.completions must be specified and `.spec.parallelism` must be less than or equal to 10^5. In addition, The Pod name takes the form `$(job-name)-$(index)-$(random-string)`, the Pod hostname takes the form `$(job-name)-$(index)`.
   *
   * More completion modes can be added in the future. If the Job controller observes a mode that it doesn't recognize, which is possible during upgrades due to version skew, the controller skips updates for the Job.
   */
  completionMode?: string | null
  /**
   * Specifies the desired number of successfully finished pods the job should be run with.  Setting to null means that the success of any pod signals the success of all pods, and allows parallelism to have any positive value.  Setting to 1 means that parallelism is limited to 1 and the success of that pod signals the success of the job. More info: https://kubernetes.io/docs/concepts/workloads/controllers/jobs-run-to-completion/
   */
  completions?: number | null
  /**
   * manualSelector controls generation of pod labels and pod selectors. Leave `manualSelector` unset unless you are certain what you are doing. When false or unset, the system pick labels unique to this job and appends those labels to the pod template.  When true, the user is responsible for picking unique labels and specifying the selector.  Failure to pick a unique label may cause this and other jobs to not function correctly.  However, You may see `manualSelector=true` in jobs that were created with the old `extensions/v1beta1` API. More info: https://kubernetes.io/docs/concepts/workloads/controllers/jobs-run-to-completion/#specifying-your-own-pod-selector
   */
  manualSelector?: boolean | null
  /**
   * Specifies the maximal number of failed indexes before marking the Job as failed, when backoffLimitPerIndex is set. Once the number of failed indexes exceeds this number the entire Job is marked as Failed and its execution is terminated. When left as null the job continues execution of all of its indexes and is marked with the `Complete` Job condition. It can only be specified when backoffLimitPerIndex is set. It can be null or up to completions. It is required and must be less than or equal to 10^4 when is completions greater than 10^5. This field is beta-level. It can be used when the `JobBackoffLimitPerIndex` feature gate is enabled (enabled by default).
   */
  maxFailedIndexes?: number | null
  /**
   * Specifies the maximum desired number of pods the job should run at any given time. The actual number of pods running in steady state will be less than this number when ((.spec.completions - .status.successful) < .spec.parallelism), i.e. when the work left to do is less than max parallelism. More info: https://kubernetes.io/docs/concepts/workloads/controllers/jobs-run-to-completion/
   */
  parallelism?: number | null
  /**
   * PodFailurePolicy describes how failed pods influence the backoffLimit.
   */
  podFailurePolicy?: {
    /**
     * A list of pod failure policy rules. The rules are evaluated in order. Once a rule matches a Pod failure, the remaining of the rules are ignored. When no rule matches the Pod failure, the default handling applies - the counter of pod failures is incremented and it is checked against the backoffLimit. At most 20 elements are allowed.
     */
    rules: ({
      /**
       * Specifies the action taken on a pod failure when the requirements are satisfied. Possible values are:
       *
       * - FailJob: indicates that the pod's job is marked as Failed and all
       *   running pods are terminated.
       * - FailIndex: indicates that the pod's index is marked as Failed and will
       *   not be restarted.
       *   This value is beta-level. It can be used when the
       *   `JobBackoffLimitPerIndex` feature gate is enabled (enabled by default).
       * - Ignore: indicates that the counter towards the .backoffLimit is not
       *   incremented and a replacement pod is created.
       * - Count: indicates that the pod is handled in the default way - the
       *   counter towards the .backoffLimit is incremented.
       * Additional values are considered to be added in the future. Clients should react to an unknown action by skipping the rule.
       */
      action: string
      /**
       * PodFailurePolicyOnExitCodesRequirement describes the requirement for handling a failed pod based on its container exit codes. In particular, it lookups the .state.terminated.exitCode for each app container and init container status, represented by the .status.containerStatuses and .status.initContainerStatuses fields in the Pod status, respectively. Containers completed with success (exit code 0) are excluded from the requirement check.
       */
      onExitCodes?: {
        /**
         * Restricts the check for exit codes to the container with the specified name. When null, the rule applies to all containers. When specified, it should match one the container or initContainer names in the pod template.
         */
        containerName?: string | null
        /**
         * Represents the relationship between the container exit code(s) and the specified values. Containers completed with success (exit code 0) are excluded from the requirement check. Possible values are:
         *
         * - In: the requirement is satisfied if at least one container exit code
         *   (might be multiple if there are multiple containers not restricted
         *   by the 'containerName' field) is in the set of specified values.
         * - NotIn: the requirement is satisfied if at least one container exit code
         *   (might be multiple if there are multiple containers not restricted
         *   by the 'containerName' field) is not in the set of specified values.
         * Additional values are considered to be added in the future. Clients should react to an unknown operator by assuming the requirement is not satisfied.
         */
        operator: string
        /**
         * Specifies the set of values. Each returned container exit code (might be multiple in case of multiple containers) is checked against this set of values with respect to the operator. The list of values must be ordered and must not contain duplicates. Value '0' cannot be used for the In operator. At least one element is required. At most 255 elements are allowed.
         */
        values: (number | null)[]
      } | null
      /**
       * Represents the requirement on the pod conditions. The requirement is represented as a list of pod condition patterns. The requirement is satisfied if at least one pattern matches an actual pod condition. At most 20 elements are allowed.
       */
      onPodConditions?:
        | ({
            /**
             * Specifies the required Pod condition status. To match a pod condition it is required that the specified status equals the pod condition status. Defaults to True.
             */
            status: string
            /**
             * Specifies the required Pod condition type. To match a pod condition it is required that specified type equals the pod condition type.
             */
            type: string
          } | null)[]
        | null
    } | null)[]
  } | null
  /**
   * podReplacementPolicy specifies when to create replacement Pods. Possible values are: - TerminatingOrFailed means that we recreate pods
   *   when they are terminating (has a metadata.deletionTimestamp) or failed.
   * - Failed means to wait until a previously created Pod is fully terminated (has phase
   *   Failed or Succeeded) before creating a replacement Pod.
   *
   * When using podFailurePolicy, Failed is the the only allowed value. TerminatingOrFailed and Failed are allowed values when podFailurePolicy is not in use. This is an beta field. To use this, enable the JobPodReplacementPolicy feature toggle. This is on by default.
   */
  podReplacementPolicy?: string | null
  /**
   * A label selector is a label query over a set of resources. The result of matchLabels and matchExpressions are ANDed. An empty label selector matches all objects. A null label selector matches no objects.
   */
  selector?: {
    /**
     * matchExpressions is a list of label selector requirements. The requirements are ANDed.
     */
    matchExpressions?:
      | ({
          /**
           * key is the label key that the selector applies to.
           */
          key: string
          /**
           * operator represents a key's relationship to a set of values. Valid operators are In, NotIn, Exists and DoesNotExist.
           */
          operator: string
          /**
           * values is an array of string values. If the operator is In or NotIn, the values array must be non-empty. If the operator is Exists or DoesNotExist, the values array must be empty. This array is replaced during a strategic merge patch.
           */
          values?: (string | null)[] | null
        } | null)[]
      | null
    /**
     * matchLabels is a map of {key,value} pairs. A single {key,value} in the matchLabels map is equivalent to an element of matchExpressions, whose key field is "key", the operator is "In", and the values array contains only "value". The requirements are ANDed.
     */
    matchLabels?: {
      [k: string]: string | null
    } | null
  } | null
  /**
   * suspend specifies whether the Job controller should create Pods or not. If a Job is created with suspend set to true, no Pods are created by the Job controller. If a Job is suspended after creation (i.e. the flag goes from false to true), the Job controller will delete all active Pods associated with this Job. Users must design their workload to gracefully handle this. Suspending a Job will reset the StartTime field of the Job, effectively resetting the ActiveDeadlineSeconds timer too. Defaults to false.
   */
  suspend?: boolean | null
  /**
   * PodTemplateSpec describes the data a pod should have when created from a template
   */
  template: {
    /**
     * ObjectMeta is metadata that all persisted resources must have, which includes all objects users must create.
     */
    metadata?: {
      /**
       * Annotations is an unstructured key value map stored with a resource that may be set by external tools to store and retrieve arbitrary metadata. They are not queryable and should be preserved when modifying objects. More info: https://kubernetes.io/docs/concepts/overview/working-with-objects/annotations
       */
      annotations?: {
        [k: string]: string | null
      } | null
      /**
       * Time is a wrapper around time.Time which supports correct marshaling to YAML and JSON.  Wrappers are provided for many of the factory methods that the time package offers.
       */
      creationTimestamp?: string | null
      /**
       * Number of seconds allowed for this object to gracefully terminate before it will be removed from the system. Only set when deletionTimestamp is also set. May only be shortened. Read-only.
       */
      deletionGracePeriodSeconds?: number | null
      /**
       * Time is a wrapper around time.Time which supports correct marshaling to YAML and JSON.  Wrappers are provided for many of the factory methods that the time package offers.
       */
      deletionTimestamp?: string | null
      /**
       * Must be empty before the object is deleted from the registry. Each entry is an identifier for the responsible component that will remove the entry from the list. If the deletionTimestamp of the object is non-nil, entries in this list can only be removed. Finalizers may be processed and removed in any order.  Order is NOT enforced because it introduces significant risk of stuck finalizers. finalizers is a shared field, any actor with permission can reorder it. If the finalizer list is processed in order, then this can lead to a situation in which the component responsible for the first finalizer in the list is waiting for a signal (field value, external system, or other) produced by a component responsible for a finalizer later in the list, resulting in a deadlock. Without enforced ordering finalizers are free to order amongst themselves and are not vulnerable to ordering changes in the list.
       */
      finalizers?: (string | null)[] | null
      /**
       * GenerateName is an optional prefix, used by the server, to generate a unique name ONLY IF the Name field has not been provided. If this field is used, the name returned to the client will be different than the name passed. This value will also be combined with a unique suffix. The provided value has the same validation rules as the Name field, and may be truncated by the length of the suffix required to make the value unique on the server.
       *
       * If this field is specified and the generated name exists, the server will return a 409.
       *
       * Applied only if Name is not specified. More info: https://git.k8s.io/community/contributors/devel/sig-architecture/api-conventions.md#idempotency
       */
      generateName?: string | null
      /**
       * A sequence number representing a specific generation of the desired state. Populated by the system. Read-only.
       */
      generation?: number | null
      /**
       * Map of string keys and values that can be used to organize and categorize (scope and select) objects. May match selectors of replication controllers and services. More info: https://kubernetes.io/docs/concepts/overview/working-with-objects/labels
       */
      labels?: {
        [k: string]: string | null
      } | null
      /**
       * ManagedFields maps workflow-id and version to the set of fields that are managed by that workflow. This is mostly for internal housekeeping, and users typically shouldn't need to set or understand this field. A workflow can be the user's name, a controller's name, or the name of a specific apply path like "ci-cd". The set of fields is always in the version that the workflow used when modifying the object.
       */
      managedFields?:
        | ({
            /**
             * APIVersion defines the version of this resource that this field set applies to. The format is "group/version" just like the top-level APIVersion field. It is necessary to track the version of a field set because it cannot be automatically converted.
             */
            apiVersion?: string | null
            /**
             * FieldsType is the discriminator for the different fields format and version. There is currently only one possible value: "FieldsV1"
             */
            fieldsType?: string | null
            /**
             * FieldsV1 stores a set of fields in a data structure like a Trie, in JSON format.
             *
             * Each key is either a '.' representing the field itself, and will always map to an empty set, or a string representing a sub-field or item. The string will follow one of these four formats: 'f:<name>', where <name> is the name of a field in a struct, or key in a map 'v:<value>', where <value> is the exact json formatted value of a list item 'i:<index>', where <index> is position of a item in a list 'k:<keys>', where <keys> is a map of  a list item's key fields to their unique values If a key maps to an empty Fields value, the field that key represents is part of the set.
             *
             * The exact format is defined in sigs.k8s.io/structured-merge-diff
             */
            fieldsV1?: {
              [k: string]: unknown
            } | null
            /**
             * Manager is an identifier of the workflow managing these fields.
             */
            manager?: string | null
            /**
             * Operation is the type of operation which lead to this ManagedFieldsEntry being created. The only valid values for this field are 'Apply' and 'Update'.
             */
            operation?: string | null
            /**
             * Subresource is the name of the subresource used to update that object, or empty string if the object was updated through the main resource. The value of this field is used to distinguish between managers, even if they share the same name. For example, a status update will be distinct from a regular update using the same manager name. Note that the APIVersion field is not related to the Subresource field and it always corresponds to the version of the main resource.
             */
            subresource?: string | null
            /**
             * Time is a wrapper around time.Time which supports correct marshaling to YAML and JSON.  Wrappers are provided for many of the factory methods that the time package offers.
             */
            time?: string | null
          } | null)[]
        | null
      /**
       * Name must be unique within a namespace. Is required when creating resources, although some resources may allow a client to request the generation of an appropriate name automatically. Name is primarily intended for creation idempotence and configuration definition. Cannot be updated. More info: https://kubernetes.io/docs/concepts/overview/working-with-objects/names#names
       */
      name?: string | null
      /**
       * Namespace defines the space within which each name must be unique. An empty namespace is equivalent to the "default" namespace, but "default" is the canonical representation. Not all objects are required to be scoped to a namespace - the value of this field for those objects will be empty.
       *
       * Must be a DNS_LABEL. Cannot be updated. More info: https://kubernetes.io/docs/concepts/overview/working-with-objects/namespaces
       */
      namespace?: string | null
      /**
       * List of objects depended by this object. If ALL objects in the list have been deleted, this object will be garbage collected. If this object is managed by a controller, then an entry in this list will point to this controller, with the controller field set to true. There cannot be more than one managing controller.
       */
      ownerReferences?:
        | ({
            /**
             * API version of the referent.
             */
            apiVersion: string
            /**
             * If true, AND if the owner has the "foregroundDeletion" finalizer, then the owner cannot be deleted from the key-value store until this reference is removed. See https://kubernetes.io/docs/concepts/architecture/garbage-collection/#foreground-deletion for how the garbage collector interacts with this field and enforces the foreground deletion. Defaults to false. To set this field, a user needs "delete" permission of the owner, otherwise 422 (Unprocessable Entity) will be returned.
             */
            blockOwnerDeletion?: boolean | null
            /**
             * If true, this reference points to the managing controller.
             */
            controller?: boolean | null
            /**
             * Kind of the referent. More info: https://git.k8s.io/community/contributors/devel/sig-architecture/api-conventions.md#types-kinds
             */
            kind: string
            /**
             * Name of the referent. More info: https://kubernetes.io/docs/concepts/overview/working-with-objects/names#names
             */
            name: string
            /**
             * UID of the referent. More info: https://kubernetes.io/docs/concepts/overview/working-with-objects/names#uids
             */
            uid: string
          } | null)[]
        | null
      /**
       * An opaque value that represents the internal version of this object that can be used by clients to determine when objects have changed. May be used for optimistic concurrency, change detection, and the watch operation on a resource or set of resources. Clients must treat these values as opaque and passed unmodified back to the server. They may only be valid for a particular resource or set of resources.
       *
       * Populated by the system. Read-only. Value must be treated as opaque by clients and . More info: https://git.k8s.io/community/contributors/devel/sig-architecture/api-conventions.md#concurrency-control-and-consistency
       */
      resourceVersion?: string | null
      /**
       * Deprecated: selfLink is a legacy read-only field that is no longer populated by the system.
       */
      selfLink?: string | null
      /**
       * UID is the unique in time and space value for this object. It is typically generated by the server on successful creation of a resource and is not allowed to change on PUT operations.
       *
       * Populated by the system. Read-only. More info: https://kubernetes.io/docs/concepts/overview/working-with-objects/names#uids
       */
      uid?: string | null
    } | null
    /**
     * PodSpec is a description of a pod.
     */
    spec?: {
      /**
       * Optional duration in seconds the pod may be active on the node relative to StartTime before the system will actively try to mark it failed and kill associated containers. Value must be a positive integer.
       */
      activeDeadlineSeconds?: number | null
      /**
       * Affinity is a group of affinity scheduling rules.
       */
      affinity?: {
        /**
         * Node affinity is a group of node affinity scheduling rules.
         */
        nodeAffinity?: {
          /**
           * The scheduler will prefer to schedule pods to nodes that satisfy the affinity expressions specified by this field, but it may choose a node that violates one or more of the expressions. The node that is most preferred is the one with the greatest sum of weights, i.e. for each node that meets all of the scheduling requirements (resource request, requiredDuringScheduling affinity expressions, etc.), compute a sum by iterating through the elements of this field and adding "weight" to the sum if the node matches the corresponding matchExpressions; the node(s) with the highest sum are the most preferred.
           */
          preferredDuringSchedulingIgnoredDuringExecution?:
            | ({
                /**
                 * A null or empty node selector term matches no objects. The requirements of them are ANDed. The TopologySelectorTerm type implements a subset of the NodeSelectorTerm.
                 */
                preference: {
                  /**
                   * A list of node selector requirements by node's labels.
                   */
                  matchExpressions?:
                    | ({
                        /**
                         * The label key that the selector applies to.
                         */
                        key: string
                        /**
                         * Represents a key's relationship to a set of values. Valid operators are In, NotIn, Exists, DoesNotExist. Gt, and Lt.
                         */
                        operator: string
                        /**
                         * An array of string values. If the operator is In or NotIn, the values array must be non-empty. If the operator is Exists or DoesNotExist, the values array must be empty. If the operator is Gt or Lt, the values array must have a single element, which will be interpreted as an integer. This array is replaced during a strategic merge patch.
                         */
                        values?: (string | null)[] | null
                      } | null)[]
                    | null
                  /**
                   * A list of node selector requirements by node's fields.
                   */
                  matchFields?:
                    | ({
                        /**
                         * The label key that the selector applies to.
                         */
                        key: string
                        /**
                         * Represents a key's relationship to a set of values. Valid operators are In, NotIn, Exists, DoesNotExist. Gt, and Lt.
                         */
                        operator: string
                        /**
                         * An array of string values. If the operator is In or NotIn, the values array must be non-empty. If the operator is Exists or DoesNotExist, the values array must be empty. If the operator is Gt or Lt, the values array must have a single element, which will be interpreted as an integer. This array is replaced during a strategic merge patch.
                         */
                        values?: (string | null)[] | null
                      } | null)[]
                    | null
                }
                /**
                 * Weight associated with matching the corresponding nodeSelectorTerm, in the range 1-100.
                 */
                weight: number
              } | null)[]
            | null
          /**
           * A node selector represents the union of the results of one or more label queries over a set of nodes; that is, it represents the OR of the selectors represented by the node selector terms.
           */
          requiredDuringSchedulingIgnoredDuringExecution?: {
            /**
             * Required. A list of node selector terms. The terms are ORed.
             */
            nodeSelectorTerms: ({
              /**
               * A list of node selector requirements by node's labels.
               */
              matchExpressions?:
                | ({
                    /**
                     * The label key that the selector applies to.
                     */
                    key: string
                    /**
                     * Represents a key's relationship to a set of values. Valid operators are In, NotIn, Exists, DoesNotExist. Gt, and Lt.
                     */
                    operator: string
                    /**
                     * An array of string values. If the operator is In or NotIn, the values array must be non-empty. If the operator is Exists or DoesNotExist, the values array must be empty. If the operator is Gt or Lt, the values array must have a single element, which will be interpreted as an integer. This array is replaced during a strategic merge patch.
                     */
                    values?: (string | null)[] | null
                  } | null)[]
                | null
              /**
               * A list of node selector requirements by node's fields.
               */
              matchFields?:
                | ({
                    /**
                     * The label key that the selector applies to.
                     */
                    key: string
                    /**
                     * Represents a key's relationship to a set of values. Valid operators are In, NotIn, Exists, DoesNotExist. Gt, and Lt.
                     */
                    operator: string
                    /**
                     * An array of string values. If the operator is In or NotIn, the values array must be non-empty. If the operator is Exists or DoesNotExist, the values array must be empty. If the operator is Gt or Lt, the values array must have a single element, which will be interpreted as an integer. This array is replaced during a strategic merge patch.
                     */
                    values?: (string | null)[] | null
                  } | null)[]
                | null
            } | null)[]
          } | null
        } | null
        /**
         * Pod affinity is a group of inter pod affinity scheduling rules.
         */
        podAffinity?: {
          /**
           * The scheduler will prefer to schedule pods to nodes that satisfy the affinity expressions specified by this field, but it may choose a node that violates one or more of the expressions. The node that is most preferred is the one with the greatest sum of weights, i.e. for each node that meets all of the scheduling requirements (resource request, requiredDuringScheduling affinity expressions, etc.), compute a sum by iterating through the elements of this field and adding "weight" to the sum if the node has pods which matches the corresponding podAffinityTerm; the node(s) with the highest sum are the most preferred.
           */
          preferredDuringSchedulingIgnoredDuringExecution?:
            | ({
                /**
                 * Defines a set of pods (namely those matching the labelSelector relative to the given namespace(s)) that this pod should be co-located (affinity) or not co-located (anti-affinity) with, where co-located is defined as running on a node whose value of the label with key <topologyKey> matches that of any node on which a pod of the set of pods is running
                 */
                podAffinityTerm: {
                  /**
                   * A label selector is a label query over a set of resources. The result of matchLabels and matchExpressions are ANDed. An empty label selector matches all objects. A null label selector matches no objects.
                   */
                  labelSelector?: {
                    /**
                     * matchExpressions is a list of label selector requirements. The requirements are ANDed.
                     */
                    matchExpressions?:
                      | ({
                          /**
                           * key is the label key that the selector applies to.
                           */
                          key: string
                          /**
                           * operator represents a key's relationship to a set of values. Valid operators are In, NotIn, Exists and DoesNotExist.
                           */
                          operator: string
                          /**
                           * values is an array of string values. If the operator is In or NotIn, the values array must be non-empty. If the operator is Exists or DoesNotExist, the values array must be empty. This array is replaced during a strategic merge patch.
                           */
                          values?: (string | null)[] | null
                        } | null)[]
                      | null
                    /**
                     * matchLabels is a map of {key,value} pairs. A single {key,value} in the matchLabels map is equivalent to an element of matchExpressions, whose key field is "key", the operator is "In", and the values array contains only "value". The requirements are ANDed.
                     */
                    matchLabels?: {
                      [k: string]: string | null
                    } | null
                  } | null
                  /**
                   * MatchLabelKeys is a set of pod label keys to select which pods will be taken into consideration. The keys are used to lookup values from the incoming pod labels, those key-value labels are merged with `LabelSelector` as `key in (value)` to select the group of existing pods which pods will be taken into consideration for the incoming pod's pod (anti) affinity. Keys that don't exist in the incoming pod labels will be ignored. The default value is empty. The same key is forbidden to exist in both MatchLabelKeys and LabelSelector. Also, MatchLabelKeys cannot be set when LabelSelector isn't set. This is an alpha field and requires enabling MatchLabelKeysInPodAffinity feature gate.
                   */
                  matchLabelKeys?: (string | null)[] | null
                  /**
                   * MismatchLabelKeys is a set of pod label keys to select which pods will be taken into consideration. The keys are used to lookup values from the incoming pod labels, those key-value labels are merged with `LabelSelector` as `key notin (value)` to select the group of existing pods which pods will be taken into consideration for the incoming pod's pod (anti) affinity. Keys that don't exist in the incoming pod labels will be ignored. The default value is empty. The same key is forbidden to exist in both MismatchLabelKeys and LabelSelector. Also, MismatchLabelKeys cannot be set when LabelSelector isn't set. This is an alpha field and requires enabling MatchLabelKeysInPodAffinity feature gate.
                   */
                  mismatchLabelKeys?: (string | null)[] | null
                  /**
                   * A label selector is a label query over a set of resources. The result of matchLabels and matchExpressions are ANDed. An empty label selector matches all objects. A null label selector matches no objects.
                   */
                  namespaceSelector?: {
                    /**
                     * matchExpressions is a list of label selector requirements. The requirements are ANDed.
                     */
                    matchExpressions?:
                      | ({
                          /**
                           * key is the label key that the selector applies to.
                           */
                          key: string
                          /**
                           * operator represents a key's relationship to a set of values. Valid operators are In, NotIn, Exists and DoesNotExist.
                           */
                          operator: string
                          /**
                           * values is an array of string values. If the operator is In or NotIn, the values array must be non-empty. If the operator is Exists or DoesNotExist, the values array must be empty. This array is replaced during a strategic merge patch.
                           */
                          values?: (string | null)[] | null
                        } | null)[]
                      | null
                    /**
                     * matchLabels is a map of {key,value} pairs. A single {key,value} in the matchLabels map is equivalent to an element of matchExpressions, whose key field is "key", the operator is "In", and the values array contains only "value". The requirements are ANDed.
                     */
                    matchLabels?: {
                      [k: string]: string | null
                    } | null
                  } | null
                  /**
                   * namespaces specifies a static list of namespace names that the term applies to. The term is applied to the union of the namespaces listed in this field and the ones selected by namespaceSelector. null or empty namespaces list and null namespaceSelector means "this pod's namespace".
                   */
                  namespaces?: (string | null)[] | null
                  /**
                   * This pod should be co-located (affinity) or not co-located (anti-affinity) with the pods matching the labelSelector in the specified namespaces, where co-located is defined as running on a node whose value of the label with key topologyKey matches that of any node on which any of the selected pods is running. Empty topologyKey is not allowed.
                   */
                  topologyKey: string
                }
                /**
                 * weight associated with matching the corresponding podAffinityTerm, in the range 1-100.
                 */
                weight: number
              } | null)[]
            | null
          /**
           * If the affinity requirements specified by this field are not met at scheduling time, the pod will not be scheduled onto the node. If the affinity requirements specified by this field cease to be met at some point during pod execution (e.g. due to a pod label update), the system may or may not try to eventually evict the pod from its node. When there are multiple elements, the lists of nodes corresponding to each podAffinityTerm are intersected, i.e. all terms must be satisfied.
           */
          requiredDuringSchedulingIgnoredDuringExecution?:
            | ({
                /**
                 * A label selector is a label query over a set of resources. The result of matchLabels and matchExpressions are ANDed. An empty label selector matches all objects. A null label selector matches no objects.
                 */
                labelSelector?: {
                  /**
                   * matchExpressions is a list of label selector requirements. The requirements are ANDed.
                   */
                  matchExpressions?:
                    | ({
                        /**
                         * key is the label key that the selector applies to.
                         */
                        key: string
                        /**
                         * operator represents a key's relationship to a set of values. Valid operators are In, NotIn, Exists and DoesNotExist.
                         */
                        operator: string
                        /**
                         * values is an array of string values. If the operator is In or NotIn, the values array must be non-empty. If the operator is Exists or DoesNotExist, the values array must be empty. This array is replaced during a strategic merge patch.
                         */
                        values?: (string | null)[] | null
                      } | null)[]
                    | null
                  /**
                   * matchLabels is a map of {key,value} pairs. A single {key,value} in the matchLabels map is equivalent to an element of matchExpressions, whose key field is "key", the operator is "In", and the values array contains only "value". The requirements are ANDed.
                   */
                  matchLabels?: {
                    [k: string]: string | null
                  } | null
                } | null
                /**
                 * MatchLabelKeys is a set of pod label keys to select which pods will be taken into consideration. The keys are used to lookup values from the incoming pod labels, those key-value labels are merged with `LabelSelector` as `key in (value)` to select the group of existing pods which pods will be taken into consideration for the incoming pod's pod (anti) affinity. Keys that don't exist in the incoming pod labels will be ignored. The default value is empty. The same key is forbidden to exist in both MatchLabelKeys and LabelSelector. Also, MatchLabelKeys cannot be set when LabelSelector isn't set. This is an alpha field and requires enabling MatchLabelKeysInPodAffinity feature gate.
                 */
                matchLabelKeys?: (string | null)[] | null
                /**
                 * MismatchLabelKeys is a set of pod label keys to select which pods will be taken into consideration. The keys are used to lookup values from the incoming pod labels, those key-value labels are merged with `LabelSelector` as `key notin (value)` to select the group of existing pods which pods will be taken into consideration for the incoming pod's pod (anti) affinity. Keys that don't exist in the incoming pod labels will be ignored. The default value is empty. The same key is forbidden to exist in both MismatchLabelKeys and LabelSelector. Also, MismatchLabelKeys cannot be set when LabelSelector isn't set. This is an alpha field and requires enabling MatchLabelKeysInPodAffinity feature gate.
                 */
                mismatchLabelKeys?: (string | null)[] | null
                /**
                 * A label selector is a label query over a set of resources. The result of matchLabels and matchExpressions are ANDed. An empty label selector matches all objects. A null label selector matches no objects.
                 */
                namespaceSelector?: {
                  /**
                   * matchExpressions is a list of label selector requirements. The requirements are ANDed.
                   */
                  matchExpressions?:
                    | ({
                        /**
                         * key is the label key that the selector applies to.
                         */
                        key: string
                        /**
                         * operator represents a key's relationship to a set of values. Valid operators are In, NotIn, Exists and DoesNotExist.
                         */
                        operator: string
                        /**
                         * values is an array of string values. If the operator is In or NotIn, the values array must be non-empty. If the operator is Exists or DoesNotExist, the values array must be empty. This array is replaced during a strategic merge patch.
                         */
                        values?: (string | null)[] | null
                      } | null)[]
                    | null
                  /**
                   * matchLabels is a map of {key,value} pairs. A single {key,value} in the matchLabels map is equivalent to an element of matchExpressions, whose key field is "key", the operator is "In", and the values array contains only "value". The requirements are ANDed.
                   */
                  matchLabels?: {
                    [k: string]: string | null
                  } | null
                } | null
                /**
                 * namespaces specifies a static list of namespace names that the term applies to. The term is applied to the union of the namespaces listed in this field and the ones selected by namespaceSelector. null or empty namespaces list and null namespaceSelector means "this pod's namespace".
                 */
                namespaces?: (string | null)[] | null
                /**
                 * This pod should be co-located (affinity) or not co-located (anti-affinity) with the pods matching the labelSelector in the specified namespaces, where co-located is defined as running on a node whose value of the label with key topologyKey matches that of any node on which any of the selected pods is running. Empty topologyKey is not allowed.
                 */
                topologyKey: string
              } | null)[]
            | null
        } | null
        /**
         * Pod anti affinity is a group of inter pod anti affinity scheduling rules.
         */
        podAntiAffinity?: {
          /**
           * The scheduler will prefer to schedule pods to nodes that satisfy the anti-affinity expressions specified by this field, but it may choose a node that violates one or more of the expressions. The node that is most preferred is the one with the greatest sum of weights, i.e. for each node that meets all of the scheduling requirements (resource request, requiredDuringScheduling anti-affinity expressions, etc.), compute a sum by iterating through the elements of this field and adding "weight" to the sum if the node has pods which matches the corresponding podAffinityTerm; the node(s) with the highest sum are the most preferred.
           */
          preferredDuringSchedulingIgnoredDuringExecution?:
            | ({
                /**
                 * Defines a set of pods (namely those matching the labelSelector relative to the given namespace(s)) that this pod should be co-located (affinity) or not co-located (anti-affinity) with, where co-located is defined as running on a node whose value of the label with key <topologyKey> matches that of any node on which a pod of the set of pods is running
                 */
                podAffinityTerm: {
                  /**
                   * A label selector is a label query over a set of resources. The result of matchLabels and matchExpressions are ANDed. An empty label selector matches all objects. A null label selector matches no objects.
                   */
                  labelSelector?: {
                    /**
                     * matchExpressions is a list of label selector requirements. The requirements are ANDed.
                     */
                    matchExpressions?:
                      | ({
                          /**
                           * key is the label key that the selector applies to.
                           */
                          key: string
                          /**
                           * operator represents a key's relationship to a set of values. Valid operators are In, NotIn, Exists and DoesNotExist.
                           */
                          operator: string
                          /**
                           * values is an array of string values. If the operator is In or NotIn, the values array must be non-empty. If the operator is Exists or DoesNotExist, the values array must be empty. This array is replaced during a strategic merge patch.
                           */
                          values?: (string | null)[] | null
                        } | null)[]
                      | null
                    /**
                     * matchLabels is a map of {key,value} pairs. A single {key,value} in the matchLabels map is equivalent to an element of matchExpressions, whose key field is "key", the operator is "In", and the values array contains only "value". The requirements are ANDed.
                     */
                    matchLabels?: {
                      [k: string]: string | null
                    } | null
                  } | null
                  /**
                   * MatchLabelKeys is a set of pod label keys to select which pods will be taken into consideration. The keys are used to lookup values from the incoming pod labels, those key-value labels are merged with `LabelSelector` as `key in (value)` to select the group of existing pods which pods will be taken into consideration for the incoming pod's pod (anti) affinity. Keys that don't exist in the incoming pod labels will be ignored. The default value is empty. The same key is forbidden to exist in both MatchLabelKeys and LabelSelector. Also, MatchLabelKeys cannot be set when LabelSelector isn't set. This is an alpha field and requires enabling MatchLabelKeysInPodAffinity feature gate.
                   */
                  matchLabelKeys?: (string | null)[] | null
                  /**
                   * MismatchLabelKeys is a set of pod label keys to select which pods will be taken into consideration. The keys are used to lookup values from the incoming pod labels, those key-value labels are merged with `LabelSelector` as `key notin (value)` to select the group of existing pods which pods will be taken into consideration for the incoming pod's pod (anti) affinity. Keys that don't exist in the incoming pod labels will be ignored. The default value is empty. The same key is forbidden to exist in both MismatchLabelKeys and LabelSelector. Also, MismatchLabelKeys cannot be set when LabelSelector isn't set. This is an alpha field and requires enabling MatchLabelKeysInPodAffinity feature gate.
                   */
                  mismatchLabelKeys?: (string | null)[] | null
                  /**
                   * A label selector is a label query over a set of resources. The result of matchLabels and matchExpressions are ANDed. An empty label selector matches all objects. A null label selector matches no objects.
                   */
                  namespaceSelector?: {
                    /**
                     * matchExpressions is a list of label selector requirements. The requirements are ANDed.
                     */
                    matchExpressions?:
                      | ({
                          /**
                           * key is the label key that the selector applies to.
                           */
                          key: string
                          /**
                           * operator represents a key's relationship to a set of values. Valid operators are In, NotIn, Exists and DoesNotExist.
                           */
                          operator: string
                          /**
                           * values is an array of string values. If the operator is In or NotIn, the values array must be non-empty. If the operator is Exists or DoesNotExist, the values array must be empty. This array is replaced during a strategic merge patch.
                           */
                          values?: (string | null)[] | null
                        } | null)[]
                      | null
                    /**
                     * matchLabels is a map of {key,value} pairs. A single {key,value} in the matchLabels map is equivalent to an element of matchExpressions, whose key field is "key", the operator is "In", and the values array contains only "value". The requirements are ANDed.
                     */
                    matchLabels?: {
                      [k: string]: string | null
                    } | null
                  } | null
                  /**
                   * namespaces specifies a static list of namespace names that the term applies to. The term is applied to the union of the namespaces listed in this field and the ones selected by namespaceSelector. null or empty namespaces list and null namespaceSelector means "this pod's namespace".
                   */
                  namespaces?: (string | null)[] | null
                  /**
                   * This pod should be co-located (affinity) or not co-located (anti-affinity) with the pods matching the labelSelector in the specified namespaces, where co-located is defined as running on a node whose value of the label with key topologyKey matches that of any node on which any of the selected pods is running. Empty topologyKey is not allowed.
                   */
                  topologyKey: string
                }
                /**
                 * weight associated with matching the corresponding podAffinityTerm, in the range 1-100.
                 */
                weight: number
              } | null)[]
            | null
          /**
           * If the anti-affinity requirements specified by this field are not met at scheduling time, the pod will not be scheduled onto the node. If the anti-affinity requirements specified by this field cease to be met at some point during pod execution (e.g. due to a pod label update), the system may or may not try to eventually evict the pod from its node. When there are multiple elements, the lists of nodes corresponding to each podAffinityTerm are intersected, i.e. all terms must be satisfied.
           */
          requiredDuringSchedulingIgnoredDuringExecution?:
            | ({
                /**
                 * A label selector is a label query over a set of resources. The result of matchLabels and matchExpressions are ANDed. An empty label selector matches all objects. A null label selector matches no objects.
                 */
                labelSelector?: {
                  /**
                   * matchExpressions is a list of label selector requirements. The requirements are ANDed.
                   */
                  matchExpressions?:
                    | ({
                        /**
                         * key is the label key that the selector applies to.
                         */
                        key: string
                        /**
                         * operator represents a key's relationship to a set of values. Valid operators are In, NotIn, Exists and DoesNotExist.
                         */
                        operator: string
                        /**
                         * values is an array of string values. If the operator is In or NotIn, the values array must be non-empty. If the operator is Exists or DoesNotExist, the values array must be empty. This array is replaced during a strategic merge patch.
                         */
                        values?: (string | null)[] | null
                      } | null)[]
                    | null
                  /**
                   * matchLabels is a map of {key,value} pairs. A single {key,value} in the matchLabels map is equivalent to an element of matchExpressions, whose key field is "key", the operator is "In", and the values array contains only "value". The requirements are ANDed.
                   */
                  matchLabels?: {
                    [k: string]: string | null
                  } | null
                } | null
                /**
                 * MatchLabelKeys is a set of pod label keys to select which pods will be taken into consideration. The keys are used to lookup values from the incoming pod labels, those key-value labels are merged with `LabelSelector` as `key in (value)` to select the group of existing pods which pods will be taken into consideration for the incoming pod's pod (anti) affinity. Keys that don't exist in the incoming pod labels will be ignored. The default value is empty. The same key is forbidden to exist in both MatchLabelKeys and LabelSelector. Also, MatchLabelKeys cannot be set when LabelSelector isn't set. This is an alpha field and requires enabling MatchLabelKeysInPodAffinity feature gate.
                 */
                matchLabelKeys?: (string | null)[] | null
                /**
                 * MismatchLabelKeys is a set of pod label keys to select which pods will be taken into consideration. The keys are used to lookup values from the incoming pod labels, those key-value labels are merged with `LabelSelector` as `key notin (value)` to select the group of existing pods which pods will be taken into consideration for the incoming pod's pod (anti) affinity. Keys that don't exist in the incoming pod labels will be ignored. The default value is empty. The same key is forbidden to exist in both MismatchLabelKeys and LabelSelector. Also, MismatchLabelKeys cannot be set when LabelSelector isn't set. This is an alpha field and requires enabling MatchLabelKeysInPodAffinity feature gate.
                 */
                mismatchLabelKeys?: (string | null)[] | null
                /**
                 * A label selector is a label query over a set of resources. The result of matchLabels and matchExpressions are ANDed. An empty label selector matches all objects. A null label selector matches no objects.
                 */
                namespaceSelector?: {
                  /**
                   * matchExpressions is a list of label selector requirements. The requirements are ANDed.
                   */
                  matchExpressions?:
                    | ({
                        /**
                         * key is the label key that the selector applies to.
                         */
                        key: string
                        /**
                         * operator represents a key's relationship to a set of values. Valid operators are In, NotIn, Exists and DoesNotExist.
                         */
                        operator: string
                        /**
                         * values is an array of string values. If the operator is In or NotIn, the values array must be non-empty. If the operator is Exists or DoesNotExist, the values array must be empty. This array is replaced during a strategic merge patch.
                         */
                        values?: (string | null)[] | null
                      } | null)[]
                    | null
                  /**
                   * matchLabels is a map of {key,value} pairs. A single {key,value} in the matchLabels map is equivalent to an element of matchExpressions, whose key field is "key", the operator is "In", and the values array contains only "value". The requirements are ANDed.
                   */
                  matchLabels?: {
                    [k: string]: string | null
                  } | null
                } | null
                /**
                 * namespaces specifies a static list of namespace names that the term applies to. The term is applied to the union of the namespaces listed in this field and the ones selected by namespaceSelector. null or empty namespaces list and null namespaceSelector means "this pod's namespace".
                 */
                namespaces?: (string | null)[] | null
                /**
                 * This pod should be co-located (affinity) or not co-located (anti-affinity) with the pods matching the labelSelector in the specified namespaces, where co-located is defined as running on a node whose value of the label with key topologyKey matches that of any node on which any of the selected pods is running. Empty topologyKey is not allowed.
                 */
                topologyKey: string
              } | null)[]
            | null
        } | null
      } | null
      /**
       * AutomountServiceAccountToken indicates whether a service account token should be automatically mounted.
       */
      automountServiceAccountToken?: boolean | null
      /**
       * List of containers belonging to the pod. Containers cannot currently be added or removed. There must be at least one container in a Pod. Cannot be updated.
       */
      containers: ({
        /**
         * Arguments to the entrypoint. The container image's CMD is used if this is not provided. Variable references $(VAR_NAME) are expanded using the container's environment. If a variable cannot be resolved, the reference in the input string will be unchanged. Double $$ are reduced to a single $, which allows for escaping the $(VAR_NAME) syntax: i.e. "$$(VAR_NAME)" will produce the string literal "$(VAR_NAME)". Escaped references will never be expanded, regardless of whether the variable exists or not. Cannot be updated. More info: https://kubernetes.io/docs/tasks/inject-data-application/define-command-argument-container/#running-a-command-in-a-shell
         */
        args?: (string | null)[] | null
        /**
         * Entrypoint array. Not executed within a shell. The container image's ENTRYPOINT is used if this is not provided. Variable references $(VAR_NAME) are expanded using the container's environment. If a variable cannot be resolved, the reference in the input string will be unchanged. Double $$ are reduced to a single $, which allows for escaping the $(VAR_NAME) syntax: i.e. "$$(VAR_NAME)" will produce the string literal "$(VAR_NAME)". Escaped references will never be expanded, regardless of whether the variable exists or not. Cannot be updated. More info: https://kubernetes.io/docs/tasks/inject-data-application/define-command-argument-container/#running-a-command-in-a-shell
         */
        command?: (string | null)[] | null
        /**
         * List of environment variables to set in the container. Cannot be updated.
         */
        env?:
          | ({
              /**
               * Name of the environment variable. Must be a C_IDENTIFIER.
               */
              name: string
              /**
               * Variable references $(VAR_NAME) are expanded using the previously defined environment variables in the container and any service environment variables. If a variable cannot be resolved, the reference in the input string will be unchanged. Double $$ are reduced to a single $, which allows for escaping the $(VAR_NAME) syntax: i.e. "$$(VAR_NAME)" will produce the string literal "$(VAR_NAME)". Escaped references will never be expanded, regardless of whether the variable exists or not. Defaults to "".
               */
              value?: string | null
              /**
               * EnvVarSource represents a source for the value of an EnvVar.
               */
              valueFrom?: {
                /**
                 * Selects a key from a ConfigMap.
                 */
                configMapKeyRef?: {
                  /**
                   * The key to select.
                   */
                  key: string
                  /**
                   * Name of the referent. More info: https://kubernetes.io/docs/concepts/overview/working-with-objects/names/#names
                   */
                  name?: string | null
                  /**
                   * Specify whether the ConfigMap or its key must be defined
                   */
                  optional?: boolean | null
                } | null
                /**
                 * ObjectFieldSelector selects an APIVersioned field of an object.
                 */
                fieldRef?: {
                  /**
                   * Version of the schema the FieldPath is written in terms of, defaults to "v1".
                   */
                  apiVersion?: string | null
                  /**
                   * Path of the field to select in the specified API version.
                   */
                  fieldPath: string
                } | null
                /**
                 * ResourceFieldSelector represents container resources (cpu, memory) and their output format
                 */
                resourceFieldRef?: {
                  /**
                   * Container name: required for volumes, optional for env vars
                   */
                  containerName?: string | null
                  divisor?: (string | null) | (number | null)
                  /**
                   * Required: resource to select
                   */
                  resource: string
                } | null
                /**
                 * SecretKeySelector selects a key of a Secret.
                 */
                secretKeyRef?: {
                  /**
                   * The key of the secret to select from.  Must be a valid secret key.
                   */
                  key: string
                  /**
                   * Name of the referent. More info: https://kubernetes.io/docs/concepts/overview/working-with-objects/names/#names
                   */
                  name?: string | null
                  /**
                   * Specify whether the Secret or its key must be defined
                   */
                  optional?: boolean | null
                } | null
              } | null
            } | null)[]
          | null
        /**
         * List of sources to populate environment variables in the container. The keys defined within a source must be a C_IDENTIFIER. All invalid keys will be reported as an event when the container is starting. When a key exists in multiple sources, the value associated with the last source will take precedence. Values defined by an Env with a duplicate key will take precedence. Cannot be updated.
         */
        envFrom?:
          | ({
              /**
               * ConfigMapEnvSource selects a ConfigMap to populate the environment variables with.
               *
               * The contents of the target ConfigMap's Data field will represent the key-value pairs as environment variables.
               */
              configMapRef?: {
                /**
                 * Name of the referent. More info: https://kubernetes.io/docs/concepts/overview/working-with-objects/names/#names
                 */
                name?: string | null
                /**
                 * Specify whether the ConfigMap must be defined
                 */
                optional?: boolean | null
              } | null
              /**
               * An optional identifier to prepend to each key in the ConfigMap. Must be a C_IDENTIFIER.
               */
              prefix?: string | null
              /**
               * SecretEnvSource selects a Secret to populate the environment variables with.
               *
               * The contents of the target Secret's Data field will represent the key-value pairs as environment variables.
               */
              secretRef?: {
                /**
                 * Name of the referent. More info: https://kubernetes.io/docs/concepts/overview/working-with-objects/names/#names
                 */
                name?: string | null
                /**
                 * Specify whether the Secret must be defined
                 */
                optional?: boolean | null
              } | null
            } | null)[]
          | null
        /**
         * Container image name. More info: https://kubernetes.io/docs/concepts/containers/images This field is optional to allow higher level config management to default or override container images in workload controllers like Deployments and StatefulSets.
         */
        image?: string | null
        /**
         * Image pull policy. One of Always, Never, IfNotPresent. Defaults to Always if :latest tag is specified, or IfNotPresent otherwise. Cannot be updated. More info: https://kubernetes.io/docs/concepts/containers/images#updating-images
         */
        imagePullPolicy?: string | null
        /**
         * Lifecycle describes actions that the management system should take in response to container lifecycle events. For the PostStart and PreStop lifecycle handlers, management of the container blocks until the action is complete, unless the container process fails, in which case the handler is aborted.
         */
        lifecycle?: {
          /**
           * LifecycleHandler defines a specific action that should be taken in a lifecycle hook. One and only one of the fields, except TCPSocket must be specified.
           */
          postStart?: {
            /**
             * ExecAction describes a "run in container" action.
             */
            exec?: {
              /**
               * Command is the command line to execute inside the container, the working directory for the command  is root ('/') in the container's filesystem. The command is simply exec'd, it is not run inside a shell, so traditional shell instructions ('|', etc) won't work. To use a shell, you need to explicitly call out to that shell. Exit status of 0 is treated as live/healthy and non-zero is unhealthy.
               */
              command?: (string | null)[] | null
            } | null
            /**
             * HTTPGetAction describes an action based on HTTP Get requests.
             */
            httpGet?: {
              /**
               * Host name to connect to, defaults to the pod IP. You probably want to set "Host" in httpHeaders instead.
               */
              host?: string | null
              /**
               * Custom headers to set in the request. HTTP allows repeated headers.
               */
              httpHeaders?:
                | ({
                    /**
                     * The header field name. This will be canonicalized upon output, so case-variant names will be understood as the same header.
                     */
                    name: string
                    /**
                     * The header field value
                     */
                    value: string
                  } | null)[]
                | null
              /**
               * Path to access on the HTTP server.
               */
              path?: string | null
              port: (string | null) | (number | null)
              /**
               * Scheme to use for connecting to the host. Defaults to HTTP.
               */
              scheme?: string | null
            } | null
            /**
             * SleepAction describes a "sleep" action.
             */
            sleep?: {
              /**
               * Seconds is the number of seconds to sleep.
               */
              seconds: number
            } | null
            /**
             * TCPSocketAction describes an action based on opening a socket
             */
            tcpSocket?: {
              /**
               * Optional: Host name to connect to, defaults to the pod IP.
               */
              host?: string | null
              port: (string | null) | (number | null)
            } | null
          } | null
          /**
           * LifecycleHandler defines a specific action that should be taken in a lifecycle hook. One and only one of the fields, except TCPSocket must be specified.
           */
          preStop?: {
            /**
             * ExecAction describes a "run in container" action.
             */
            exec?: {
              /**
               * Command is the command line to execute inside the container, the working directory for the command  is root ('/') in the container's filesystem. The command is simply exec'd, it is not run inside a shell, so traditional shell instructions ('|', etc) won't work. To use a shell, you need to explicitly call out to that shell. Exit status of 0 is treated as live/healthy and non-zero is unhealthy.
               */
              command?: (string | null)[] | null
            } | null
            /**
             * HTTPGetAction describes an action based on HTTP Get requests.
             */
            httpGet?: {
              /**
               * Host name to connect to, defaults to the pod IP. You probably want to set "Host" in httpHeaders instead.
               */
              host?: string | null
              /**
               * Custom headers to set in the request. HTTP allows repeated headers.
               */
              httpHeaders?:
                | ({
                    /**
                     * The header field name. This will be canonicalized upon output, so case-variant names will be understood as the same header.
                     */
                    name: string
                    /**
                     * The header field value
                     */
                    value: string
                  } | null)[]
                | null
              /**
               * Path to access on the HTTP server.
               */
              path?: string | null
              port: (string | null) | (number | null)
              /**
               * Scheme to use for connecting to the host. Defaults to HTTP.
               */
              scheme?: string | null
            } | null
            /**
             * SleepAction describes a "sleep" action.
             */
            sleep?: {
              /**
               * Seconds is the number of seconds to sleep.
               */
              seconds: number
            } | null
            /**
             * TCPSocketAction describes an action based on opening a socket
             */
            tcpSocket?: {
              /**
               * Optional: Host name to connect to, defaults to the pod IP.
               */
              host?: string | null
              port: (string | null) | (number | null)
            } | null
          } | null
        } | null
        /**
         * Probe describes a health check to be performed against a container to determine whether it is alive or ready to receive traffic.
         */
        livenessProbe?: {
          /**
           * ExecAction describes a "run in container" action.
           */
          exec?: {
            /**
             * Command is the command line to execute inside the container, the working directory for the command  is root ('/') in the container's filesystem. The command is simply exec'd, it is not run inside a shell, so traditional shell instructions ('|', etc) won't work. To use a shell, you need to explicitly call out to that shell. Exit status of 0 is treated as live/healthy and non-zero is unhealthy.
             */
            command?: (string | null)[] | null
          } | null
          /**
           * Minimum consecutive failures for the probe to be considered failed after having succeeded. Defaults to 3. Minimum value is 1.
           */
          failureThreshold?: number | null
          grpc?: {
            /**
             * Port number of the gRPC service. Number must be in the range 1 to 65535.
             */
            port: number
            /**
             * Service is the name of the service to place in the gRPC HealthCheckRequest (see https://github.com/grpc/grpc/blob/master/doc/health-checking.md).
             *
             * If this is not specified, the default behavior is defined by gRPC.
             */
            service?: string | null
          } | null
          /**
           * HTTPGetAction describes an action based on HTTP Get requests.
           */
          httpGet?: {
            /**
             * Host name to connect to, defaults to the pod IP. You probably want to set "Host" in httpHeaders instead.
             */
            host?: string | null
            /**
             * Custom headers to set in the request. HTTP allows repeated headers.
             */
            httpHeaders?:
              | ({
                  /**
                   * The header field name. This will be canonicalized upon output, so case-variant names will be understood as the same header.
                   */
                  name: string
                  /**
                   * The header field value
                   */
                  value: string
                } | null)[]
              | null
            /**
             * Path to access on the HTTP server.
             */
            path?: string | null
            port: (string | null) | (number | null)
            /**
             * Scheme to use for connecting to the host. Defaults to HTTP.
             */
            scheme?: string | null
          } | null
          /**
           * Number of seconds after the container has started before liveness probes are initiated. More info: https://kubernetes.io/docs/concepts/workloads/pods/pod-lifecycle#container-probes
           */
          initialDelaySeconds?: number | null
          /**
           * How often (in seconds) to perform the probe. Default to 10 seconds. Minimum value is 1.
           */
          periodSeconds?: number | null
          /**
           * Minimum consecutive successes for the probe to be considered successful after having failed. Defaults to 1. Must be 1 for liveness and startup. Minimum value is 1.
           */
          successThreshold?: number | null
          /**
           * TCPSocketAction describes an action based on opening a socket
           */
          tcpSocket?: {
            /**
             * Optional: Host name to connect to, defaults to the pod IP.
             */
            host?: string | null
            port: (string | null) | (number | null)
          } | null
          /**
           * Optional duration in seconds the pod needs to terminate gracefully upon probe failure. The grace period is the duration in seconds after the processes running in the pod are sent a termination signal and the time when the processes are forcibly halted with a kill signal. Set this value longer than the expected cleanup time for your process. If this value is nil, the pod's terminationGracePeriodSeconds will be used. Otherwise, this value overrides the value provided by the pod spec. Value must be non-negative integer. The value zero indicates stop immediately via the kill signal (no opportunity to shut down). This is a beta field and requires enabling ProbeTerminationGracePeriod feature gate. Minimum value is 1. spec.terminationGracePeriodSeconds is used if unset.
           */
          terminationGracePeriodSeconds?: number | null
          /**
           * Number of seconds after which the probe times out. Defaults to 1 second. Minimum value is 1. More info: https://kubernetes.io/docs/concepts/workloads/pods/pod-lifecycle#container-probes
           */
          timeoutSeconds?: number | null
        } | null
        /**
         * Name of the container specified as a DNS_LABEL. Each container in a pod must have a unique name (DNS_LABEL). Cannot be updated.
         */
        name: string
        /**
         * List of ports to expose from the container. Not specifying a port here DOES NOT prevent that port from being exposed. Any port which is listening on the default "0.0.0.0" address inside a container will be accessible from the network. Modifying this array with strategic merge patch may corrupt the data. For more information See https://github.com/kubernetes/kubernetes/issues/108255. Cannot be updated.
         */
        ports?:
          | ({
              /**
               * Number of port to expose on the pod's IP address. This must be a valid port number, 0 < x < 65536.
               */
              containerPort: number
              /**
               * What host IP to bind the external port to.
               */
              hostIP?: string | null
              /**
               * Number of port to expose on the host. If specified, this must be a valid port number, 0 < x < 65536. If HostNetwork is specified, this must match ContainerPort. Most containers do not need this.
               */
              hostPort?: number | null
              /**
               * If specified, this must be an IANA_SVC_NAME and unique within the pod. Each named port in a pod must have a unique name. Name for the port that can be referred to by services.
               */
              name?: string | null
              /**
               * Protocol for port. Must be UDP, TCP, or SCTP. Defaults to "TCP".
               */
              protocol?: string | null
            } | null)[]
          | null
        /**
         * Probe describes a health check to be performed against a container to determine whether it is alive or ready to receive traffic.
         */
        readinessProbe?: {
          /**
           * ExecAction describes a "run in container" action.
           */
          exec?: {
            /**
             * Command is the command line to execute inside the container, the working directory for the command  is root ('/') in the container's filesystem. The command is simply exec'd, it is not run inside a shell, so traditional shell instructions ('|', etc) won't work. To use a shell, you need to explicitly call out to that shell. Exit status of 0 is treated as live/healthy and non-zero is unhealthy.
             */
            command?: (string | null)[] | null
          } | null
          /**
           * Minimum consecutive failures for the probe to be considered failed after having succeeded. Defaults to 3. Minimum value is 1.
           */
          failureThreshold?: number | null
          grpc?: {
            /**
             * Port number of the gRPC service. Number must be in the range 1 to 65535.
             */
            port: number
            /**
             * Service is the name of the service to place in the gRPC HealthCheckRequest (see https://github.com/grpc/grpc/blob/master/doc/health-checking.md).
             *
             * If this is not specified, the default behavior is defined by gRPC.
             */
            service?: string | null
          } | null
          /**
           * HTTPGetAction describes an action based on HTTP Get requests.
           */
          httpGet?: {
            /**
             * Host name to connect to, defaults to the pod IP. You probably want to set "Host" in httpHeaders instead.
             */
            host?: string | null
            /**
             * Custom headers to set in the request. HTTP allows repeated headers.
             */
            httpHeaders?:
              | ({
                  /**
                   * The header field name. This will be canonicalized upon output, so case-variant names will be understood as the same header.
                   */
                  name: string
                  /**
                   * The header field value
                   */
                  value: string
                } | null)[]
              | null
            /**
             * Path to access on the HTTP server.
             */
            path?: string | null
            port: (string | null) | (number | null)
            /**
             * Scheme to use for connecting to the host. Defaults to HTTP.
             */
            scheme?: string | null
          } | null
          /**
           * Number of seconds after the container has started before liveness probes are initiated. More info: https://kubernetes.io/docs/concepts/workloads/pods/pod-lifecycle#container-probes
           */
          initialDelaySeconds?: number | null
          /**
           * How often (in seconds) to perform the probe. Default to 10 seconds. Minimum value is 1.
           */
          periodSeconds?: number | null
          /**
           * Minimum consecutive successes for the probe to be considered successful after having failed. Defaults to 1. Must be 1 for liveness and startup. Minimum value is 1.
           */
          successThreshold?: number | null
          /**
           * TCPSocketAction describes an action based on opening a socket
           */
          tcpSocket?: {
            /**
             * Optional: Host name to connect to, defaults to the pod IP.
             */
            host?: string | null
            port: (string | null) | (number | null)
          } | null
          /**
           * Optional duration in seconds the pod needs to terminate gracefully upon probe failure. The grace period is the duration in seconds after the processes running in the pod are sent a termination signal and the time when the processes are forcibly halted with a kill signal. Set this value longer than the expected cleanup time for your process. If this value is nil, the pod's terminationGracePeriodSeconds will be used. Otherwise, this value overrides the value provided by the pod spec. Value must be non-negative integer. The value zero indicates stop immediately via the kill signal (no opportunity to shut down). This is a beta field and requires enabling ProbeTerminationGracePeriod feature gate. Minimum value is 1. spec.terminationGracePeriodSeconds is used if unset.
           */
          terminationGracePeriodSeconds?: number | null
          /**
           * Number of seconds after which the probe times out. Defaults to 1 second. Minimum value is 1. More info: https://kubernetes.io/docs/concepts/workloads/pods/pod-lifecycle#container-probes
           */
          timeoutSeconds?: number | null
        } | null
        /**
         * Resources resize policy for the container.
         */
        resizePolicy?:
          | ({
              /**
               * Name of the resource to which this resource resize policy applies. Supported values: cpu, memory.
               */
              resourceName: string
              /**
               * Restart policy to apply when specified resource is resized. If not specified, it defaults to NotRequired.
               */
              restartPolicy: string
            } | null)[]
          | null
        /**
         * ResourceRequirements describes the compute resource requirements.
         */
        resources?: {
          /**
           * Claims lists the names of resources, defined in spec.resourceClaims, that are used by this container.
           *
           * This is an alpha field and requires enabling the DynamicResourceAllocation feature gate.
           *
           * This field is immutable. It can only be set for containers.
           */
          claims?:
            | ({
                /**
                 * Name must match the name of one entry in pod.spec.resourceClaims of the Pod where this field is used. It makes that resource available inside a container.
                 */
                name: string
              } | null)[]
            | null
          /**
           * Limits describes the maximum amount of compute resources allowed. More info: https://kubernetes.io/docs/concepts/configuration/manage-resources-containers/
           */
          limits?: {
            [k: string]: (string | null) | (number | null)
          } | null
          /**
           * Requests describes the minimum amount of compute resources required. If Requests is omitted for a container, it defaults to Limits if that is explicitly specified, otherwise to an implementation-defined value. Requests cannot exceed Limits. More info: https://kubernetes.io/docs/concepts/configuration/manage-resources-containers/
           */
          requests?: {
            [k: string]: (string | null) | (number | null)
          } | null
        } | null
        /**
         * RestartPolicy defines the restart behavior of individual containers in a pod. This field may only be set for init containers, and the only allowed value is "Always". For non-init containers or when this field is not specified, the restart behavior is defined by the Pod's restart policy and the container type. Setting the RestartPolicy as "Always" for the init container will have the following effect: this init container will be continually restarted on exit until all regular containers have terminated. Once all regular containers have completed, all init containers with restartPolicy "Always" will be shut down. This lifecycle differs from normal init containers and is often referred to as a "sidecar" container. Although this init container still starts in the init container sequence, it does not wait for the container to complete before proceeding to the next init container. Instead, the next init container starts immediately after this init container is started, or after any startupProbe has successfully completed.
         */
        restartPolicy?: string | null
        /**
         * SecurityContext holds security configuration that will be applied to a container. Some fields are present in both SecurityContext and PodSecurityContext.  When both are set, the values in SecurityContext take precedence.
         */
        securityContext?: {
          /**
           * AllowPrivilegeEscalation controls whether a process can gain more privileges than its parent process. This bool directly controls if the no_new_privs flag will be set on the container process. AllowPrivilegeEscalation is true always when the container is: 1) run as Privileged 2) has CAP_SYS_ADMIN Note that this field cannot be set when spec.os.name is windows.
           */
          allowPrivilegeEscalation?: boolean | null
          /**
           * Adds and removes POSIX capabilities from running containers.
           */
          capabilities?: {
            /**
             * Added capabilities
             */
            add?: (string | null)[] | null
            /**
             * Removed capabilities
             */
            drop?: (string | null)[] | null
          } | null
          /**
           * Run container in privileged mode. Processes in privileged containers are essentially equivalent to root on the host. Defaults to false. Note that this field cannot be set when spec.os.name is windows.
           */
          privileged?: boolean | null
          /**
           * procMount denotes the type of proc mount to use for the containers. The default is DefaultProcMount which uses the container runtime defaults for readonly paths and masked paths. This requires the ProcMountType feature flag to be enabled. Note that this field cannot be set when spec.os.name is windows.
           */
          procMount?: string | null
          /**
           * Whether this container has a read-only root filesystem. Default is false. Note that this field cannot be set when spec.os.name is windows.
           */
          readOnlyRootFilesystem?: boolean | null
          /**
           * The GID to run the entrypoint of the container process. Uses runtime default if unset. May also be set in PodSecurityContext.  If set in both SecurityContext and PodSecurityContext, the value specified in SecurityContext takes precedence. Note that this field cannot be set when spec.os.name is windows.
           */
          runAsGroup?: number | null
          /**
           * Indicates that the container must run as a non-root user. If true, the Kubelet will validate the image at runtime to ensure that it does not run as UID 0 (root) and fail to start the container if it does. If unset or false, no such validation will be performed. May also be set in PodSecurityContext.  If set in both SecurityContext and PodSecurityContext, the value specified in SecurityContext takes precedence.
           */
          runAsNonRoot?: boolean | null
          /**
           * The UID to run the entrypoint of the container process. Defaults to user specified in image metadata if unspecified. May also be set in PodSecurityContext.  If set in both SecurityContext and PodSecurityContext, the value specified in SecurityContext takes precedence. Note that this field cannot be set when spec.os.name is windows.
           */
          runAsUser?: number | null
          /**
           * SELinuxOptions are the labels to be applied to the container
           */
          seLinuxOptions?: {
            /**
             * Level is SELinux level label that applies to the container.
             */
            level?: string | null
            /**
             * Role is a SELinux role label that applies to the container.
             */
            role?: string | null
            /**
             * Type is a SELinux type label that applies to the container.
             */
            type?: string | null
            /**
             * User is a SELinux user label that applies to the container.
             */
            user?: string | null
          } | null
          /**
           * SeccompProfile defines a pod/container's seccomp profile settings. Only one profile source may be set.
           */
          seccompProfile?: {
            /**
             * localhostProfile indicates a profile defined in a file on the node should be used. The profile must be preconfigured on the node to work. Must be a descending path, relative to the kubelet's configured seccomp profile location. Must be set if type is "Localhost". Must NOT be set for any other type.
             */
            localhostProfile?: string | null
            /**
             * type indicates which kind of seccomp profile will be applied. Valid options are:
             *
             * Localhost - a profile defined in a file on the node should be used. RuntimeDefault - the container runtime default profile should be used. Unconfined - no profile should be applied.
             */
            type: string
          } | null
          /**
           * WindowsSecurityContextOptions contain Windows-specific options and credentials.
           */
          windowsOptions?: {
            /**
             * GMSACredentialSpec is where the GMSA admission webhook (https://github.com/kubernetes-sigs/windows-gmsa) inlines the contents of the GMSA credential spec named by the GMSACredentialSpecName field.
             */
            gmsaCredentialSpec?: string | null
            /**
             * GMSACredentialSpecName is the name of the GMSA credential spec to use.
             */
            gmsaCredentialSpecName?: string | null
            /**
             * HostProcess determines if a container should be run as a 'Host Process' container. All of a Pod's containers must have the same effective HostProcess value (it is not allowed to have a mix of HostProcess containers and non-HostProcess containers). In addition, if HostProcess is true then HostNetwork must also be set to true.
             */
            hostProcess?: boolean | null
            /**
             * The UserName in Windows to run the entrypoint of the container process. Defaults to the user specified in image metadata if unspecified. May also be set in PodSecurityContext. If set in both SecurityContext and PodSecurityContext, the value specified in SecurityContext takes precedence.
             */
            runAsUserName?: string | null
          } | null
        } | null
        /**
         * Probe describes a health check to be performed against a container to determine whether it is alive or ready to receive traffic.
         */
        startupProbe?: {
          /**
           * ExecAction describes a "run in container" action.
           */
          exec?: {
            /**
             * Command is the command line to execute inside the container, the working directory for the command  is root ('/') in the container's filesystem. The command is simply exec'd, it is not run inside a shell, so traditional shell instructions ('|', etc) won't work. To use a shell, you need to explicitly call out to that shell. Exit status of 0 is treated as live/healthy and non-zero is unhealthy.
             */
            command?: (string | null)[] | null
          } | null
          /**
           * Minimum consecutive failures for the probe to be considered failed after having succeeded. Defaults to 3. Minimum value is 1.
           */
          failureThreshold?: number | null
          grpc?: {
            /**
             * Port number of the gRPC service. Number must be in the range 1 to 65535.
             */
            port: number
            /**
             * Service is the name of the service to place in the gRPC HealthCheckRequest (see https://github.com/grpc/grpc/blob/master/doc/health-checking.md).
             *
             * If this is not specified, the default behavior is defined by gRPC.
             */
            service?: string | null
          } | null
          /**
           * HTTPGetAction describes an action based on HTTP Get requests.
           */
          httpGet?: {
            /**
             * Host name to connect to, defaults to the pod IP. You probably want to set "Host" in httpHeaders instead.
             */
            host?: string | null
            /**
             * Custom headers to set in the request. HTTP allows repeated headers.
             */
            httpHeaders?:
              | ({
                  /**
                   * The header field name. This will be canonicalized upon output, so case-variant names will be understood as the same header.
                   */
                  name: string
                  /**
                   * The header field value
                   */
                  value: string
                } | null)[]
              | null
            /**
             * Path to access on the HTTP server.
             */
            path?: string | null
            port: (string | null) | (number | null)
            /**
             * Scheme to use for connecting to the host. Defaults to HTTP.
             */
            scheme?: string | null
          } | null
          /**
           * Number of seconds after the container has started before liveness probes are initiated. More info: https://kubernetes.io/docs/concepts/workloads/pods/pod-lifecycle#container-probes
           */
          initialDelaySeconds?: number | null
          /**
           * How often (in seconds) to perform the probe. Default to 10 seconds. Minimum value is 1.
           */
          periodSeconds?: number | null
          /**
           * Minimum consecutive successes for the probe to be considered successful after having failed. Defaults to 1. Must be 1 for liveness and startup. Minimum value is 1.
           */
          successThreshold?: number | null
          /**
           * TCPSocketAction describes an action based on opening a socket
           */
          tcpSocket?: {
            /**
             * Optional: Host name to connect to, defaults to the pod IP.
             */
            host?: string | null
            port: (string | null) | (number | null)
          } | null
          /**
           * Optional duration in seconds the pod needs to terminate gracefully upon probe failure. The grace period is the duration in seconds after the processes running in the pod are sent a termination signal and the time when the processes are forcibly halted with a kill signal. Set this value longer than the expected cleanup time for your process. If this value is nil, the pod's terminationGracePeriodSeconds will be used. Otherwise, this value overrides the value provided by the pod spec. Value must be non-negative integer. The value zero indicates stop immediately via the kill signal (no opportunity to shut down). This is a beta field and requires enabling ProbeTerminationGracePeriod feature gate. Minimum value is 1. spec.terminationGracePeriodSeconds is used if unset.
           */
          terminationGracePeriodSeconds?: number | null
          /**
           * Number of seconds after which the probe times out. Defaults to 1 second. Minimum value is 1. More info: https://kubernetes.io/docs/concepts/workloads/pods/pod-lifecycle#container-probes
           */
          timeoutSeconds?: number | null
        } | null
        /**
         * Whether this container should allocate a buffer for stdin in the container runtime. If this is not set, reads from stdin in the container will always result in EOF. Default is false.
         */
        stdin?: boolean | null
        /**
         * Whether the container runtime should close the stdin channel after it has been opened by a single attach. When stdin is true the stdin stream will remain open across multiple attach sessions. If stdinOnce is set to true, stdin is opened on container start, is empty until the first client attaches to stdin, and then remains open and accepts data until the client disconnects, at which time stdin is closed and remains closed until the container is restarted. If this flag is false, a container processes that reads from stdin will never receive an EOF. Default is false
         */
        stdinOnce?: boolean | null
        /**
         * Optional: Path at which the file to which the container's termination message will be written is mounted into the container's filesystem. Message written is intended to be brief final status, such as an assertion failure message. Will be truncated by the node if greater than 4096 bytes. The total message length across all containers will be limited to 12kb. Defaults to /dev/termination-log. Cannot be updated.
         */
        terminationMessagePath?: string | null
        /**
         * Indicate how the termination message should be populated. File will use the contents of terminationMessagePath to populate the container status message on both success and failure. FallbackToLogsOnError will use the last chunk of container log output if the termination message file is empty and the container exited with an error. The log output is limited to 2048 bytes or 80 lines, whichever is smaller. Defaults to File. Cannot be updated.
         */
        terminationMessagePolicy?: string | null
        /**
         * Whether this container should allocate a TTY for itself, also requires 'stdin' to be true. Default is false.
         */
        tty?: boolean | null
        /**
         * volumeDevices is the list of block devices to be used by the container.
         */
        volumeDevices?:
          | ({
              /**
               * devicePath is the path inside of the container that the device will be mapped to.
               */
              devicePath: string
              /**
               * name must match the name of a persistentVolumeClaim in the pod
               */
              name: string
            } | null)[]
          | null
        /**
         * Pod volumes to mount into the container's filesystem. Cannot be updated.
         */
        volumeMounts?:
          | ({
              /**
               * Path within the container at which the volume should be mounted.  Must not contain ':'.
               */
              mountPath: string
              /**
               * mountPropagation determines how mounts are propagated from the host to container and the other way around. When not set, MountPropagationNone is used. This field is beta in 1.10.
               */
              mountPropagation?: string | null
              /**
               * This must match the Name of a Volume.
               */
              name: string
              /**
               * Mounted read-only if true, read-write otherwise (false or unspecified). Defaults to false.
               */
              readOnly?: boolean | null
              /**
               * Path within the volume from which the container's volume should be mounted. Defaults to "" (volume's root).
               */
              subPath?: string | null
              /**
               * Expanded path within the volume from which the container's volume should be mounted. Behaves similarly to SubPath but environment variable references $(VAR_NAME) are expanded using the container's environment. Defaults to "" (volume's root). SubPathExpr and SubPath are mutually exclusive.
               */
              subPathExpr?: string | null
            } | null)[]
          | null
        /**
         * Container's working directory. If not specified, the container runtime's default will be used, which might be configured in the container image. Cannot be updated.
         */
        workingDir?: string | null
      } | null)[]
      /**
       * PodDNSConfig defines the DNS parameters of a pod in addition to those generated from DNSPolicy.
       */
      dnsConfig?: {
        /**
         * A list of DNS name server IP addresses. This will be appended to the base nameservers generated from DNSPolicy. Duplicated nameservers will be removed.
         */
        nameservers?: (string | null)[] | null
        /**
         * A list of DNS resolver options. This will be merged with the base options generated from DNSPolicy. Duplicated entries will be removed. Resolution options given in Options will override those that appear in the base DNSPolicy.
         */
        options?:
          | ({
              /**
               * Required.
               */
              name?: string | null
              value?: string | null
            } | null)[]
          | null
        /**
         * A list of DNS search domains for host-name lookup. This will be appended to the base search paths generated from DNSPolicy. Duplicated search paths will be removed.
         */
        searches?: (string | null)[] | null
      } | null
      /**
       * Set DNS policy for the pod. Defaults to "ClusterFirst". Valid values are 'ClusterFirstWithHostNet', 'ClusterFirst', 'Default' or 'None'. DNS parameters given in DNSConfig will be merged with the policy selected with DNSPolicy. To have DNS options set along with hostNetwork, you have to specify DNS policy explicitly to 'ClusterFirstWithHostNet'.
       */
      dnsPolicy?: string | null
      /**
       * EnableServiceLinks indicates whether information about services should be injected into pod's environment variables, matching the syntax of Docker links. Optional: Defaults to true.
       */
      enableServiceLinks?: boolean | null
      /**
       * List of ephemeral containers run in this pod. Ephemeral containers may be run in an existing pod to perform user-initiated actions such as debugging. This list cannot be specified when creating a pod, and it cannot be modified by updating the pod spec. In order to add an ephemeral container to an existing pod, use the pod's ephemeralcontainers subresource.
       */
      ephemeralContainers?:
        | ({
            /**
             * Arguments to the entrypoint. The image's CMD is used if this is not provided. Variable references $(VAR_NAME) are expanded using the container's environment. If a variable cannot be resolved, the reference in the input string will be unchanged. Double $$ are reduced to a single $, which allows for escaping the $(VAR_NAME) syntax: i.e. "$$(VAR_NAME)" will produce the string literal "$(VAR_NAME)". Escaped references will never be expanded, regardless of whether the variable exists or not. Cannot be updated. More info: https://kubernetes.io/docs/tasks/inject-data-application/define-command-argument-container/#running-a-command-in-a-shell
             */
            args?: (string | null)[] | null
            /**
             * Entrypoint array. Not executed within a shell. The image's ENTRYPOINT is used if this is not provided. Variable references $(VAR_NAME) are expanded using the container's environment. If a variable cannot be resolved, the reference in the input string will be unchanged. Double $$ are reduced to a single $, which allows for escaping the $(VAR_NAME) syntax: i.e. "$$(VAR_NAME)" will produce the string literal "$(VAR_NAME)". Escaped references will never be expanded, regardless of whether the variable exists or not. Cannot be updated. More info: https://kubernetes.io/docs/tasks/inject-data-application/define-command-argument-container/#running-a-command-in-a-shell
             */
            command?: (string | null)[] | null
            /**
             * List of environment variables to set in the container. Cannot be updated.
             */
            env?:
              | ({
                  /**
                   * Name of the environment variable. Must be a C_IDENTIFIER.
                   */
                  name: string
                  /**
                   * Variable references $(VAR_NAME) are expanded using the previously defined environment variables in the container and any service environment variables. If a variable cannot be resolved, the reference in the input string will be unchanged. Double $$ are reduced to a single $, which allows for escaping the $(VAR_NAME) syntax: i.e. "$$(VAR_NAME)" will produce the string literal "$(VAR_NAME)". Escaped references will never be expanded, regardless of whether the variable exists or not. Defaults to "".
                   */
                  value?: string | null
                  /**
                   * EnvVarSource represents a source for the value of an EnvVar.
                   */
                  valueFrom?: {
                    /**
                     * Selects a key from a ConfigMap.
                     */
                    configMapKeyRef?: {
                      /**
                       * The key to select.
                       */
                      key: string
                      /**
                       * Name of the referent. More info: https://kubernetes.io/docs/concepts/overview/working-with-objects/names/#names
                       */
                      name?: string | null
                      /**
                       * Specify whether the ConfigMap or its key must be defined
                       */
                      optional?: boolean | null
                    } | null
                    /**
                     * ObjectFieldSelector selects an APIVersioned field of an object.
                     */
                    fieldRef?: {
                      /**
                       * Version of the schema the FieldPath is written in terms of, defaults to "v1".
                       */
                      apiVersion?: string | null
                      /**
                       * Path of the field to select in the specified API version.
                       */
                      fieldPath: string
                    } | null
                    /**
                     * ResourceFieldSelector represents container resources (cpu, memory) and their output format
                     */
                    resourceFieldRef?: {
                      /**
                       * Container name: required for volumes, optional for env vars
                       */
                      containerName?: string | null
                      divisor?: (string | null) | (number | null)
                      /**
                       * Required: resource to select
                       */
                      resource: string
                    } | null
                    /**
                     * SecretKeySelector selects a key of a Secret.
                     */
                    secretKeyRef?: {
                      /**
                       * The key of the secret to select from.  Must be a valid secret key.
                       */
                      key: string
                      /**
                       * Name of the referent. More info: https://kubernetes.io/docs/concepts/overview/working-with-objects/names/#names
                       */
                      name?: string | null
                      /**
                       * Specify whether the Secret or its key must be defined
                       */
                      optional?: boolean | null
                    } | null
                  } | null
                } | null)[]
              | null
            /**
             * List of sources to populate environment variables in the container. The keys defined within a source must be a C_IDENTIFIER. All invalid keys will be reported as an event when the container is starting. When a key exists in multiple sources, the value associated with the last source will take precedence. Values defined by an Env with a duplicate key will take precedence. Cannot be updated.
             */
            envFrom?:
              | ({
                  /**
                   * ConfigMapEnvSource selects a ConfigMap to populate the environment variables with.
                   *
                   * The contents of the target ConfigMap's Data field will represent the key-value pairs as environment variables.
                   */
                  configMapRef?: {
                    /**
                     * Name of the referent. More info: https://kubernetes.io/docs/concepts/overview/working-with-objects/names/#names
                     */
                    name?: string | null
                    /**
                     * Specify whether the ConfigMap must be defined
                     */
                    optional?: boolean | null
                  } | null
                  /**
                   * An optional identifier to prepend to each key in the ConfigMap. Must be a C_IDENTIFIER.
                   */
                  prefix?: string | null
                  /**
                   * SecretEnvSource selects a Secret to populate the environment variables with.
                   *
                   * The contents of the target Secret's Data field will represent the key-value pairs as environment variables.
                   */
                  secretRef?: {
                    /**
                     * Name of the referent. More info: https://kubernetes.io/docs/concepts/overview/working-with-objects/names/#names
                     */
                    name?: string | null
                    /**
                     * Specify whether the Secret must be defined
                     */
                    optional?: boolean | null
                  } | null
                } | null)[]
              | null
            /**
             * Container image name. More info: https://kubernetes.io/docs/concepts/containers/images
             */
            image?: string | null
            /**
             * Image pull policy. One of Always, Never, IfNotPresent. Defaults to Always if :latest tag is specified, or IfNotPresent otherwise. Cannot be updated. More info: https://kubernetes.io/docs/concepts/containers/images#updating-images
             */
            imagePullPolicy?: string | null
            /**
             * Lifecycle describes actions that the management system should take in response to container lifecycle events. For the PostStart and PreStop lifecycle handlers, management of the container blocks until the action is complete, unless the container process fails, in which case the handler is aborted.
             */
            lifecycle?: {
              /**
               * LifecycleHandler defines a specific action that should be taken in a lifecycle hook. One and only one of the fields, except TCPSocket must be specified.
               */
              postStart?: {
                /**
                 * ExecAction describes a "run in container" action.
                 */
                exec?: {
                  /**
                   * Command is the command line to execute inside the container, the working directory for the command  is root ('/') in the container's filesystem. The command is simply exec'd, it is not run inside a shell, so traditional shell instructions ('|', etc) won't work. To use a shell, you need to explicitly call out to that shell. Exit status of 0 is treated as live/healthy and non-zero is unhealthy.
                   */
                  command?: (string | null)[] | null
                } | null
                /**
                 * HTTPGetAction describes an action based on HTTP Get requests.
                 */
                httpGet?: {
                  /**
                   * Host name to connect to, defaults to the pod IP. You probably want to set "Host" in httpHeaders instead.
                   */
                  host?: string | null
                  /**
                   * Custom headers to set in the request. HTTP allows repeated headers.
                   */
                  httpHeaders?:
                    | ({
                        /**
                         * The header field name. This will be canonicalized upon output, so case-variant names will be understood as the same header.
                         */
                        name: string
                        /**
                         * The header field value
                         */
                        value: string
                      } | null)[]
                    | null
                  /**
                   * Path to access on the HTTP server.
                   */
                  path?: string | null
                  port: (string | null) | (number | null)
                  /**
                   * Scheme to use for connecting to the host. Defaults to HTTP.
                   */
                  scheme?: string | null
                } | null
                /**
                 * SleepAction describes a "sleep" action.
                 */
                sleep?: {
                  /**
                   * Seconds is the number of seconds to sleep.
                   */
                  seconds: number
                } | null
                /**
                 * TCPSocketAction describes an action based on opening a socket
                 */
                tcpSocket?: {
                  /**
                   * Optional: Host name to connect to, defaults to the pod IP.
                   */
                  host?: string | null
                  port: (string | null) | (number | null)
                } | null
              } | null
              /**
               * LifecycleHandler defines a specific action that should be taken in a lifecycle hook. One and only one of the fields, except TCPSocket must be specified.
               */
              preStop?: {
                /**
                 * ExecAction describes a "run in container" action.
                 */
                exec?: {
                  /**
                   * Command is the command line to execute inside the container, the working directory for the command  is root ('/') in the container's filesystem. The command is simply exec'd, it is not run inside a shell, so traditional shell instructions ('|', etc) won't work. To use a shell, you need to explicitly call out to that shell. Exit status of 0 is treated as live/healthy and non-zero is unhealthy.
                   */
                  command?: (string | null)[] | null
                } | null
                /**
                 * HTTPGetAction describes an action based on HTTP Get requests.
                 */
                httpGet?: {
                  /**
                   * Host name to connect to, defaults to the pod IP. You probably want to set "Host" in httpHeaders instead.
                   */
                  host?: string | null
                  /**
                   * Custom headers to set in the request. HTTP allows repeated headers.
                   */
                  httpHeaders?:
                    | ({
                        /**
                         * The header field name. This will be canonicalized upon output, so case-variant names will be understood as the same header.
                         */
                        name: string
                        /**
                         * The header field value
                         */
                        value: string
                      } | null)[]
                    | null
                  /**
                   * Path to access on the HTTP server.
                   */
                  path?: string | null
                  port: (string | null) | (number | null)
                  /**
                   * Scheme to use for connecting to the host. Defaults to HTTP.
                   */
                  scheme?: string | null
                } | null
                /**
                 * SleepAction describes a "sleep" action.
                 */
                sleep?: {
                  /**
                   * Seconds is the number of seconds to sleep.
                   */
                  seconds: number
                } | null
                /**
                 * TCPSocketAction describes an action based on opening a socket
                 */
                tcpSocket?: {
                  /**
                   * Optional: Host name to connect to, defaults to the pod IP.
                   */
                  host?: string | null
                  port: (string | null) | (number | null)
                } | null
              } | null
            } | null
            /**
             * Probe describes a health check to be performed against a container to determine whether it is alive or ready to receive traffic.
             */
            livenessProbe?: {
              /**
               * ExecAction describes a "run in container" action.
               */
              exec?: {
                /**
                 * Command is the command line to execute inside the container, the working directory for the command  is root ('/') in the container's filesystem. The command is simply exec'd, it is not run inside a shell, so traditional shell instructions ('|', etc) won't work. To use a shell, you need to explicitly call out to that shell. Exit status of 0 is treated as live/healthy and non-zero is unhealthy.
                 */
                command?: (string | null)[] | null
              } | null
              /**
               * Minimum consecutive failures for the probe to be considered failed after having succeeded. Defaults to 3. Minimum value is 1.
               */
              failureThreshold?: number | null
              grpc?: {
                /**
                 * Port number of the gRPC service. Number must be in the range 1 to 65535.
                 */
                port: number
                /**
                 * Service is the name of the service to place in the gRPC HealthCheckRequest (see https://github.com/grpc/grpc/blob/master/doc/health-checking.md).
                 *
                 * If this is not specified, the default behavior is defined by gRPC.
                 */
                service?: string | null
              } | null
              /**
               * HTTPGetAction describes an action based on HTTP Get requests.
               */
              httpGet?: {
                /**
                 * Host name to connect to, defaults to the pod IP. You probably want to set "Host" in httpHeaders instead.
                 */
                host?: string | null
                /**
                 * Custom headers to set in the request. HTTP allows repeated headers.
                 */
                httpHeaders?:
                  | ({
                      /**
                       * The header field name. This will be canonicalized upon output, so case-variant names will be understood as the same header.
                       */
                      name: string
                      /**
                       * The header field value
                       */
                      value: string
                    } | null)[]
                  | null
                /**
                 * Path to access on the HTTP server.
                 */
                path?: string | null
                port: (string | null) | (number | null)
                /**
                 * Scheme to use for connecting to the host. Defaults to HTTP.
                 */
                scheme?: string | null
              } | null
              /**
               * Number of seconds after the container has started before liveness probes are initiated. More info: https://kubernetes.io/docs/concepts/workloads/pods/pod-lifecycle#container-probes
               */
              initialDelaySeconds?: number | null
              /**
               * How often (in seconds) to perform the probe. Default to 10 seconds. Minimum value is 1.
               */
              periodSeconds?: number | null
              /**
               * Minimum consecutive successes for the probe to be considered successful after having failed. Defaults to 1. Must be 1 for liveness and startup. Minimum value is 1.
               */
              successThreshold?: number | null
              /**
               * TCPSocketAction describes an action based on opening a socket
               */
              tcpSocket?: {
                /**
                 * Optional: Host name to connect to, defaults to the pod IP.
                 */
                host?: string | null
                port: (string | null) | (number | null)
              } | null
              /**
               * Optional duration in seconds the pod needs to terminate gracefully upon probe failure. The grace period is the duration in seconds after the processes running in the pod are sent a termination signal and the time when the processes are forcibly halted with a kill signal. Set this value longer than the expected cleanup time for your process. If this value is nil, the pod's terminationGracePeriodSeconds will be used. Otherwise, this value overrides the value provided by the pod spec. Value must be non-negative integer. The value zero indicates stop immediately via the kill signal (no opportunity to shut down). This is a beta field and requires enabling ProbeTerminationGracePeriod feature gate. Minimum value is 1. spec.terminationGracePeriodSeconds is used if unset.
               */
              terminationGracePeriodSeconds?: number | null
              /**
               * Number of seconds after which the probe times out. Defaults to 1 second. Minimum value is 1. More info: https://kubernetes.io/docs/concepts/workloads/pods/pod-lifecycle#container-probes
               */
              timeoutSeconds?: number | null
            } | null
            /**
             * Name of the ephemeral container specified as a DNS_LABEL. This name must be unique among all containers, init containers and ephemeral containers.
             */
            name: string
            /**
             * Ports are not allowed for ephemeral containers.
             */
            ports?:
              | ({
                  /**
                   * Number of port to expose on the pod's IP address. This must be a valid port number, 0 < x < 65536.
                   */
                  containerPort: number
                  /**
                   * What host IP to bind the external port to.
                   */
                  hostIP?: string | null
                  /**
                   * Number of port to expose on the host. If specified, this must be a valid port number, 0 < x < 65536. If HostNetwork is specified, this must match ContainerPort. Most containers do not need this.
                   */
                  hostPort?: number | null
                  /**
                   * If specified, this must be an IANA_SVC_NAME and unique within the pod. Each named port in a pod must have a unique name. Name for the port that can be referred to by services.
                   */
                  name?: string | null
                  /**
                   * Protocol for port. Must be UDP, TCP, or SCTP. Defaults to "TCP".
                   */
                  protocol?: string | null
                } | null)[]
              | null
            /**
             * Probe describes a health check to be performed against a container to determine whether it is alive or ready to receive traffic.
             */
            readinessProbe?: {
              /**
               * ExecAction describes a "run in container" action.
               */
              exec?: {
                /**
                 * Command is the command line to execute inside the container, the working directory for the command  is root ('/') in the container's filesystem. The command is simply exec'd, it is not run inside a shell, so traditional shell instructions ('|', etc) won't work. To use a shell, you need to explicitly call out to that shell. Exit status of 0 is treated as live/healthy and non-zero is unhealthy.
                 */
                command?: (string | null)[] | null
              } | null
              /**
               * Minimum consecutive failures for the probe to be considered failed after having succeeded. Defaults to 3. Minimum value is 1.
               */
              failureThreshold?: number | null
              grpc?: {
                /**
                 * Port number of the gRPC service. Number must be in the range 1 to 65535.
                 */
                port: number
                /**
                 * Service is the name of the service to place in the gRPC HealthCheckRequest (see https://github.com/grpc/grpc/blob/master/doc/health-checking.md).
                 *
                 * If this is not specified, the default behavior is defined by gRPC.
                 */
                service?: string | null
              } | null
              /**
               * HTTPGetAction describes an action based on HTTP Get requests.
               */
              httpGet?: {
                /**
                 * Host name to connect to, defaults to the pod IP. You probably want to set "Host" in httpHeaders instead.
                 */
                host?: string | null
                /**
                 * Custom headers to set in the request. HTTP allows repeated headers.
                 */
                httpHeaders?:
                  | ({
                      /**
                       * The header field name. This will be canonicalized upon output, so case-variant names will be understood as the same header.
                       */
                      name: string
                      /**
                       * The header field value
                       */
                      value: string
                    } | null)[]
                  | null
                /**
                 * Path to access on the HTTP server.
                 */
                path?: string | null
                port: (string | null) | (number | null)
                /**
                 * Scheme to use for connecting to the host. Defaults to HTTP.
                 */
                scheme?: string | null
              } | null
              /**
               * Number of seconds after the container has started before liveness probes are initiated. More info: https://kubernetes.io/docs/concepts/workloads/pods/pod-lifecycle#container-probes
               */
              initialDelaySeconds?: number | null
              /**
               * How often (in seconds) to perform the probe. Default to 10 seconds. Minimum value is 1.
               */
              periodSeconds?: number | null
              /**
               * Minimum consecutive successes for the probe to be considered successful after having failed. Defaults to 1. Must be 1 for liveness and startup. Minimum value is 1.
               */
              successThreshold?: number | null
              /**
               * TCPSocketAction describes an action based on opening a socket
               */
              tcpSocket?: {
                /**
                 * Optional: Host name to connect to, defaults to the pod IP.
                 */
                host?: string | null
                port: (string | null) | (number | null)
              } | null
              /**
               * Optional duration in seconds the pod needs to terminate gracefully upon probe failure. The grace period is the duration in seconds after the processes running in the pod are sent a termination signal and the time when the processes are forcibly halted with a kill signal. Set this value longer than the expected cleanup time for your process. If this value is nil, the pod's terminationGracePeriodSeconds will be used. Otherwise, this value overrides the value provided by the pod spec. Value must be non-negative integer. The value zero indicates stop immediately via the kill signal (no opportunity to shut down). This is a beta field and requires enabling ProbeTerminationGracePeriod feature gate. Minimum value is 1. spec.terminationGracePeriodSeconds is used if unset.
               */
              terminationGracePeriodSeconds?: number | null
              /**
               * Number of seconds after which the probe times out. Defaults to 1 second. Minimum value is 1. More info: https://kubernetes.io/docs/concepts/workloads/pods/pod-lifecycle#container-probes
               */
              timeoutSeconds?: number | null
            } | null
            /**
             * Resources resize policy for the container.
             */
            resizePolicy?:
              | ({
                  /**
                   * Name of the resource to which this resource resize policy applies. Supported values: cpu, memory.
                   */
                  resourceName: string
                  /**
                   * Restart policy to apply when specified resource is resized. If not specified, it defaults to NotRequired.
                   */
                  restartPolicy: string
                } | null)[]
              | null
            /**
             * ResourceRequirements describes the compute resource requirements.
             */
            resources?: {
              /**
               * Claims lists the names of resources, defined in spec.resourceClaims, that are used by this container.
               *
               * This is an alpha field and requires enabling the DynamicResourceAllocation feature gate.
               *
               * This field is immutable. It can only be set for containers.
               */
              claims?:
                | ({
                    /**
                     * Name must match the name of one entry in pod.spec.resourceClaims of the Pod where this field is used. It makes that resource available inside a container.
                     */
                    name: string
                  } | null)[]
                | null
              /**
               * Limits describes the maximum amount of compute resources allowed. More info: https://kubernetes.io/docs/concepts/configuration/manage-resources-containers/
               */
              limits?: {
                [k: string]: (string | null) | (number | null)
              } | null
              /**
               * Requests describes the minimum amount of compute resources required. If Requests is omitted for a container, it defaults to Limits if that is explicitly specified, otherwise to an implementation-defined value. Requests cannot exceed Limits. More info: https://kubernetes.io/docs/concepts/configuration/manage-resources-containers/
               */
              requests?: {
                [k: string]: (string | null) | (number | null)
              } | null
            } | null
            /**
             * Restart policy for the container to manage the restart behavior of each container within a pod. This may only be set for init containers. You cannot set this field on ephemeral containers.
             */
            restartPolicy?: string | null
            /**
             * SecurityContext holds security configuration that will be applied to a container. Some fields are present in both SecurityContext and PodSecurityContext.  When both are set, the values in SecurityContext take precedence.
             */
            securityContext?: {
              /**
               * AllowPrivilegeEscalation controls whether a process can gain more privileges than its parent process. This bool directly controls if the no_new_privs flag will be set on the container process. AllowPrivilegeEscalation is true always when the container is: 1) run as Privileged 2) has CAP_SYS_ADMIN Note that this field cannot be set when spec.os.name is windows.
               */
              allowPrivilegeEscalation?: boolean | null
              /**
               * Adds and removes POSIX capabilities from running containers.
               */
              capabilities?: {
                /**
                 * Added capabilities
                 */
                add?: (string | null)[] | null
                /**
                 * Removed capabilities
                 */
                drop?: (string | null)[] | null
              } | null
              /**
               * Run container in privileged mode. Processes in privileged containers are essentially equivalent to root on the host. Defaults to false. Note that this field cannot be set when spec.os.name is windows.
               */
              privileged?: boolean | null
              /**
               * procMount denotes the type of proc mount to use for the containers. The default is DefaultProcMount which uses the container runtime defaults for readonly paths and masked paths. This requires the ProcMountType feature flag to be enabled. Note that this field cannot be set when spec.os.name is windows.
               */
              procMount?: string | null
              /**
               * Whether this container has a read-only root filesystem. Default is false. Note that this field cannot be set when spec.os.name is windows.
               */
              readOnlyRootFilesystem?: boolean | null
              /**
               * The GID to run the entrypoint of the container process. Uses runtime default if unset. May also be set in PodSecurityContext.  If set in both SecurityContext and PodSecurityContext, the value specified in SecurityContext takes precedence. Note that this field cannot be set when spec.os.name is windows.
               */
              runAsGroup?: number | null
              /**
               * Indicates that the container must run as a non-root user. If true, the Kubelet will validate the image at runtime to ensure that it does not run as UID 0 (root) and fail to start the container if it does. If unset or false, no such validation will be performed. May also be set in PodSecurityContext.  If set in both SecurityContext and PodSecurityContext, the value specified in SecurityContext takes precedence.
               */
              runAsNonRoot?: boolean | null
              /**
               * The UID to run the entrypoint of the container process. Defaults to user specified in image metadata if unspecified. May also be set in PodSecurityContext.  If set in both SecurityContext and PodSecurityContext, the value specified in SecurityContext takes precedence. Note that this field cannot be set when spec.os.name is windows.
               */
              runAsUser?: number | null
              /**
               * SELinuxOptions are the labels to be applied to the container
               */
              seLinuxOptions?: {
                /**
                 * Level is SELinux level label that applies to the container.
                 */
                level?: string | null
                /**
                 * Role is a SELinux role label that applies to the container.
                 */
                role?: string | null
                /**
                 * Type is a SELinux type label that applies to the container.
                 */
                type?: string | null
                /**
                 * User is a SELinux user label that applies to the container.
                 */
                user?: string | null
              } | null
              /**
               * SeccompProfile defines a pod/container's seccomp profile settings. Only one profile source may be set.
               */
              seccompProfile?: {
                /**
                 * localhostProfile indicates a profile defined in a file on the node should be used. The profile must be preconfigured on the node to work. Must be a descending path, relative to the kubelet's configured seccomp profile location. Must be set if type is "Localhost". Must NOT be set for any other type.
                 */
                localhostProfile?: string | null
                /**
                 * type indicates which kind of seccomp profile will be applied. Valid options are:
                 *
                 * Localhost - a profile defined in a file on the node should be used. RuntimeDefault - the container runtime default profile should be used. Unconfined - no profile should be applied.
                 */
                type: string
              } | null
              /**
               * WindowsSecurityContextOptions contain Windows-specific options and credentials.
               */
              windowsOptions?: {
                /**
                 * GMSACredentialSpec is where the GMSA admission webhook (https://github.com/kubernetes-sigs/windows-gmsa) inlines the contents of the GMSA credential spec named by the GMSACredentialSpecName field.
                 */
                gmsaCredentialSpec?: string | null
                /**
                 * GMSACredentialSpecName is the name of the GMSA credential spec to use.
                 */
                gmsaCredentialSpecName?: string | null
                /**
                 * HostProcess determines if a container should be run as a 'Host Process' container. All of a Pod's containers must have the same effective HostProcess value (it is not allowed to have a mix of HostProcess containers and non-HostProcess containers). In addition, if HostProcess is true then HostNetwork must also be set to true.
                 */
                hostProcess?: boolean | null
                /**
                 * The UserName in Windows to run the entrypoint of the container process. Defaults to the user specified in image metadata if unspecified. May also be set in PodSecurityContext. If set in both SecurityContext and PodSecurityContext, the value specified in SecurityContext takes precedence.
                 */
                runAsUserName?: string | null
              } | null
            } | null
            /**
             * Probe describes a health check to be performed against a container to determine whether it is alive or ready to receive traffic.
             */
            startupProbe?: {
              /**
               * ExecAction describes a "run in container" action.
               */
              exec?: {
                /**
                 * Command is the command line to execute inside the container, the working directory for the command  is root ('/') in the container's filesystem. The command is simply exec'd, it is not run inside a shell, so traditional shell instructions ('|', etc) won't work. To use a shell, you need to explicitly call out to that shell. Exit status of 0 is treated as live/healthy and non-zero is unhealthy.
                 */
                command?: (string | null)[] | null
              } | null
              /**
               * Minimum consecutive failures for the probe to be considered failed after having succeeded. Defaults to 3. Minimum value is 1.
               */
              failureThreshold?: number | null
              grpc?: {
                /**
                 * Port number of the gRPC service. Number must be in the range 1 to 65535.
                 */
                port: number
                /**
                 * Service is the name of the service to place in the gRPC HealthCheckRequest (see https://github.com/grpc/grpc/blob/master/doc/health-checking.md).
                 *
                 * If this is not specified, the default behavior is defined by gRPC.
                 */
                service?: string | null
              } | null
              /**
               * HTTPGetAction describes an action based on HTTP Get requests.
               */
              httpGet?: {
                /**
                 * Host name to connect to, defaults to the pod IP. You probably want to set "Host" in httpHeaders instead.
                 */
                host?: string | null
                /**
                 * Custom headers to set in the request. HTTP allows repeated headers.
                 */
                httpHeaders?:
                  | ({
                      /**
                       * The header field name. This will be canonicalized upon output, so case-variant names will be understood as the same header.
                       */
                      name: string
                      /**
                       * The header field value
                       */
                      value: string
                    } | null)[]
                  | null
                /**
                 * Path to access on the HTTP server.
                 */
                path?: string | null
                port: (string | null) | (number | null)
                /**
                 * Scheme to use for connecting to the host. Defaults to HTTP.
                 */
                scheme?: string | null
              } | null
              /**
               * Number of seconds after the container has started before liveness probes are initiated. More info: https://kubernetes.io/docs/concepts/workloads/pods/pod-lifecycle#container-probes
               */
              initialDelaySeconds?: number | null
              /**
               * How often (in seconds) to perform the probe. Default to 10 seconds. Minimum value is 1.
               */
              periodSeconds?: number | null
              /**
               * Minimum consecutive successes for the probe to be considered successful after having failed. Defaults to 1. Must be 1 for liveness and startup. Minimum value is 1.
               */
              successThreshold?: number | null
              /**
               * TCPSocketAction describes an action based on opening a socket
               */
              tcpSocket?: {
                /**
                 * Optional: Host name to connect to, defaults to the pod IP.
                 */
                host?: string | null
                port: (string | null) | (number | null)
              } | null
              /**
               * Optional duration in seconds the pod needs to terminate gracefully upon probe failure. The grace period is the duration in seconds after the processes running in the pod are sent a termination signal and the time when the processes are forcibly halted with a kill signal. Set this value longer than the expected cleanup time for your process. If this value is nil, the pod's terminationGracePeriodSeconds will be used. Otherwise, this value overrides the value provided by the pod spec. Value must be non-negative integer. The value zero indicates stop immediately via the kill signal (no opportunity to shut down). This is a beta field and requires enabling ProbeTerminationGracePeriod feature gate. Minimum value is 1. spec.terminationGracePeriodSeconds is used if unset.
               */
              terminationGracePeriodSeconds?: number | null
              /**
               * Number of seconds after which the probe times out. Defaults to 1 second. Minimum value is 1. More info: https://kubernetes.io/docs/concepts/workloads/pods/pod-lifecycle#container-probes
               */
              timeoutSeconds?: number | null
            } | null
            /**
             * Whether this container should allocate a buffer for stdin in the container runtime. If this is not set, reads from stdin in the container will always result in EOF. Default is false.
             */
            stdin?: boolean | null
            /**
             * Whether the container runtime should close the stdin channel after it has been opened by a single attach. When stdin is true the stdin stream will remain open across multiple attach sessions. If stdinOnce is set to true, stdin is opened on container start, is empty until the first client attaches to stdin, and then remains open and accepts data until the client disconnects, at which time stdin is closed and remains closed until the container is restarted. If this flag is false, a container processes that reads from stdin will never receive an EOF. Default is false
             */
            stdinOnce?: boolean | null
            /**
             * If set, the name of the container from PodSpec that this ephemeral container targets. The ephemeral container will be run in the namespaces (IPC, PID, etc) of this container. If not set then the ephemeral container uses the namespaces configured in the Pod spec.
             *
             * The container runtime must implement support for this feature. If the runtime does not support namespace targeting then the result of setting this field is undefined.
             */
            targetContainerName?: string | null
            /**
             * Optional: Path at which the file to which the container's termination message will be written is mounted into the container's filesystem. Message written is intended to be brief final status, such as an assertion failure message. Will be truncated by the node if greater than 4096 bytes. The total message length across all containers will be limited to 12kb. Defaults to /dev/termination-log. Cannot be updated.
             */
            terminationMessagePath?: string | null
            /**
             * Indicate how the termination message should be populated. File will use the contents of terminationMessagePath to populate the container status message on both success and failure. FallbackToLogsOnError will use the last chunk of container log output if the termination message file is empty and the container exited with an error. The log output is limited to 2048 bytes or 80 lines, whichever is smaller. Defaults to File. Cannot be updated.
             */
            terminationMessagePolicy?: string | null
            /**
             * Whether this container should allocate a TTY for itself, also requires 'stdin' to be true. Default is false.
             */
            tty?: boolean | null
            /**
             * volumeDevices is the list of block devices to be used by the container.
             */
            volumeDevices?:
              | ({
                  /**
                   * devicePath is the path inside of the container that the device will be mapped to.
                   */
                  devicePath: string
                  /**
                   * name must match the name of a persistentVolumeClaim in the pod
                   */
                  name: string
                } | null)[]
              | null
            /**
             * Pod volumes to mount into the container's filesystem. Subpath mounts are not allowed for ephemeral containers. Cannot be updated.
             */
            volumeMounts?:
              | ({
                  /**
                   * Path within the container at which the volume should be mounted.  Must not contain ':'.
                   */
                  mountPath: string
                  /**
                   * mountPropagation determines how mounts are propagated from the host to container and the other way around. When not set, MountPropagationNone is used. This field is beta in 1.10.
                   */
                  mountPropagation?: string | null
                  /**
                   * This must match the Name of a Volume.
                   */
                  name: string
                  /**
                   * Mounted read-only if true, read-write otherwise (false or unspecified). Defaults to false.
                   */
                  readOnly?: boolean | null
                  /**
                   * Path within the volume from which the container's volume should be mounted. Defaults to "" (volume's root).
                   */
                  subPath?: string | null
                  /**
                   * Expanded path within the volume from which the container's volume should be mounted. Behaves similarly to SubPath but environment variable references $(VAR_NAME) are expanded using the container's environment. Defaults to "" (volume's root). SubPathExpr and SubPath are mutually exclusive.
                   */
                  subPathExpr?: string | null
                } | null)[]
              | null
            /**
             * Container's working directory. If not specified, the container runtime's default will be used, which might be configured in the container image. Cannot be updated.
             */
            workingDir?: string | null
          } | null)[]
        | null
      /**
       * HostAliases is an optional list of hosts and IPs that will be injected into the pod's hosts file if specified. This is only valid for non-hostNetwork pods.
       */
      hostAliases?:
        | ({
            /**
             * Hostnames for the above IP address.
             */
            hostnames?: (string | null)[] | null
            /**
             * IP address of the host file entry.
             */
            ip?: string | null
          } | null)[]
        | null
      /**
       * Use the host's ipc namespace. Optional: Default to false.
       */
      hostIPC?: boolean | null
      /**
       * Host networking requested for this pod. Use the host's network namespace. If this option is set, the ports that will be used must be specified. Default to false.
       */
      hostNetwork?: boolean | null
      /**
       * Use the host's pid namespace. Optional: Default to false.
       */
      hostPID?: boolean | null
      /**
       * Use the host's user namespace. Optional: Default to true. If set to true or not present, the pod will be run in the host user namespace, useful for when the pod needs a feature only available to the host user namespace, such as loading a kernel module with CAP_SYS_MODULE. When set to false, a new userns is created for the pod. Setting false is useful for mitigating container breakout vulnerabilities even allowing users to run their containers as root without actually having root privileges on the host. This field is alpha-level and is only honored by servers that enable the UserNamespacesSupport feature.
       */
      hostUsers?: boolean | null
      /**
       * Specifies the hostname of the Pod If not specified, the pod's hostname will be set to a system-defined value.
       */
      hostname?: string | null
      /**
       * ImagePullSecrets is an optional list of references to secrets in the same namespace to use for pulling any of the images used by this PodSpec. If specified, these secrets will be passed to individual puller implementations for them to use. More info: https://kubernetes.io/docs/concepts/containers/images#specifying-imagepullsecrets-on-a-pod
       */
      imagePullSecrets?:
        | ({
            /**
             * Name of the referent. More info: https://kubernetes.io/docs/concepts/overview/working-with-objects/names/#names
             */
            name?: string | null
          } | null)[]
        | null
      /**
       * List of initialization containers belonging to the pod. Init containers are executed in order prior to containers being started. If any init container fails, the pod is considered to have failed and is handled according to its restartPolicy. The name for an init container or normal container must be unique among all containers. Init containers may not have Lifecycle actions, Readiness probes, Liveness probes, or Startup probes. The resourceRequirements of an init container are taken into account during scheduling by finding the highest request/limit for each resource type, and then using the max of of that value or the sum of the normal containers. Limits are applied to init containers in a similar fashion. Init containers cannot currently be added or removed. Cannot be updated. More info: https://kubernetes.io/docs/concepts/workloads/pods/init-containers/
       */
      initContainers?:
        | ({
            /**
             * Arguments to the entrypoint. The container image's CMD is used if this is not provided. Variable references $(VAR_NAME) are expanded using the container's environment. If a variable cannot be resolved, the reference in the input string will be unchanged. Double $$ are reduced to a single $, which allows for escaping the $(VAR_NAME) syntax: i.e. "$$(VAR_NAME)" will produce the string literal "$(VAR_NAME)". Escaped references will never be expanded, regardless of whether the variable exists or not. Cannot be updated. More info: https://kubernetes.io/docs/tasks/inject-data-application/define-command-argument-container/#running-a-command-in-a-shell
             */
            args?: (string | null)[] | null
            /**
             * Entrypoint array. Not executed within a shell. The container image's ENTRYPOINT is used if this is not provided. Variable references $(VAR_NAME) are expanded using the container's environment. If a variable cannot be resolved, the reference in the input string will be unchanged. Double $$ are reduced to a single $, which allows for escaping the $(VAR_NAME) syntax: i.e. "$$(VAR_NAME)" will produce the string literal "$(VAR_NAME)". Escaped references will never be expanded, regardless of whether the variable exists or not. Cannot be updated. More info: https://kubernetes.io/docs/tasks/inject-data-application/define-command-argument-container/#running-a-command-in-a-shell
             */
            command?: (string | null)[] | null
            /**
             * List of environment variables to set in the container. Cannot be updated.
             */
            env?:
              | ({
                  /**
                   * Name of the environment variable. Must be a C_IDENTIFIER.
                   */
                  name: string
                  /**
                   * Variable references $(VAR_NAME) are expanded using the previously defined environment variables in the container and any service environment variables. If a variable cannot be resolved, the reference in the input string will be unchanged. Double $$ are reduced to a single $, which allows for escaping the $(VAR_NAME) syntax: i.e. "$$(VAR_NAME)" will produce the string literal "$(VAR_NAME)". Escaped references will never be expanded, regardless of whether the variable exists or not. Defaults to "".
                   */
                  value?: string | null
                  /**
                   * EnvVarSource represents a source for the value of an EnvVar.
                   */
                  valueFrom?: {
                    /**
                     * Selects a key from a ConfigMap.
                     */
                    configMapKeyRef?: {
                      /**
                       * The key to select.
                       */
                      key: string
                      /**
                       * Name of the referent. More info: https://kubernetes.io/docs/concepts/overview/working-with-objects/names/#names
                       */
                      name?: string | null
                      /**
                       * Specify whether the ConfigMap or its key must be defined
                       */
                      optional?: boolean | null
                    } | null
                    /**
                     * ObjectFieldSelector selects an APIVersioned field of an object.
                     */
                    fieldRef?: {
                      /**
                       * Version of the schema the FieldPath is written in terms of, defaults to "v1".
                       */
                      apiVersion?: string | null
                      /**
                       * Path of the field to select in the specified API version.
                       */
                      fieldPath: string
                    } | null
                    /**
                     * ResourceFieldSelector represents container resources (cpu, memory) and their output format
                     */
                    resourceFieldRef?: {
                      /**
                       * Container name: required for volumes, optional for env vars
                       */
                      containerName?: string | null
                      divisor?: (string | null) | (number | null)
                      /**
                       * Required: resource to select
                       */
                      resource: string
                    } | null
                    /**
                     * SecretKeySelector selects a key of a Secret.
                     */
                    secretKeyRef?: {
                      /**
                       * The key of the secret to select from.  Must be a valid secret key.
                       */
                      key: string
                      /**
                       * Name of the referent. More info: https://kubernetes.io/docs/concepts/overview/working-with-objects/names/#names
                       */
                      name?: string | null
                      /**
                       * Specify whether the Secret or its key must be defined
                       */
                      optional?: boolean | null
                    } | null
                  } | null
                } | null)[]
              | null
            /**
             * List of sources to populate environment variables in the container. The keys defined within a source must be a C_IDENTIFIER. All invalid keys will be reported as an event when the container is starting. When a key exists in multiple sources, the value associated with the last source will take precedence. Values defined by an Env with a duplicate key will take precedence. Cannot be updated.
             */
            envFrom?:
              | ({
                  /**
                   * ConfigMapEnvSource selects a ConfigMap to populate the environment variables with.
                   *
                   * The contents of the target ConfigMap's Data field will represent the key-value pairs as environment variables.
                   */
                  configMapRef?: {
                    /**
                     * Name of the referent. More info: https://kubernetes.io/docs/concepts/overview/working-with-objects/names/#names
                     */
                    name?: string | null
                    /**
                     * Specify whether the ConfigMap must be defined
                     */
                    optional?: boolean | null
                  } | null
                  /**
                   * An optional identifier to prepend to each key in the ConfigMap. Must be a C_IDENTIFIER.
                   */
                  prefix?: string | null
                  /**
                   * SecretEnvSource selects a Secret to populate the environment variables with.
                   *
                   * The contents of the target Secret's Data field will represent the key-value pairs as environment variables.
                   */
                  secretRef?: {
                    /**
                     * Name of the referent. More info: https://kubernetes.io/docs/concepts/overview/working-with-objects/names/#names
                     */
                    name?: string | null
                    /**
                     * Specify whether the Secret must be defined
                     */
                    optional?: boolean | null
                  } | null
                } | null)[]
              | null
            /**
             * Container image name. More info: https://kubernetes.io/docs/concepts/containers/images This field is optional to allow higher level config management to default or override container images in workload controllers like Deployments and StatefulSets.
             */
            image?: string | null
            /**
             * Image pull policy. One of Always, Never, IfNotPresent. Defaults to Always if :latest tag is specified, or IfNotPresent otherwise. Cannot be updated. More info: https://kubernetes.io/docs/concepts/containers/images#updating-images
             */
            imagePullPolicy?: string | null
            /**
             * Lifecycle describes actions that the management system should take in response to container lifecycle events. For the PostStart and PreStop lifecycle handlers, management of the container blocks until the action is complete, unless the container process fails, in which case the handler is aborted.
             */
            lifecycle?: {
              /**
               * LifecycleHandler defines a specific action that should be taken in a lifecycle hook. One and only one of the fields, except TCPSocket must be specified.
               */
              postStart?: {
                /**
                 * ExecAction describes a "run in container" action.
                 */
                exec?: {
                  /**
                   * Command is the command line to execute inside the container, the working directory for the command  is root ('/') in the container's filesystem. The command is simply exec'd, it is not run inside a shell, so traditional shell instructions ('|', etc) won't work. To use a shell, you need to explicitly call out to that shell. Exit status of 0 is treated as live/healthy and non-zero is unhealthy.
                   */
                  command?: (string | null)[] | null
                } | null
                /**
                 * HTTPGetAction describes an action based on HTTP Get requests.
                 */
                httpGet?: {
                  /**
                   * Host name to connect to, defaults to the pod IP. You probably want to set "Host" in httpHeaders instead.
                   */
                  host?: string | null
                  /**
                   * Custom headers to set in the request. HTTP allows repeated headers.
                   */
                  httpHeaders?:
                    | ({
                        /**
                         * The header field name. This will be canonicalized upon output, so case-variant names will be understood as the same header.
                         */
                        name: string
                        /**
                         * The header field value
                         */
                        value: string
                      } | null)[]
                    | null
                  /**
                   * Path to access on the HTTP server.
                   */
                  path?: string | null
                  port: (string | null) | (number | null)
                  /**
                   * Scheme to use for connecting to the host. Defaults to HTTP.
                   */
                  scheme?: string | null
                } | null
                /**
                 * SleepAction describes a "sleep" action.
                 */
                sleep?: {
                  /**
                   * Seconds is the number of seconds to sleep.
                   */
                  seconds: number
                } | null
                /**
                 * TCPSocketAction describes an action based on opening a socket
                 */
                tcpSocket?: {
                  /**
                   * Optional: Host name to connect to, defaults to the pod IP.
                   */
                  host?: string | null
                  port: (string | null) | (number | null)
                } | null
              } | null
              /**
               * LifecycleHandler defines a specific action that should be taken in a lifecycle hook. One and only one of the fields, except TCPSocket must be specified.
               */
              preStop?: {
                /**
                 * ExecAction describes a "run in container" action.
                 */
                exec?: {
                  /**
                   * Command is the command line to execute inside the container, the working directory for the command  is root ('/') in the container's filesystem. The command is simply exec'd, it is not run inside a shell, so traditional shell instructions ('|', etc) won't work. To use a shell, you need to explicitly call out to that shell. Exit status of 0 is treated as live/healthy and non-zero is unhealthy.
                   */
                  command?: (string | null)[] | null
                } | null
                /**
                 * HTTPGetAction describes an action based on HTTP Get requests.
                 */
                httpGet?: {
                  /**
                   * Host name to connect to, defaults to the pod IP. You probably want to set "Host" in httpHeaders instead.
                   */
                  host?: string | null
                  /**
                   * Custom headers to set in the request. HTTP allows repeated headers.
                   */
                  httpHeaders?:
                    | ({
                        /**
                         * The header field name. This will be canonicalized upon output, so case-variant names will be understood as the same header.
                         */
                        name: string
                        /**
                         * The header field value
                         */
                        value: string
                      } | null)[]
                    | null
                  /**
                   * Path to access on the HTTP server.
                   */
                  path?: string | null
                  port: (string | null) | (number | null)
                  /**
                   * Scheme to use for connecting to the host. Defaults to HTTP.
                   */
                  scheme?: string | null
                } | null
                /**
                 * SleepAction describes a "sleep" action.
                 */
                sleep?: {
                  /**
                   * Seconds is the number of seconds to sleep.
                   */
                  seconds: number
                } | null
                /**
                 * TCPSocketAction describes an action based on opening a socket
                 */
                tcpSocket?: {
                  /**
                   * Optional: Host name to connect to, defaults to the pod IP.
                   */
                  host?: string | null
                  port: (string | null) | (number | null)
                } | null
              } | null
            } | null
            /**
             * Probe describes a health check to be performed against a container to determine whether it is alive or ready to receive traffic.
             */
            livenessProbe?: {
              /**
               * ExecAction describes a "run in container" action.
               */
              exec?: {
                /**
                 * Command is the command line to execute inside the container, the working directory for the command  is root ('/') in the container's filesystem. The command is simply exec'd, it is not run inside a shell, so traditional shell instructions ('|', etc) won't work. To use a shell, you need to explicitly call out to that shell. Exit status of 0 is treated as live/healthy and non-zero is unhealthy.
                 */
                command?: (string | null)[] | null
              } | null
              /**
               * Minimum consecutive failures for the probe to be considered failed after having succeeded. Defaults to 3. Minimum value is 1.
               */
              failureThreshold?: number | null
              grpc?: {
                /**
                 * Port number of the gRPC service. Number must be in the range 1 to 65535.
                 */
                port: number
                /**
                 * Service is the name of the service to place in the gRPC HealthCheckRequest (see https://github.com/grpc/grpc/blob/master/doc/health-checking.md).
                 *
                 * If this is not specified, the default behavior is defined by gRPC.
                 */
                service?: string | null
              } | null
              /**
               * HTTPGetAction describes an action based on HTTP Get requests.
               */
              httpGet?: {
                /**
                 * Host name to connect to, defaults to the pod IP. You probably want to set "Host" in httpHeaders instead.
                 */
                host?: string | null
                /**
                 * Custom headers to set in the request. HTTP allows repeated headers.
                 */
                httpHeaders?:
                  | ({
                      /**
                       * The header field name. This will be canonicalized upon output, so case-variant names will be understood as the same header.
                       */
                      name: string
                      /**
                       * The header field value
                       */
                      value: string
                    } | null)[]
                  | null
                /**
                 * Path to access on the HTTP server.
                 */
                path?: string | null
                port: (string | null) | (number | null)
                /**
                 * Scheme to use for connecting to the host. Defaults to HTTP.
                 */
                scheme?: string | null
              } | null
              /**
               * Number of seconds after the container has started before liveness probes are initiated. More info: https://kubernetes.io/docs/concepts/workloads/pods/pod-lifecycle#container-probes
               */
              initialDelaySeconds?: number | null
              /**
               * How often (in seconds) to perform the probe. Default to 10 seconds. Minimum value is 1.
               */
              periodSeconds?: number | null
              /**
               * Minimum consecutive successes for the probe to be considered successful after having failed. Defaults to 1. Must be 1 for liveness and startup. Minimum value is 1.
               */
              successThreshold?: number | null
              /**
               * TCPSocketAction describes an action based on opening a socket
               */
              tcpSocket?: {
                /**
                 * Optional: Host name to connect to, defaults to the pod IP.
                 */
                host?: string | null
                port: (string | null) | (number | null)
              } | null
              /**
               * Optional duration in seconds the pod needs to terminate gracefully upon probe failure. The grace period is the duration in seconds after the processes running in the pod are sent a termination signal and the time when the processes are forcibly halted with a kill signal. Set this value longer than the expected cleanup time for your process. If this value is nil, the pod's terminationGracePeriodSeconds will be used. Otherwise, this value overrides the value provided by the pod spec. Value must be non-negative integer. The value zero indicates stop immediately via the kill signal (no opportunity to shut down). This is a beta field and requires enabling ProbeTerminationGracePeriod feature gate. Minimum value is 1. spec.terminationGracePeriodSeconds is used if unset.
               */
              terminationGracePeriodSeconds?: number | null
              /**
               * Number of seconds after which the probe times out. Defaults to 1 second. Minimum value is 1. More info: https://kubernetes.io/docs/concepts/workloads/pods/pod-lifecycle#container-probes
               */
              timeoutSeconds?: number | null
            } | null
            /**
             * Name of the container specified as a DNS_LABEL. Each container in a pod must have a unique name (DNS_LABEL). Cannot be updated.
             */
            name: string
            /**
             * List of ports to expose from the container. Not specifying a port here DOES NOT prevent that port from being exposed. Any port which is listening on the default "0.0.0.0" address inside a container will be accessible from the network. Modifying this array with strategic merge patch may corrupt the data. For more information See https://github.com/kubernetes/kubernetes/issues/108255. Cannot be updated.
             */
            ports?:
              | ({
                  /**
                   * Number of port to expose on the pod's IP address. This must be a valid port number, 0 < x < 65536.
                   */
                  containerPort: number
                  /**
                   * What host IP to bind the external port to.
                   */
                  hostIP?: string | null
                  /**
                   * Number of port to expose on the host. If specified, this must be a valid port number, 0 < x < 65536. If HostNetwork is specified, this must match ContainerPort. Most containers do not need this.
                   */
                  hostPort?: number | null
                  /**
                   * If specified, this must be an IANA_SVC_NAME and unique within the pod. Each named port in a pod must have a unique name. Name for the port that can be referred to by services.
                   */
                  name?: string | null
                  /**
                   * Protocol for port. Must be UDP, TCP, or SCTP. Defaults to "TCP".
                   */
                  protocol?: string | null
                } | null)[]
              | null
            /**
             * Probe describes a health check to be performed against a container to determine whether it is alive or ready to receive traffic.
             */
            readinessProbe?: {
              /**
               * ExecAction describes a "run in container" action.
               */
              exec?: {
                /**
                 * Command is the command line to execute inside the container, the working directory for the command  is root ('/') in the container's filesystem. The command is simply exec'd, it is not run inside a shell, so traditional shell instructions ('|', etc) won't work. To use a shell, you need to explicitly call out to that shell. Exit status of 0 is treated as live/healthy and non-zero is unhealthy.
                 */
                command?: (string | null)[] | null
              } | null
              /**
               * Minimum consecutive failures for the probe to be considered failed after having succeeded. Defaults to 3. Minimum value is 1.
               */
              failureThreshold?: number | null
              grpc?: {
                /**
                 * Port number of the gRPC service. Number must be in the range 1 to 65535.
                 */
                port: number
                /**
                 * Service is the name of the service to place in the gRPC HealthCheckRequest (see https://github.com/grpc/grpc/blob/master/doc/health-checking.md).
                 *
                 * If this is not specified, the default behavior is defined by gRPC.
                 */
                service?: string | null
              } | null
              /**
               * HTTPGetAction describes an action based on HTTP Get requests.
               */
              httpGet?: {
                /**
                 * Host name to connect to, defaults to the pod IP. You probably want to set "Host" in httpHeaders instead.
                 */
                host?: string | null
                /**
                 * Custom headers to set in the request. HTTP allows repeated headers.
                 */
                httpHeaders?:
                  | ({
                      /**
                       * The header field name. This will be canonicalized upon output, so case-variant names will be understood as the same header.
                       */
                      name: string
                      /**
                       * The header field value
                       */
                      value: string
                    } | null)[]
                  | null
                /**
                 * Path to access on the HTTP server.
                 */
                path?: string | null
                port: (string | null) | (number | null)
                /**
                 * Scheme to use for connecting to the host. Defaults to HTTP.
                 */
                scheme?: string | null
              } | null
              /**
               * Number of seconds after the container has started before liveness probes are initiated. More info: https://kubernetes.io/docs/concepts/workloads/pods/pod-lifecycle#container-probes
               */
              initialDelaySeconds?: number | null
              /**
               * How often (in seconds) to perform the probe. Default to 10 seconds. Minimum value is 1.
               */
              periodSeconds?: number | null
              /**
               * Minimum consecutive successes for the probe to be considered successful after having failed. Defaults to 1. Must be 1 for liveness and startup. Minimum value is 1.
               */
              successThreshold?: number | null
              /**
               * TCPSocketAction describes an action based on opening a socket
               */
              tcpSocket?: {
                /**
                 * Optional: Host name to connect to, defaults to the pod IP.
                 */
                host?: string | null
                port: (string | null) | (number | null)
              } | null
              /**
               * Optional duration in seconds the pod needs to terminate gracefully upon probe failure. The grace period is the duration in seconds after the processes running in the pod are sent a termination signal and the time when the processes are forcibly halted with a kill signal. Set this value longer than the expected cleanup time for your process. If this value is nil, the pod's terminationGracePeriodSeconds will be used. Otherwise, this value overrides the value provided by the pod spec. Value must be non-negative integer. The value zero indicates stop immediately via the kill signal (no opportunity to shut down). This is a beta field and requires enabling ProbeTerminationGracePeriod feature gate. Minimum value is 1. spec.terminationGracePeriodSeconds is used if unset.
               */
              terminationGracePeriodSeconds?: number | null
              /**
               * Number of seconds after which the probe times out. Defaults to 1 second. Minimum value is 1. More info: https://kubernetes.io/docs/concepts/workloads/pods/pod-lifecycle#container-probes
               */
              timeoutSeconds?: number | null
            } | null
            /**
             * Resources resize policy for the container.
             */
            resizePolicy?:
              | ({
                  /**
                   * Name of the resource to which this resource resize policy applies. Supported values: cpu, memory.
                   */
                  resourceName: string
                  /**
                   * Restart policy to apply when specified resource is resized. If not specified, it defaults to NotRequired.
                   */
                  restartPolicy: string
                } | null)[]
              | null
            /**
             * ResourceRequirements describes the compute resource requirements.
             */
            resources?: {
              /**
               * Claims lists the names of resources, defined in spec.resourceClaims, that are used by this container.
               *
               * This is an alpha field and requires enabling the DynamicResourceAllocation feature gate.
               *
               * This field is immutable. It can only be set for containers.
               */
              claims?:
                | ({
                    /**
                     * Name must match the name of one entry in pod.spec.resourceClaims of the Pod where this field is used. It makes that resource available inside a container.
                     */
                    name: string
                  } | null)[]
                | null
              /**
               * Limits describes the maximum amount of compute resources allowed. More info: https://kubernetes.io/docs/concepts/configuration/manage-resources-containers/
               */
              limits?: {
                [k: string]: (string | null) | (number | null)
              } | null
              /**
               * Requests describes the minimum amount of compute resources required. If Requests is omitted for a container, it defaults to Limits if that is explicitly specified, otherwise to an implementation-defined value. Requests cannot exceed Limits. More info: https://kubernetes.io/docs/concepts/configuration/manage-resources-containers/
               */
              requests?: {
                [k: string]: (string | null) | (number | null)
              } | null
            } | null
            /**
             * RestartPolicy defines the restart behavior of individual containers in a pod. This field may only be set for init containers, and the only allowed value is "Always". For non-init containers or when this field is not specified, the restart behavior is defined by the Pod's restart policy and the container type. Setting the RestartPolicy as "Always" for the init container will have the following effect: this init container will be continually restarted on exit until all regular containers have terminated. Once all regular containers have completed, all init containers with restartPolicy "Always" will be shut down. This lifecycle differs from normal init containers and is often referred to as a "sidecar" container. Although this init container still starts in the init container sequence, it does not wait for the container to complete before proceeding to the next init container. Instead, the next init container starts immediately after this init container is started, or after any startupProbe has successfully completed.
             */
            restartPolicy?: string | null
            /**
             * SecurityContext holds security configuration that will be applied to a container. Some fields are present in both SecurityContext and PodSecurityContext.  When both are set, the values in SecurityContext take precedence.
             */
            securityContext?: {
              /**
               * AllowPrivilegeEscalation controls whether a process can gain more privileges than its parent process. This bool directly controls if the no_new_privs flag will be set on the container process. AllowPrivilegeEscalation is true always when the container is: 1) run as Privileged 2) has CAP_SYS_ADMIN Note that this field cannot be set when spec.os.name is windows.
               */
              allowPrivilegeEscalation?: boolean | null
              /**
               * Adds and removes POSIX capabilities from running containers.
               */
              capabilities?: {
                /**
                 * Added capabilities
                 */
                add?: (string | null)[] | null
                /**
                 * Removed capabilities
                 */
                drop?: (string | null)[] | null
              } | null
              /**
               * Run container in privileged mode. Processes in privileged containers are essentially equivalent to root on the host. Defaults to false. Note that this field cannot be set when spec.os.name is windows.
               */
              privileged?: boolean | null
              /**
               * procMount denotes the type of proc mount to use for the containers. The default is DefaultProcMount which uses the container runtime defaults for readonly paths and masked paths. This requires the ProcMountType feature flag to be enabled. Note that this field cannot be set when spec.os.name is windows.
               */
              procMount?: string | null
              /**
               * Whether this container has a read-only root filesystem. Default is false. Note that this field cannot be set when spec.os.name is windows.
               */
              readOnlyRootFilesystem?: boolean | null
              /**
               * The GID to run the entrypoint of the container process. Uses runtime default if unset. May also be set in PodSecurityContext.  If set in both SecurityContext and PodSecurityContext, the value specified in SecurityContext takes precedence. Note that this field cannot be set when spec.os.name is windows.
               */
              runAsGroup?: number | null
              /**
               * Indicates that the container must run as a non-root user. If true, the Kubelet will validate the image at runtime to ensure that it does not run as UID 0 (root) and fail to start the container if it does. If unset or false, no such validation will be performed. May also be set in PodSecurityContext.  If set in both SecurityContext and PodSecurityContext, the value specified in SecurityContext takes precedence.
               */
              runAsNonRoot?: boolean | null
              /**
               * The UID to run the entrypoint of the container process. Defaults to user specified in image metadata if unspecified. May also be set in PodSecurityContext.  If set in both SecurityContext and PodSecurityContext, the value specified in SecurityContext takes precedence. Note that this field cannot be set when spec.os.name is windows.
               */
              runAsUser?: number | null
              /**
               * SELinuxOptions are the labels to be applied to the container
               */
              seLinuxOptions?: {
                /**
                 * Level is SELinux level label that applies to the container.
                 */
                level?: string | null
                /**
                 * Role is a SELinux role label that applies to the container.
                 */
                role?: string | null
                /**
                 * Type is a SELinux type label that applies to the container.
                 */
                type?: string | null
                /**
                 * User is a SELinux user label that applies to the container.
                 */
                user?: string | null
              } | null
              /**
               * SeccompProfile defines a pod/container's seccomp profile settings. Only one profile source may be set.
               */
              seccompProfile?: {
                /**
                 * localhostProfile indicates a profile defined in a file on the node should be used. The profile must be preconfigured on the node to work. Must be a descending path, relative to the kubelet's configured seccomp profile location. Must be set if type is "Localhost". Must NOT be set for any other type.
                 */
                localhostProfile?: string | null
                /**
                 * type indicates which kind of seccomp profile will be applied. Valid options are:
                 *
                 * Localhost - a profile defined in a file on the node should be used. RuntimeDefault - the container runtime default profile should be used. Unconfined - no profile should be applied.
                 */
                type: string
              } | null
              /**
               * WindowsSecurityContextOptions contain Windows-specific options and credentials.
               */
              windowsOptions?: {
                /**
                 * GMSACredentialSpec is where the GMSA admission webhook (https://github.com/kubernetes-sigs/windows-gmsa) inlines the contents of the GMSA credential spec named by the GMSACredentialSpecName field.
                 */
                gmsaCredentialSpec?: string | null
                /**
                 * GMSACredentialSpecName is the name of the GMSA credential spec to use.
                 */
                gmsaCredentialSpecName?: string | null
                /**
                 * HostProcess determines if a container should be run as a 'Host Process' container. All of a Pod's containers must have the same effective HostProcess value (it is not allowed to have a mix of HostProcess containers and non-HostProcess containers). In addition, if HostProcess is true then HostNetwork must also be set to true.
                 */
                hostProcess?: boolean | null
                /**
                 * The UserName in Windows to run the entrypoint of the container process. Defaults to the user specified in image metadata if unspecified. May also be set in PodSecurityContext. If set in both SecurityContext and PodSecurityContext, the value specified in SecurityContext takes precedence.
                 */
                runAsUserName?: string | null
              } | null
            } | null
            /**
             * Probe describes a health check to be performed against a container to determine whether it is alive or ready to receive traffic.
             */
            startupProbe?: {
              /**
               * ExecAction describes a "run in container" action.
               */
              exec?: {
                /**
                 * Command is the command line to execute inside the container, the working directory for the command  is root ('/') in the container's filesystem. The command is simply exec'd, it is not run inside a shell, so traditional shell instructions ('|', etc) won't work. To use a shell, you need to explicitly call out to that shell. Exit status of 0 is treated as live/healthy and non-zero is unhealthy.
                 */
                command?: (string | null)[] | null
              } | null
              /**
               * Minimum consecutive failures for the probe to be considered failed after having succeeded. Defaults to 3. Minimum value is 1.
               */
              failureThreshold?: number | null
              grpc?: {
                /**
                 * Port number of the gRPC service. Number must be in the range 1 to 65535.
                 */
                port: number
                /**
                 * Service is the name of the service to place in the gRPC HealthCheckRequest (see https://github.com/grpc/grpc/blob/master/doc/health-checking.md).
                 *
                 * If this is not specified, the default behavior is defined by gRPC.
                 */
                service?: string | null
              } | null
              /**
               * HTTPGetAction describes an action based on HTTP Get requests.
               */
              httpGet?: {
                /**
                 * Host name to connect to, defaults to the pod IP. You probably want to set "Host" in httpHeaders instead.
                 */
                host?: string | null
                /**
                 * Custom headers to set in the request. HTTP allows repeated headers.
                 */
                httpHeaders?:
                  | ({
                      /**
                       * The header field name. This will be canonicalized upon output, so case-variant names will be understood as the same header.
                       */
                      name: string
                      /**
                       * The header field value
                       */
                      value: string
                    } | null)[]
                  | null
                /**
                 * Path to access on the HTTP server.
                 */
                path?: string | null
                port: (string | null) | (number | null)
                /**
                 * Scheme to use for connecting to the host. Defaults to HTTP.
                 */
                scheme?: string | null
              } | null
              /**
               * Number of seconds after the container has started before liveness probes are initiated. More info: https://kubernetes.io/docs/concepts/workloads/pods/pod-lifecycle#container-probes
               */
              initialDelaySeconds?: number | null
              /**
               * How often (in seconds) to perform the probe. Default to 10 seconds. Minimum value is 1.
               */
              periodSeconds?: number | null
              /**
               * Minimum consecutive successes for the probe to be considered successful after having failed. Defaults to 1. Must be 1 for liveness and startup. Minimum value is 1.
               */
              successThreshold?: number | null
              /**
               * TCPSocketAction describes an action based on opening a socket
               */
              tcpSocket?: {
                /**
                 * Optional: Host name to connect to, defaults to the pod IP.
                 */
                host?: string | null
                port: (string | null) | (number | null)
              } | null
              /**
               * Optional duration in seconds the pod needs to terminate gracefully upon probe failure. The grace period is the duration in seconds after the processes running in the pod are sent a termination signal and the time when the processes are forcibly halted with a kill signal. Set this value longer than the expected cleanup time for your process. If this value is nil, the pod's terminationGracePeriodSeconds will be used. Otherwise, this value overrides the value provided by the pod spec. Value must be non-negative integer. The value zero indicates stop immediately via the kill signal (no opportunity to shut down). This is a beta field and requires enabling ProbeTerminationGracePeriod feature gate. Minimum value is 1. spec.terminationGracePeriodSeconds is used if unset.
               */
              terminationGracePeriodSeconds?: number | null
              /**
               * Number of seconds after which the probe times out. Defaults to 1 second. Minimum value is 1. More info: https://kubernetes.io/docs/concepts/workloads/pods/pod-lifecycle#container-probes
               */
              timeoutSeconds?: number | null
            } | null
            /**
             * Whether this container should allocate a buffer for stdin in the container runtime. If this is not set, reads from stdin in the container will always result in EOF. Default is false.
             */
            stdin?: boolean | null
            /**
             * Whether the container runtime should close the stdin channel after it has been opened by a single attach. When stdin is true the stdin stream will remain open across multiple attach sessions. If stdinOnce is set to true, stdin is opened on container start, is empty until the first client attaches to stdin, and then remains open and accepts data until the client disconnects, at which time stdin is closed and remains closed until the container is restarted. If this flag is false, a container processes that reads from stdin will never receive an EOF. Default is false
             */
            stdinOnce?: boolean | null
            /**
             * Optional: Path at which the file to which the container's termination message will be written is mounted into the container's filesystem. Message written is intended to be brief final status, such as an assertion failure message. Will be truncated by the node if greater than 4096 bytes. The total message length across all containers will be limited to 12kb. Defaults to /dev/termination-log. Cannot be updated.
             */
            terminationMessagePath?: string | null
            /**
             * Indicate how the termination message should be populated. File will use the contents of terminationMessagePath to populate the container status message on both success and failure. FallbackToLogsOnError will use the last chunk of container log output if the termination message file is empty and the container exited with an error. The log output is limited to 2048 bytes or 80 lines, whichever is smaller. Defaults to File. Cannot be updated.
             */
            terminationMessagePolicy?: string | null
            /**
             * Whether this container should allocate a TTY for itself, also requires 'stdin' to be true. Default is false.
             */
            tty?: boolean | null
            /**
             * volumeDevices is the list of block devices to be used by the container.
             */
            volumeDevices?:
              | ({
                  /**
                   * devicePath is the path inside of the container that the device will be mapped to.
                   */
                  devicePath: string
                  /**
                   * name must match the name of a persistentVolumeClaim in the pod
                   */
                  name: string
                } | null)[]
              | null
            /**
             * Pod volumes to mount into the container's filesystem. Cannot be updated.
             */
            volumeMounts?:
              | ({
                  /**
                   * Path within the container at which the volume should be mounted.  Must not contain ':'.
                   */
                  mountPath: string
                  /**
                   * mountPropagation determines how mounts are propagated from the host to container and the other way around. When not set, MountPropagationNone is used. This field is beta in 1.10.
                   */
                  mountPropagation?: string | null
                  /**
                   * This must match the Name of a Volume.
                   */
                  name: string
                  /**
                   * Mounted read-only if true, read-write otherwise (false or unspecified). Defaults to false.
                   */
                  readOnly?: boolean | null
                  /**
                   * Path within the volume from which the container's volume should be mounted. Defaults to "" (volume's root).
                   */
                  subPath?: string | null
                  /**
                   * Expanded path within the volume from which the container's volume should be mounted. Behaves similarly to SubPath but environment variable references $(VAR_NAME) are expanded using the container's environment. Defaults to "" (volume's root). SubPathExpr and SubPath are mutually exclusive.
                   */
                  subPathExpr?: string | null
                } | null)[]
              | null
            /**
             * Container's working directory. If not specified, the container runtime's default will be used, which might be configured in the container image. Cannot be updated.
             */
            workingDir?: string | null
          } | null)[]
        | null
      /**
       * NodeName is a request to schedule this pod onto a specific node. If it is non-empty, the scheduler simply schedules this pod onto that node, assuming that it fits resource requirements.
       */
      nodeName?: string | null
      /**
       * NodeSelector is a selector which must be true for the pod to fit on a node. Selector which must match a node's labels for the pod to be scheduled on that node. More info: https://kubernetes.io/docs/concepts/configuration/assign-pod-node/
       */
      nodeSelector?: {
        [k: string]: string | null
      } | null
      /**
       * PodOS defines the OS parameters of a pod.
       */
      os?: {
        /**
         * Name is the name of the operating system. The currently supported values are linux and windows. Additional value may be defined in future and can be one of: https://github.com/opencontainers/runtime-spec/blob/master/config.md#platform-specific-configuration Clients should expect to handle additional values and treat unrecognized values in this field as os: null
         */
        name: string
      } | null
      /**
       * Overhead represents the resource overhead associated with running a pod for a given RuntimeClass. This field will be autopopulated at admission time by the RuntimeClass admission controller. If the RuntimeClass admission controller is enabled, overhead must not be set in Pod create requests. The RuntimeClass admission controller will reject Pod create requests which have the overhead already set. If RuntimeClass is configured and selected in the PodSpec, Overhead will be set to the value defined in the corresponding RuntimeClass, otherwise it will remain unset and treated as zero. More info: https://git.k8s.io/enhancements/keps/sig-node/688-pod-overhead/README.md
       */
      overhead?: {
        [k: string]: (string | null) | (number | null)
      } | null
      /**
       * PreemptionPolicy is the Policy for preempting pods with lower priority. One of Never, PreemptLowerPriority. Defaults to PreemptLowerPriority if unset.
       */
      preemptionPolicy?: string | null
      /**
       * The priority value. Various system components use this field to find the priority of the pod. When Priority Admission Controller is enabled, it prevents users from setting this field. The admission controller populates this field from PriorityClassName. The higher the value, the higher the priority.
       */
      priority?: number | null
      /**
       * If specified, indicates the pod's priority. "system-node-critical" and "system-cluster-critical" are two special keywords which indicate the highest priorities with the former being the highest priority. Any other name must be defined by creating a PriorityClass object with that name. If not specified, the pod priority will be default or zero if there is no default.
       */
      priorityClassName?: string | null
      /**
       * If specified, all readiness gates will be evaluated for pod readiness. A pod is ready when all its containers are ready AND all conditions specified in the readiness gates have status equal to "True" More info: https://git.k8s.io/enhancements/keps/sig-network/580-pod-readiness-gates
       */
      readinessGates?:
        | ({
            /**
             * ConditionType refers to a condition in the pod's condition list with matching type.
             */
            conditionType: string
          } | null)[]
        | null
      /**
       * ResourceClaims defines which ResourceClaims must be allocated and reserved before the Pod is allowed to start. The resources will be made available to those containers which consume them by name.
       *
       * This is an alpha field and requires enabling the DynamicResourceAllocation feature gate.
       *
       * This field is immutable.
       */
      resourceClaims?:
        | ({
            /**
             * Name uniquely identifies this resource claim inside the pod. This must be a DNS_LABEL.
             */
            name: string
            /**
             * ClaimSource describes a reference to a ResourceClaim.
             *
             * Exactly one of these fields should be set.  Consumers of this type must treat an empty object as if it has an unknown value.
             */
            source?: {
              /**
               * ResourceClaimName is the name of a ResourceClaim object in the same namespace as this pod.
               */
              resourceClaimName?: string | null
              /**
               * ResourceClaimTemplateName is the name of a ResourceClaimTemplate object in the same namespace as this pod.
               *
               * The template will be used to create a new ResourceClaim, which will be bound to this pod. When this pod is deleted, the ResourceClaim will also be deleted. The pod name and resource name, along with a generated component, will be used to form a unique name for the ResourceClaim, which will be recorded in pod.status.resourceClaimStatuses.
               *
               * This field is immutable and no changes will be made to the corresponding ResourceClaim by the control plane after creating the ResourceClaim.
               */
              resourceClaimTemplateName?: string | null
            } | null
          } | null)[]
        | null
      /**
       * Restart policy for all containers within the pod. One of Always, OnFailure, Never. In some contexts, only a subset of those values may be permitted. Default to Always. More info: https://kubernetes.io/docs/concepts/workloads/pods/pod-lifecycle/#restart-policy
       */
      restartPolicy?: string | null
      /**
       * RuntimeClassName refers to a RuntimeClass object in the node.k8s.io group, which should be used to run this pod.  If no RuntimeClass resource matches the named class, the pod will not be run. If unset or empty, the "legacy" RuntimeClass will be used, which is an implicit class with an empty definition that uses the default runtime handler. More info: https://git.k8s.io/enhancements/keps/sig-node/585-runtime-class
       */
      runtimeClassName?: string | null
      /**
       * If specified, the pod will be dispatched by specified scheduler. If not specified, the pod will be dispatched by default scheduler.
       */
      schedulerName?: string | null
      /**
       * SchedulingGates is an opaque list of values that if specified will block scheduling the pod. If schedulingGates is not empty, the pod will stay in the SchedulingGated state and the scheduler will not attempt to schedule the pod.
       *
       * SchedulingGates can only be set at pod creation time, and be removed only afterwards.
       *
       * This is a beta feature enabled by the PodSchedulingReadiness feature gate.
       */
      schedulingGates?:
        | ({
            /**
             * Name of the scheduling gate. Each scheduling gate must have a unique name field.
             */
            name: string
          } | null)[]
        | null
      /**
       * PodSecurityContext holds pod-level security attributes and common container settings. Some fields are also present in container.securityContext.  Field values of container.securityContext take precedence over field values of PodSecurityContext.
       */
      securityContext?: {
        /**
         * A special supplemental group that applies to all containers in a pod. Some volume types allow the Kubelet to change the ownership of that volume to be owned by the pod:
         *
         * 1. The owning GID will be the FSGroup 2. The setgid bit is set (new files created in the volume will be owned by FSGroup) 3. The permission bits are OR'd with rw-rw----
         *
         * If unset, the Kubelet will not modify the ownership and permissions of any volume. Note that this field cannot be set when spec.os.name is windows.
         */
        fsGroup?: number | null
        /**
         * fsGroupChangePolicy defines behavior of changing ownership and permission of the volume before being exposed inside Pod. This field will only apply to volume types which support fsGroup based ownership(and permissions). It will have no effect on ephemeral volume types such as: secret, configmaps and emptydir. Valid values are "OnRootMismatch" and "Always". If not specified, "Always" is used. Note that this field cannot be set when spec.os.name is windows.
         */
        fsGroupChangePolicy?: string | null
        /**
         * The GID to run the entrypoint of the container process. Uses runtime default if unset. May also be set in SecurityContext.  If set in both SecurityContext and PodSecurityContext, the value specified in SecurityContext takes precedence for that container. Note that this field cannot be set when spec.os.name is windows.
         */
        runAsGroup?: number | null
        /**
         * Indicates that the container must run as a non-root user. If true, the Kubelet will validate the image at runtime to ensure that it does not run as UID 0 (root) and fail to start the container if it does. If unset or false, no such validation will be performed. May also be set in SecurityContext.  If set in both SecurityContext and PodSecurityContext, the value specified in SecurityContext takes precedence.
         */
        runAsNonRoot?: boolean | null
        /**
         * The UID to run the entrypoint of the container process. Defaults to user specified in image metadata if unspecified. May also be set in SecurityContext.  If set in both SecurityContext and PodSecurityContext, the value specified in SecurityContext takes precedence for that container. Note that this field cannot be set when spec.os.name is windows.
         */
        runAsUser?: number | null
        /**
         * SELinuxOptions are the labels to be applied to the container
         */
        seLinuxOptions?: {
          /**
           * Level is SELinux level label that applies to the container.
           */
          level?: string | null
          /**
           * Role is a SELinux role label that applies to the container.
           */
          role?: string | null
          /**
           * Type is a SELinux type label that applies to the container.
           */
          type?: string | null
          /**
           * User is a SELinux user label that applies to the container.
           */
          user?: string | null
        } | null
        /**
         * SeccompProfile defines a pod/container's seccomp profile settings. Only one profile source may be set.
         */
        seccompProfile?: {
          /**
           * localhostProfile indicates a profile defined in a file on the node should be used. The profile must be preconfigured on the node to work. Must be a descending path, relative to the kubelet's configured seccomp profile location. Must be set if type is "Localhost". Must NOT be set for any other type.
           */
          localhostProfile?: string | null
          /**
           * type indicates which kind of seccomp profile will be applied. Valid options are:
           *
           * Localhost - a profile defined in a file on the node should be used. RuntimeDefault - the container runtime default profile should be used. Unconfined - no profile should be applied.
           */
          type: string
        } | null
        /**
         * A list of groups applied to the first process run in each container, in addition to the container's primary GID, the fsGroup (if specified), and group memberships defined in the container image for the uid of the container process. If unspecified, no additional groups are added to any container. Note that group memberships defined in the container image for the uid of the container process are still effective, even if they are not included in this list. Note that this field cannot be set when spec.os.name is windows.
         */
        supplementalGroups?: (number | null)[] | null
        /**
         * Sysctls hold a list of namespaced sysctls used for the pod. Pods with unsupported sysctls (by the container runtime) might fail to launch. Note that this field cannot be set when spec.os.name is windows.
         */
        sysctls?:
          | ({
              /**
               * Name of a property to set
               */
              name: string
              /**
               * Value of a property to set
               */
              value: string
            } | null)[]
          | null
        /**
         * WindowsSecurityContextOptions contain Windows-specific options and credentials.
         */
        windowsOptions?: {
          /**
           * GMSACredentialSpec is where the GMSA admission webhook (https://github.com/kubernetes-sigs/windows-gmsa) inlines the contents of the GMSA credential spec named by the GMSACredentialSpecName field.
           */
          gmsaCredentialSpec?: string | null
          /**
           * GMSACredentialSpecName is the name of the GMSA credential spec to use.
           */
          gmsaCredentialSpecName?: string | null
          /**
           * HostProcess determines if a container should be run as a 'Host Process' container. All of a Pod's containers must have the same effective HostProcess value (it is not allowed to have a mix of HostProcess containers and non-HostProcess containers). In addition, if HostProcess is true then HostNetwork must also be set to true.
           */
          hostProcess?: boolean | null
          /**
           * The UserName in Windows to run the entrypoint of the container process. Defaults to the user specified in image metadata if unspecified. May also be set in PodSecurityContext. If set in both SecurityContext and PodSecurityContext, the value specified in SecurityContext takes precedence.
           */
          runAsUserName?: string | null
        } | null
      } | null
      /**
       * DeprecatedServiceAccount is a depreciated alias for ServiceAccountName. Deprecated: Use serviceAccountName instead.
       */
      serviceAccount?: string | null
      /**
       * ServiceAccountName is the name of the ServiceAccount to use to run this pod. More info: https://kubernetes.io/docs/tasks/configure-pod-container/configure-service-account/
       */
      serviceAccountName?: string | null
      /**
       * If true the pod's hostname will be configured as the pod's FQDN, rather than the leaf name (the default). In Linux containers, this means setting the FQDN in the hostname field of the kernel (the nodename field of struct utsname). In Windows containers, this means setting the registry value of hostname for the registry key HKEY_LOCAL_MACHINE\SYSTEM\CurrentControlSet\Services\Tcpip\Parameters to FQDN. If a pod does not have FQDN, this has no effect. Default to false.
       */
      setHostnameAsFQDN?: boolean | null
      /**
       * Share a single process namespace between all of the containers in a pod. When this is set containers will be able to view and signal processes from other containers in the same pod, and the first process in each container will not be assigned PID 1. HostPID and ShareProcessNamespace cannot both be set. Optional: Default to false.
       */
      shareProcessNamespace?: boolean | null
      /**
       * If specified, the fully qualified Pod hostname will be "<hostname>.<subdomain>.<pod namespace>.svc.<cluster domain>". If not specified, the pod will not have a domainname at all.
       */
      subdomain?: string | null
      /**
       * Optional duration in seconds the pod needs to terminate gracefully. May be decreased in delete request. Value must be non-negative integer. The value zero indicates stop immediately via the kill signal (no opportunity to shut down). If this value is nil, the default grace period will be used instead. The grace period is the duration in seconds after the processes running in the pod are sent a termination signal and the time when the processes are forcibly halted with a kill signal. Set this value longer than the expected cleanup time for your process. Defaults to 30 seconds.
       */
      terminationGracePeriodSeconds?: number | null
      /**
       * If specified, the pod's tolerations.
       */
      tolerations?:
        | ({
            /**
             * Effect indicates the taint effect to match. Empty means match all taint effects. When specified, allowed values are NoSchedule, PreferNoSchedule and NoExecute.
             */
            effect?: string | null
            /**
             * Key is the taint key that the toleration applies to. Empty means match all taint keys. If the key is empty, operator must be Exists; this combination means to match all values and all keys.
             */
            key?: string | null
            /**
             * Operator represents a key's relationship to the value. Valid operators are Exists and Equal. Defaults to Equal. Exists is equivalent to wildcard for value, so that a pod can tolerate all taints of a particular category.
             */
            operator?: string | null
            /**
             * TolerationSeconds represents the period of time the toleration (which must be of effect NoExecute, otherwise this field is ignored) tolerates the taint. By default, it is not set, which means tolerate the taint forever (do not evict). Zero and negative values will be treated as 0 (evict immediately) by the system.
             */
            tolerationSeconds?: number | null
            /**
             * Value is the taint value the toleration matches to. If the operator is Exists, the value should be empty, otherwise just a regular string.
             */
            value?: string | null
          } | null)[]
        | null
      /**
       * TopologySpreadConstraints describes how a group of pods ought to spread across topology domains. Scheduler will schedule pods in a way which abides by the constraints. All topologySpreadConstraints are ANDed.
       */
      topologySpreadConstraints?:
        | ({
            /**
             * A label selector is a label query over a set of resources. The result of matchLabels and matchExpressions are ANDed. An empty label selector matches all objects. A null label selector matches no objects.
             */
            labelSelector?: {
              /**
               * matchExpressions is a list of label selector requirements. The requirements are ANDed.
               */
              matchExpressions?:
                | ({
                    /**
                     * key is the label key that the selector applies to.
                     */
                    key: string
                    /**
                     * operator represents a key's relationship to a set of values. Valid operators are In, NotIn, Exists and DoesNotExist.
                     */
                    operator: string
                    /**
                     * values is an array of string values. If the operator is In or NotIn, the values array must be non-empty. If the operator is Exists or DoesNotExist, the values array must be empty. This array is replaced during a strategic merge patch.
                     */
                    values?: (string | null)[] | null
                  } | null)[]
                | null
              /**
               * matchLabels is a map of {key,value} pairs. A single {key,value} in the matchLabels map is equivalent to an element of matchExpressions, whose key field is "key", the operator is "In", and the values array contains only "value". The requirements are ANDed.
               */
              matchLabels?: {
                [k: string]: string | null
              } | null
            } | null
            /**
             * MatchLabelKeys is a set of pod label keys to select the pods over which spreading will be calculated. The keys are used to lookup values from the incoming pod labels, those key-value labels are ANDed with labelSelector to select the group of existing pods over which spreading will be calculated for the incoming pod. The same key is forbidden to exist in both MatchLabelKeys and LabelSelector. MatchLabelKeys cannot be set when LabelSelector isn't set. Keys that don't exist in the incoming pod labels will be ignored. A null or empty list means only match against labelSelector.
             *
             * This is a beta field and requires the MatchLabelKeysInPodTopologySpread feature gate to be enabled (enabled by default).
             */
            matchLabelKeys?: (string | null)[] | null
            /**
             * MaxSkew describes the degree to which pods may be unevenly distributed. When `whenUnsatisfiable=DoNotSchedule`, it is the maximum permitted difference between the number of matching pods in the target topology and the global minimum. The global minimum is the minimum number of matching pods in an eligible domain or zero if the number of eligible domains is less than MinDomains. For example, in a 3-zone cluster, MaxSkew is set to 1, and pods with the same labelSelector spread as 2/2/1: In this case, the global minimum is 1. | zone1 | zone2 | zone3 | |  P P  |  P P  |   P   | - if MaxSkew is 1, incoming pod can only be scheduled to zone3 to become 2/2/2; scheduling it onto zone1(zone2) would make the ActualSkew(3-1) on zone1(zone2) violate MaxSkew(1). - if MaxSkew is 2, incoming pod can be scheduled onto any zone. When `whenUnsatisfiable=ScheduleAnyway`, it is used to give higher precedence to topologies that satisfy it. It's a required field. Default value is 1 and 0 is not allowed.
             */
            maxSkew: number
            /**
             * MinDomains indicates a minimum number of eligible domains. When the number of eligible domains with matching topology keys is less than minDomains, Pod Topology Spread treats "global minimum" as 0, and then the calculation of Skew is performed. And when the number of eligible domains with matching topology keys equals or greater than minDomains, this value has no effect on scheduling. As a result, when the number of eligible domains is less than minDomains, scheduler won't schedule more than maxSkew Pods to those domains. If value is nil, the constraint behaves as if MinDomains is equal to 1. Valid values are integers greater than 0. When value is not nil, WhenUnsatisfiable must be DoNotSchedule.
             *
             * For example, in a 3-zone cluster, MaxSkew is set to 2, MinDomains is set to 5 and pods with the same labelSelector spread as 2/2/2: | zone1 | zone2 | zone3 | |  P P  |  P P  |  P P  | The number of domains is less than 5(MinDomains), so "global minimum" is treated as 0. In this situation, new pod with the same labelSelector cannot be scheduled, because computed skew will be 3(3 - 0) if new Pod is scheduled to any of the three zones, it will violate MaxSkew.
             *
             * This is a beta field and requires the MinDomainsInPodTopologySpread feature gate to be enabled (enabled by default).
             */
            minDomains?: number | null
            /**
             * NodeAffinityPolicy indicates how we will treat Pod's nodeAffinity/nodeSelector when calculating pod topology spread skew. Options are: - Honor: only nodes matching nodeAffinity/nodeSelector are included in the calculations. - Ignore: nodeAffinity/nodeSelector are ignored. All nodes are included in the calculations.
             *
             * If this value is nil, the behavior is equivalent to the Honor policy. This is a beta-level feature default enabled by the NodeInclusionPolicyInPodTopologySpread feature flag.
             */
            nodeAffinityPolicy?: string | null
            /**
             * NodeTaintsPolicy indicates how we will treat node taints when calculating pod topology spread skew. Options are: - Honor: nodes without taints, along with tainted nodes for which the incoming pod has a toleration, are included. - Ignore: node taints are ignored. All nodes are included.
             *
             * If this value is nil, the behavior is equivalent to the Ignore policy. This is a beta-level feature default enabled by the NodeInclusionPolicyInPodTopologySpread feature flag.
             */
            nodeTaintsPolicy?: string | null
            /**
             * TopologyKey is the key of node labels. Nodes that have a label with this key and identical values are considered to be in the same topology. We consider each <key, value> as a "bucket", and try to put balanced number of pods into each bucket. We define a domain as a particular instance of a topology. Also, we define an eligible domain as a domain whose nodes meet the requirements of nodeAffinityPolicy and nodeTaintsPolicy. e.g. If TopologyKey is "kubernetes.io/hostname", each Node is a domain of that topology. And, if TopologyKey is "topology.kubernetes.io/zone", each zone is a domain of that topology. It's a required field.
             */
            topologyKey: string
            /**
             * WhenUnsatisfiable indicates how to deal with a pod if it doesn't satisfy the spread constraint. - DoNotSchedule (default) tells the scheduler not to schedule it. - ScheduleAnyway tells the scheduler to schedule the pod in any location,
             *   but giving higher precedence to topologies that would help reduce the
             *   skew.
             * A constraint is considered "Unsatisfiable" for an incoming pod if and only if every possible node assignment for that pod would violate "MaxSkew" on some topology. For example, in a 3-zone cluster, MaxSkew is set to 1, and pods with the same labelSelector spread as 3/1/1: | zone1 | zone2 | zone3 | | P P P |   P   |   P   | If WhenUnsatisfiable is set to DoNotSchedule, incoming pod can only be scheduled to zone2(zone3) to become 3/2/1(3/1/2) as ActualSkew(2-1) on zone2(zone3) satisfies MaxSkew(1). In other words, the cluster can still be imbalanced, but scheduler won't make it *more* imbalanced. It's a required field.
             */
            whenUnsatisfiable: string
          } | null)[]
        | null
      /**
       * List of volumes that can be mounted by containers belonging to the pod. More info: https://kubernetes.io/docs/concepts/storage/volumes
       */
      volumes?:
        | ({
            /**
             * Represents a Persistent Disk resource in AWS.
             *
             * An AWS EBS disk must exist before mounting to a container. The disk must also be in the same AWS zone as the kubelet. An AWS EBS disk can only be mounted as read/write once. AWS EBS volumes support ownership management and SELinux relabeling.
             */
            awsElasticBlockStore?: {
              /**
               * fsType is the filesystem type of the volume that you want to mount. Tip: Ensure that the filesystem type is supported by the host operating system. Examples: "ext4", "xfs", "ntfs". Implicitly inferred to be "ext4" if unspecified. More info: https://kubernetes.io/docs/concepts/storage/volumes#awselasticblockstore
               */
              fsType?: string | null
              /**
               * partition is the partition in the volume that you want to mount. If omitted, the default is to mount by volume name. Examples: For volume /dev/sda1, you specify the partition as "1". Similarly, the volume partition for /dev/sda is "0" (or you can leave the property empty).
               */
              partition?: number | null
              /**
               * readOnly value true will force the readOnly setting in VolumeMounts. More info: https://kubernetes.io/docs/concepts/storage/volumes#awselasticblockstore
               */
              readOnly?: boolean | null
              /**
               * volumeID is unique ID of the persistent disk resource in AWS (Amazon EBS volume). More info: https://kubernetes.io/docs/concepts/storage/volumes#awselasticblockstore
               */
              volumeID: string
            } | null
            /**
             * AzureDisk represents an Azure Data Disk mount on the host and bind mount to the pod.
             */
            azureDisk?: {
              /**
               * cachingMode is the Host Caching mode: None, Read Only, Read Write.
               */
              cachingMode?: string | null
              /**
               * diskName is the Name of the data disk in the blob storage
               */
              diskName: string
              /**
               * diskURI is the URI of data disk in the blob storage
               */
              diskURI: string
              /**
               * fsType is Filesystem type to mount. Must be a filesystem type supported by the host operating system. Ex. "ext4", "xfs", "ntfs". Implicitly inferred to be "ext4" if unspecified.
               */
              fsType?: string | null
              /**
               * kind expected values are Shared: multiple blob disks per storage account  Dedicated: single blob disk per storage account  Managed: azure managed data disk (only in managed availability set). defaults to shared
               */
              kind?: string | null
              /**
               * readOnly Defaults to false (read/write). ReadOnly here will force the ReadOnly setting in VolumeMounts.
               */
              readOnly?: boolean | null
            } | null
            /**
             * AzureFile represents an Azure File Service mount on the host and bind mount to the pod.
             */
            azureFile?: {
              /**
               * readOnly defaults to false (read/write). ReadOnly here will force the ReadOnly setting in VolumeMounts.
               */
              readOnly?: boolean | null
              /**
               * secretName is the  name of secret that contains Azure Storage Account Name and Key
               */
              secretName: string
              /**
               * shareName is the azure share Name
               */
              shareName: string
            } | null
            /**
             * Represents a Ceph Filesystem mount that lasts the lifetime of a pod Cephfs volumes do not support ownership management or SELinux relabeling.
             */
            cephfs?: {
              /**
               * monitors is Required: Monitors is a collection of Ceph monitors More info: https://examples.k8s.io/volumes/cephfs/README.md#how-to-use-it
               */
              monitors: (string | null)[]
              /**
               * path is Optional: Used as the mounted root, rather than the full Ceph tree, default is /
               */
              path?: string | null
              /**
               * readOnly is Optional: Defaults to false (read/write). ReadOnly here will force the ReadOnly setting in VolumeMounts. More info: https://examples.k8s.io/volumes/cephfs/README.md#how-to-use-it
               */
              readOnly?: boolean | null
              /**
               * secretFile is Optional: SecretFile is the path to key ring for User, default is /etc/ceph/user.secret More info: https://examples.k8s.io/volumes/cephfs/README.md#how-to-use-it
               */
              secretFile?: string | null
              /**
               * LocalObjectReference contains enough information to let you locate the referenced object inside the same namespace.
               */
              secretRef?: {
                /**
                 * Name of the referent. More info: https://kubernetes.io/docs/concepts/overview/working-with-objects/names/#names
                 */
                name?: string | null
              } | null
              /**
               * user is optional: User is the rados user name, default is admin More info: https://examples.k8s.io/volumes/cephfs/README.md#how-to-use-it
               */
              user?: string | null
            } | null
            /**
             * Represents a cinder volume resource in Openstack. A Cinder volume must exist before mounting to a container. The volume must also be in the same region as the kubelet. Cinder volumes support ownership management and SELinux relabeling.
             */
            cinder?: {
              /**
               * fsType is the filesystem type to mount. Must be a filesystem type supported by the host operating system. Examples: "ext4", "xfs", "ntfs". Implicitly inferred to be "ext4" if unspecified. More info: https://examples.k8s.io/mysql-cinder-pd/README.md
               */
              fsType?: string | null
              /**
               * readOnly defaults to false (read/write). ReadOnly here will force the ReadOnly setting in VolumeMounts. More info: https://examples.k8s.io/mysql-cinder-pd/README.md
               */
              readOnly?: boolean | null
              /**
               * LocalObjectReference contains enough information to let you locate the referenced object inside the same namespace.
               */
              secretRef?: {
                /**
                 * Name of the referent. More info: https://kubernetes.io/docs/concepts/overview/working-with-objects/names/#names
                 */
                name?: string | null
              } | null
              /**
               * volumeID used to identify the volume in cinder. More info: https://examples.k8s.io/mysql-cinder-pd/README.md
               */
              volumeID: string
            } | null
            /**
             * Adapts a ConfigMap into a volume.
             *
             * The contents of the target ConfigMap's Data field will be presented in a volume as files using the keys in the Data field as the file names, unless the items element is populated with specific mappings of keys to paths. ConfigMap volumes support ownership management and SELinux relabeling.
             */
            configMap?: {
              /**
               * defaultMode is optional: mode bits used to set permissions on created files by default. Must be an octal value between 0000 and 0777 or a decimal value between 0 and 511. YAML accepts both octal and decimal values, JSON requires decimal values for mode bits. Defaults to 0644. Directories within the path are not affected by this setting. This might be in conflict with other options that affect the file mode, like fsGroup, and the result can be other mode bits set.
               */
              defaultMode?: number | null
              /**
               * items if unspecified, each key-value pair in the Data field of the referenced ConfigMap will be projected into the volume as a file whose name is the key and content is the value. If specified, the listed keys will be projected into the specified paths, and unlisted keys will not be present. If a key is specified which is not present in the ConfigMap, the volume setup will error unless it is marked optional. Paths must be relative and may not contain the '..' path or start with '..'.
               */
              items?:
                | ({
                    /**
                     * key is the key to project.
                     */
                    key: string
                    /**
                     * mode is Optional: mode bits used to set permissions on this file. Must be an octal value between 0000 and 0777 or a decimal value between 0 and 511. YAML accepts both octal and decimal values, JSON requires decimal values for mode bits. If not specified, the volume defaultMode will be used. This might be in conflict with other options that affect the file mode, like fsGroup, and the result can be other mode bits set.
                     */
                    mode?: number | null
                    /**
                     * path is the relative path of the file to map the key to. May not be an absolute path. May not contain the path element '..'. May not start with the string '..'.
                     */
                    path: string
                  } | null)[]
                | null
              /**
               * Name of the referent. More info: https://kubernetes.io/docs/concepts/overview/working-with-objects/names/#names
               */
              name?: string | null
              /**
               * optional specify whether the ConfigMap or its keys must be defined
               */
              optional?: boolean | null
            } | null
            /**
             * Represents a source location of a volume to mount, managed by an external CSI driver
             */
            csi?: {
              /**
               * driver is the name of the CSI driver that handles this volume. Consult with your admin for the correct name as registered in the cluster.
               */
              driver: string
              /**
               * fsType to mount. Ex. "ext4", "xfs", "ntfs". If not provided, the empty value is passed to the associated CSI driver which will determine the default filesystem to apply.
               */
              fsType?: string | null
              /**
               * LocalObjectReference contains enough information to let you locate the referenced object inside the same namespace.
               */
              nodePublishSecretRef?: {
                /**
                 * Name of the referent. More info: https://kubernetes.io/docs/concepts/overview/working-with-objects/names/#names
                 */
                name?: string | null
              } | null
              /**
               * readOnly specifies a read-only configuration for the volume. Defaults to false (read/write).
               */
              readOnly?: boolean | null
              /**
               * volumeAttributes stores driver-specific properties that are passed to the CSI driver. Consult your driver's documentation for supported values.
               */
              volumeAttributes?: {
                [k: string]: string | null
              } | null
            } | null
            /**
             * DownwardAPIVolumeSource represents a volume containing downward API info. Downward API volumes support ownership management and SELinux relabeling.
             */
            downwardAPI?: {
              /**
               * Optional: mode bits to use on created files by default. Must be a Optional: mode bits used to set permissions on created files by default. Must be an octal value between 0000 and 0777 or a decimal value between 0 and 511. YAML accepts both octal and decimal values, JSON requires decimal values for mode bits. Defaults to 0644. Directories within the path are not affected by this setting. This might be in conflict with other options that affect the file mode, like fsGroup, and the result can be other mode bits set.
               */
              defaultMode?: number | null
              /**
               * Items is a list of downward API volume file
               */
              items?:
                | ({
                    /**
                     * ObjectFieldSelector selects an APIVersioned field of an object.
                     */
                    fieldRef?: {
                      /**
                       * Version of the schema the FieldPath is written in terms of, defaults to "v1".
                       */
                      apiVersion?: string | null
                      /**
                       * Path of the field to select in the specified API version.
                       */
                      fieldPath: string
                    } | null
                    /**
                     * Optional: mode bits used to set permissions on this file, must be an octal value between 0000 and 0777 or a decimal value between 0 and 511. YAML accepts both octal and decimal values, JSON requires decimal values for mode bits. If not specified, the volume defaultMode will be used. This might be in conflict with other options that affect the file mode, like fsGroup, and the result can be other mode bits set.
                     */
                    mode?: number | null
                    /**
                     * Required: Path is  the relative path name of the file to be created. Must not be absolute or contain the '..' path. Must be utf-8 encoded. The first item of the relative path must not start with '..'
                     */
                    path: string
                    /**
                     * ResourceFieldSelector represents container resources (cpu, memory) and their output format
                     */
                    resourceFieldRef?: {
                      /**
                       * Container name: required for volumes, optional for env vars
                       */
                      containerName?: string | null
                      divisor?: (string | null) | (number | null)
                      /**
                       * Required: resource to select
                       */
                      resource: string
                    } | null
                  } | null)[]
                | null
            } | null
            /**
             * Represents an empty directory for a pod. Empty directory volumes support ownership management and SELinux relabeling.
             */
            emptyDir?: {
              /**
               * medium represents what type of storage medium should back this directory. The default is "" which means to use the node's default medium. Must be an empty string (default) or Memory. More info: https://kubernetes.io/docs/concepts/storage/volumes#emptydir
               */
              medium?: string | null
              sizeLimit?: (string | null) | (number | null)
            } | null
            /**
             * Represents an ephemeral volume that is handled by a normal storage driver.
             */
            ephemeral?: {
              /**
               * PersistentVolumeClaimTemplate is used to produce PersistentVolumeClaim objects as part of an EphemeralVolumeSource.
               */
              volumeClaimTemplate?: {
                /**
                 * ObjectMeta is metadata that all persisted resources must have, which includes all objects users must create.
                 */
                metadata?: {
                  /**
                   * Annotations is an unstructured key value map stored with a resource that may be set by external tools to store and retrieve arbitrary metadata. They are not queryable and should be preserved when modifying objects. More info: https://kubernetes.io/docs/concepts/overview/working-with-objects/annotations
                   */
                  annotations?: {
                    [k: string]: string | null
                  } | null
                  /**
                   * Time is a wrapper around time.Time which supports correct marshaling to YAML and JSON.  Wrappers are provided for many of the factory methods that the time package offers.
                   */
                  creationTimestamp?: string | null
                  /**
                   * Number of seconds allowed for this object to gracefully terminate before it will be removed from the system. Only set when deletionTimestamp is also set. May only be shortened. Read-only.
                   */
                  deletionGracePeriodSeconds?: number | null
                  /**
                   * Time is a wrapper around time.Time which supports correct marshaling to YAML and JSON.  Wrappers are provided for many of the factory methods that the time package offers.
                   */
                  deletionTimestamp?: string | null
                  /**
                   * Must be empty before the object is deleted from the registry. Each entry is an identifier for the responsible component that will remove the entry from the list. If the deletionTimestamp of the object is non-nil, entries in this list can only be removed. Finalizers may be processed and removed in any order.  Order is NOT enforced because it introduces significant risk of stuck finalizers. finalizers is a shared field, any actor with permission can reorder it. If the finalizer list is processed in order, then this can lead to a situation in which the component responsible for the first finalizer in the list is waiting for a signal (field value, external system, or other) produced by a component responsible for a finalizer later in the list, resulting in a deadlock. Without enforced ordering finalizers are free to order amongst themselves and are not vulnerable to ordering changes in the list.
                   */
                  finalizers?: (string | null)[] | null
                  /**
                   * GenerateName is an optional prefix, used by the server, to generate a unique name ONLY IF the Name field has not been provided. If this field is used, the name returned to the client will be different than the name passed. This value will also be combined with a unique suffix. The provided value has the same validation rules as the Name field, and may be truncated by the length of the suffix required to make the value unique on the server.
                   *
                   * If this field is specified and the generated name exists, the server will return a 409.
                   *
                   * Applied only if Name is not specified. More info: https://git.k8s.io/community/contributors/devel/sig-architecture/api-conventions.md#idempotency
                   */
                  generateName?: string | null
                  /**
                   * A sequence number representing a specific generation of the desired state. Populated by the system. Read-only.
                   */
                  generation?: number | null
                  /**
                   * Map of string keys and values that can be used to organize and categorize (scope and select) objects. May match selectors of replication controllers and services. More info: https://kubernetes.io/docs/concepts/overview/working-with-objects/labels
                   */
                  labels?: {
                    [k: string]: string | null
                  } | null
                  /**
                   * ManagedFields maps workflow-id and version to the set of fields that are managed by that workflow. This is mostly for internal housekeeping, and users typically shouldn't need to set or understand this field. A workflow can be the user's name, a controller's name, or the name of a specific apply path like "ci-cd". The set of fields is always in the version that the workflow used when modifying the object.
                   */
                  managedFields?:
                    | ({
                        /**
                         * APIVersion defines the version of this resource that this field set applies to. The format is "group/version" just like the top-level APIVersion field. It is necessary to track the version of a field set because it cannot be automatically converted.
                         */
                        apiVersion?: string | null
                        /**
                         * FieldsType is the discriminator for the different fields format and version. There is currently only one possible value: "FieldsV1"
                         */
                        fieldsType?: string | null
                        /**
                         * FieldsV1 stores a set of fields in a data structure like a Trie, in JSON format.
                         *
                         * Each key is either a '.' representing the field itself, and will always map to an empty set, or a string representing a sub-field or item. The string will follow one of these four formats: 'f:<name>', where <name> is the name of a field in a struct, or key in a map 'v:<value>', where <value> is the exact json formatted value of a list item 'i:<index>', where <index> is position of a item in a list 'k:<keys>', where <keys> is a map of  a list item's key fields to their unique values If a key maps to an empty Fields value, the field that key represents is part of the set.
                         *
                         * The exact format is defined in sigs.k8s.io/structured-merge-diff
                         */
                        fieldsV1?: {
                          [k: string]: unknown
                        } | null
                        /**
                         * Manager is an identifier of the workflow managing these fields.
                         */
                        manager?: string | null
                        /**
                         * Operation is the type of operation which lead to this ManagedFieldsEntry being created. The only valid values for this field are 'Apply' and 'Update'.
                         */
                        operation?: string | null
                        /**
                         * Subresource is the name of the subresource used to update that object, or empty string if the object was updated through the main resource. The value of this field is used to distinguish between managers, even if they share the same name. For example, a status update will be distinct from a regular update using the same manager name. Note that the APIVersion field is not related to the Subresource field and it always corresponds to the version of the main resource.
                         */
                        subresource?: string | null
                        /**
                         * Time is a wrapper around time.Time which supports correct marshaling to YAML and JSON.  Wrappers are provided for many of the factory methods that the time package offers.
                         */
                        time?: string | null
                      } | null)[]
                    | null
                  /**
                   * Name must be unique within a namespace. Is required when creating resources, although some resources may allow a client to request the generation of an appropriate name automatically. Name is primarily intended for creation idempotence and configuration definition. Cannot be updated. More info: https://kubernetes.io/docs/concepts/overview/working-with-objects/names#names
                   */
                  name?: string | null
                  /**
                   * Namespace defines the space within which each name must be unique. An empty namespace is equivalent to the "default" namespace, but "default" is the canonical representation. Not all objects are required to be scoped to a namespace - the value of this field for those objects will be empty.
                   *
                   * Must be a DNS_LABEL. Cannot be updated. More info: https://kubernetes.io/docs/concepts/overview/working-with-objects/namespaces
                   */
                  namespace?: string | null
                  /**
                   * List of objects depended by this object. If ALL objects in the list have been deleted, this object will be garbage collected. If this object is managed by a controller, then an entry in this list will point to this controller, with the controller field set to true. There cannot be more than one managing controller.
                   */
                  ownerReferences?:
                    | ({
                        /**
                         * API version of the referent.
                         */
                        apiVersion: string
                        /**
                         * If true, AND if the owner has the "foregroundDeletion" finalizer, then the owner cannot be deleted from the key-value store until this reference is removed. See https://kubernetes.io/docs/concepts/architecture/garbage-collection/#foreground-deletion for how the garbage collector interacts with this field and enforces the foreground deletion. Defaults to false. To set this field, a user needs "delete" permission of the owner, otherwise 422 (Unprocessable Entity) will be returned.
                         */
                        blockOwnerDeletion?: boolean | null
                        /**
                         * If true, this reference points to the managing controller.
                         */
                        controller?: boolean | null
                        /**
                         * Kind of the referent. More info: https://git.k8s.io/community/contributors/devel/sig-architecture/api-conventions.md#types-kinds
                         */
                        kind: string
                        /**
                         * Name of the referent. More info: https://kubernetes.io/docs/concepts/overview/working-with-objects/names#names
                         */
                        name: string
                        /**
                         * UID of the referent. More info: https://kubernetes.io/docs/concepts/overview/working-with-objects/names#uids
                         */
                        uid: string
                      } | null)[]
                    | null
                  /**
                   * An opaque value that represents the internal version of this object that can be used by clients to determine when objects have changed. May be used for optimistic concurrency, change detection, and the watch operation on a resource or set of resources. Clients must treat these values as opaque and passed unmodified back to the server. They may only be valid for a particular resource or set of resources.
                   *
                   * Populated by the system. Read-only. Value must be treated as opaque by clients and . More info: https://git.k8s.io/community/contributors/devel/sig-architecture/api-conventions.md#concurrency-control-and-consistency
                   */
                  resourceVersion?: string | null
                  /**
                   * Deprecated: selfLink is a legacy read-only field that is no longer populated by the system.
                   */
                  selfLink?: string | null
                  /**
                   * UID is the unique in time and space value for this object. It is typically generated by the server on successful creation of a resource and is not allowed to change on PUT operations.
                   *
                   * Populated by the system. Read-only. More info: https://kubernetes.io/docs/concepts/overview/working-with-objects/names#uids
                   */
                  uid?: string | null
                } | null
                /**
                 * PersistentVolumeClaimSpec describes the common attributes of storage devices and allows a Source for provider-specific attributes
                 */
                spec: {
                  /**
                   * accessModes contains the desired access modes the volume should have. More info: https://kubernetes.io/docs/concepts/storage/persistent-volumes#access-modes-1
                   */
                  accessModes?: (string | null)[] | null
                  /**
                   * TypedLocalObjectReference contains enough information to let you locate the typed referenced object inside the same namespace.
                   */
                  dataSource?: {
                    /**
                     * APIGroup is the group for the resource being referenced. If APIGroup is not specified, the specified Kind must be in the core API group. For any other third-party types, APIGroup is required.
                     */
                    apiGroup?: string | null
                    /**
                     * Kind is the type of resource being referenced
                     */
                    kind: string
                    /**
                     * Name is the name of resource being referenced
                     */
                    name: string
                  } | null
                  dataSourceRef?: {
                    /**
                     * APIGroup is the group for the resource being referenced. If APIGroup is not specified, the specified Kind must be in the core API group. For any other third-party types, APIGroup is required.
                     */
                    apiGroup?: string | null
                    /**
                     * Kind is the type of resource being referenced
                     */
                    kind: string
                    /**
                     * Name is the name of resource being referenced
                     */
                    name: string
                    /**
                     * Namespace is the namespace of resource being referenced Note that when a namespace is specified, a gateway.networking.k8s.io/ReferenceGrant object is required in the referent namespace to allow that namespace's owner to accept the reference. See the ReferenceGrant documentation for details. (Alpha) This field requires the CrossNamespaceVolumeDataSource feature gate to be enabled.
                     */
                    namespace?: string | null
                  } | null
                  /**
                   * VolumeResourceRequirements describes the storage resource requirements for a volume.
                   */
                  resources?: {
                    /**
                     * Limits describes the maximum amount of compute resources allowed. More info: https://kubernetes.io/docs/concepts/configuration/manage-resources-containers/
                     */
                    limits?: {
                      [k: string]: (string | null) | (number | null)
                    } | null
                    /**
                     * Requests describes the minimum amount of compute resources required. If Requests is omitted for a container, it defaults to Limits if that is explicitly specified, otherwise to an implementation-defined value. Requests cannot exceed Limits. More info: https://kubernetes.io/docs/concepts/configuration/manage-resources-containers/
                     */
                    requests?: {
                      [k: string]: (string | null) | (number | null)
                    } | null
                  } | null
                  /**
                   * A label selector is a label query over a set of resources. The result of matchLabels and matchExpressions are ANDed. An empty label selector matches all objects. A null label selector matches no objects.
                   */
                  selector?: {
                    /**
                     * matchExpressions is a list of label selector requirements. The requirements are ANDed.
                     */
                    matchExpressions?:
                      | ({
                          /**
                           * key is the label key that the selector applies to.
                           */
                          key: string
                          /**
                           * operator represents a key's relationship to a set of values. Valid operators are In, NotIn, Exists and DoesNotExist.
                           */
                          operator: string
                          /**
                           * values is an array of string values. If the operator is In or NotIn, the values array must be non-empty. If the operator is Exists or DoesNotExist, the values array must be empty. This array is replaced during a strategic merge patch.
                           */
                          values?: (string | null)[] | null
                        } | null)[]
                      | null
                    /**
                     * matchLabels is a map of {key,value} pairs. A single {key,value} in the matchLabels map is equivalent to an element of matchExpressions, whose key field is "key", the operator is "In", and the values array contains only "value". The requirements are ANDed.
                     */
                    matchLabels?: {
                      [k: string]: string | null
                    } | null
                  } | null
                  /**
                   * storageClassName is the name of the StorageClass required by the claim. More info: https://kubernetes.io/docs/concepts/storage/persistent-volumes#class-1
                   */
                  storageClassName?: string | null
                  /**
                   * volumeAttributesClassName may be used to set the VolumeAttributesClass used by this claim. If specified, the CSI driver will create or update the volume with the attributes defined in the corresponding VolumeAttributesClass. This has a different purpose than storageClassName, it can be changed after the claim is created. An empty string value means that no VolumeAttributesClass will be applied to the claim but it's not allowed to reset this field to empty string once it is set. If unspecified and the PersistentVolumeClaim is unbound, the default VolumeAttributesClass will be set by the persistentvolume controller if it exists. If the resource referred to by volumeAttributesClass does not exist, this PersistentVolumeClaim will be set to a Pending state, as reflected by the modifyVolumeStatus field, until such as a resource exists. More info: https://kubernetes.io/docs/concepts/storage/persistent-volumes#volumeattributesclass (Alpha) Using this field requires the VolumeAttributesClass feature gate to be enabled.
                   */
                  volumeAttributesClassName?: string | null
                  /**
                   * volumeMode defines what type of volume is required by the claim. Value of Filesystem is implied when not included in claim spec.
                   */
                  volumeMode?: string | null
                  /**
                   * volumeName is the binding reference to the PersistentVolume backing this claim.
                   */
                  volumeName?: string | null
                }
              } | null
            } | null
            /**
             * Represents a Fibre Channel volume. Fibre Channel volumes can only be mounted as read/write once. Fibre Channel volumes support ownership management and SELinux relabeling.
             */
            fc?: {
              /**
               * fsType is the filesystem type to mount. Must be a filesystem type supported by the host operating system. Ex. "ext4", "xfs", "ntfs". Implicitly inferred to be "ext4" if unspecified.
               */
              fsType?: string | null
              /**
               * lun is Optional: FC target lun number
               */
              lun?: number | null
              /**
               * readOnly is Optional: Defaults to false (read/write). ReadOnly here will force the ReadOnly setting in VolumeMounts.
               */
              readOnly?: boolean | null
              /**
               * targetWWNs is Optional: FC target worldwide names (WWNs)
               */
              targetWWNs?: (string | null)[] | null
              /**
               * wwids Optional: FC volume world wide identifiers (wwids) Either wwids or combination of targetWWNs and lun must be set, but not both simultaneously.
               */
              wwids?: (string | null)[] | null
            } | null
            /**
             * FlexVolume represents a generic volume resource that is provisioned/attached using an exec based plugin.
             */
            flexVolume?: {
              /**
               * driver is the name of the driver to use for this volume.
               */
              driver: string
              /**
               * fsType is the filesystem type to mount. Must be a filesystem type supported by the host operating system. Ex. "ext4", "xfs", "ntfs". The default filesystem depends on FlexVolume script.
               */
              fsType?: string | null
              /**
               * options is Optional: this field holds extra command options if any.
               */
              options?: {
                [k: string]: string | null
              } | null
              /**
               * readOnly is Optional: defaults to false (read/write). ReadOnly here will force the ReadOnly setting in VolumeMounts.
               */
              readOnly?: boolean | null
              /**
               * LocalObjectReference contains enough information to let you locate the referenced object inside the same namespace.
               */
              secretRef?: {
                /**
                 * Name of the referent. More info: https://kubernetes.io/docs/concepts/overview/working-with-objects/names/#names
                 */
                name?: string | null
              } | null
            } | null
            /**
             * Represents a Flocker volume mounted by the Flocker agent. One and only one of datasetName and datasetUUID should be set. Flocker volumes do not support ownership management or SELinux relabeling.
             */
            flocker?: {
              /**
               * datasetName is Name of the dataset stored as metadata -> name on the dataset for Flocker should be considered as deprecated
               */
              datasetName?: string | null
              /**
               * datasetUUID is the UUID of the dataset. This is unique identifier of a Flocker dataset
               */
              datasetUUID?: string | null
            } | null
            /**
             * Represents a Persistent Disk resource in Google Compute Engine.
             *
             * A GCE PD must exist before mounting to a container. The disk must also be in the same GCE project and zone as the kubelet. A GCE PD can only be mounted as read/write once or read-only many times. GCE PDs support ownership management and SELinux relabeling.
             */
            gcePersistentDisk?: {
              /**
               * fsType is filesystem type of the volume that you want to mount. Tip: Ensure that the filesystem type is supported by the host operating system. Examples: "ext4", "xfs", "ntfs". Implicitly inferred to be "ext4" if unspecified. More info: https://kubernetes.io/docs/concepts/storage/volumes#gcepersistentdisk
               */
              fsType?: string | null
              /**
               * partition is the partition in the volume that you want to mount. If omitted, the default is to mount by volume name. Examples: For volume /dev/sda1, you specify the partition as "1". Similarly, the volume partition for /dev/sda is "0" (or you can leave the property empty). More info: https://kubernetes.io/docs/concepts/storage/volumes#gcepersistentdisk
               */
              partition?: number | null
              /**
               * pdName is unique name of the PD resource in GCE. Used to identify the disk in GCE. More info: https://kubernetes.io/docs/concepts/storage/volumes#gcepersistentdisk
               */
              pdName: string
              /**
               * readOnly here will force the ReadOnly setting in VolumeMounts. Defaults to false. More info: https://kubernetes.io/docs/concepts/storage/volumes#gcepersistentdisk
               */
              readOnly?: boolean | null
            } | null
            /**
             * Represents a volume that is populated with the contents of a git repository. Git repo volumes do not support ownership management. Git repo volumes support SELinux relabeling.
             *
             * DEPRECATED: GitRepo is deprecated. To provision a container with a git repo, mount an EmptyDir into an InitContainer that clones the repo using git, then mount the EmptyDir into the Pod's container.
             */
            gitRepo?: {
              /**
               * directory is the target directory name. Must not contain or start with '..'.  If '.' is supplied, the volume directory will be the git repository.  Otherwise, if specified, the volume will contain the git repository in the subdirectory with the given name.
               */
              directory?: string | null
              /**
               * repository is the URL
               */
              repository: string
              /**
               * revision is the commit hash for the specified revision.
               */
              revision?: string | null
            } | null
            /**
             * Represents a Glusterfs mount that lasts the lifetime of a pod. Glusterfs volumes do not support ownership management or SELinux relabeling.
             */
            glusterfs?: {
              /**
               * endpoints is the endpoint name that details Glusterfs topology. More info: https://examples.k8s.io/volumes/glusterfs/README.md#create-a-pod
               */
              endpoints: string
              /**
               * path is the Glusterfs volume path. More info: https://examples.k8s.io/volumes/glusterfs/README.md#create-a-pod
               */
              path: string
              /**
               * readOnly here will force the Glusterfs volume to be mounted with read-only permissions. Defaults to false. More info: https://examples.k8s.io/volumes/glusterfs/README.md#create-a-pod
               */
              readOnly?: boolean | null
            } | null
            /**
             * Represents a host path mapped into a pod. Host path volumes do not support ownership management or SELinux relabeling.
             */
            hostPath?: {
              /**
               * path of the directory on the host. If the path is a symlink, it will follow the link to the real path. More info: https://kubernetes.io/docs/concepts/storage/volumes#hostpath
               */
              path: string
              /**
               * type for HostPath Volume Defaults to "" More info: https://kubernetes.io/docs/concepts/storage/volumes#hostpath
               */
              type?: string | null
            } | null
            /**
             * Represents an ISCSI disk. ISCSI volumes can only be mounted as read/write once. ISCSI volumes support ownership management and SELinux relabeling.
             */
            iscsi?: {
              /**
               * chapAuthDiscovery defines whether support iSCSI Discovery CHAP authentication
               */
              chapAuthDiscovery?: boolean | null
              /**
               * chapAuthSession defines whether support iSCSI Session CHAP authentication
               */
              chapAuthSession?: boolean | null
              /**
               * fsType is the filesystem type of the volume that you want to mount. Tip: Ensure that the filesystem type is supported by the host operating system. Examples: "ext4", "xfs", "ntfs". Implicitly inferred to be "ext4" if unspecified. More info: https://kubernetes.io/docs/concepts/storage/volumes#iscsi
               */
              fsType?: string | null
              /**
               * initiatorName is the custom iSCSI Initiator Name. If initiatorName is specified with iscsiInterface simultaneously, new iSCSI interface <target portal>:<volume name> will be created for the connection.
               */
              initiatorName?: string | null
              /**
               * iqn is the target iSCSI Qualified Name.
               */
              iqn: string
              /**
               * iscsiInterface is the interface Name that uses an iSCSI transport. Defaults to 'default' (tcp).
               */
              iscsiInterface?: string | null
              /**
               * lun represents iSCSI Target Lun number.
               */
              lun: number
              /**
               * portals is the iSCSI Target Portal List. The portal is either an IP or ip_addr:port if the port is other than default (typically TCP ports 860 and 3260).
               */
              portals?: (string | null)[] | null
              /**
               * readOnly here will force the ReadOnly setting in VolumeMounts. Defaults to false.
               */
              readOnly?: boolean | null
              /**
               * LocalObjectReference contains enough information to let you locate the referenced object inside the same namespace.
               */
              secretRef?: {
                /**
                 * Name of the referent. More info: https://kubernetes.io/docs/concepts/overview/working-with-objects/names/#names
                 */
                name?: string | null
              } | null
              /**
               * targetPortal is iSCSI Target Portal. The Portal is either an IP or ip_addr:port if the port is other than default (typically TCP ports 860 and 3260).
               */
              targetPortal: string
            } | null
            /**
             * name of the volume. Must be a DNS_LABEL and unique within the pod. More info: https://kubernetes.io/docs/concepts/overview/working-with-objects/names/#names
             */
            name: string
            /**
             * Represents an NFS mount that lasts the lifetime of a pod. NFS volumes do not support ownership management or SELinux relabeling.
             */
            nfs?: {
              /**
               * path that is exported by the NFS server. More info: https://kubernetes.io/docs/concepts/storage/volumes#nfs
               */
              path: string
              /**
               * readOnly here will force the NFS export to be mounted with read-only permissions. Defaults to false. More info: https://kubernetes.io/docs/concepts/storage/volumes#nfs
               */
              readOnly?: boolean | null
              /**
               * server is the hostname or IP address of the NFS server. More info: https://kubernetes.io/docs/concepts/storage/volumes#nfs
               */
              server: string
            } | null
            /**
             * PersistentVolumeClaimVolumeSource references the user's PVC in the same namespace. This volume finds the bound PV and mounts that volume for the pod. A PersistentVolumeClaimVolumeSource is, essentially, a wrapper around another type of volume that is owned by someone else (the system).
             */
            persistentVolumeClaim?: {
              /**
               * claimName is the name of a PersistentVolumeClaim in the same namespace as the pod using this volume. More info: https://kubernetes.io/docs/concepts/storage/persistent-volumes#persistentvolumeclaims
               */
              claimName: string
              /**
               * readOnly Will force the ReadOnly setting in VolumeMounts. Default false.
               */
              readOnly?: boolean | null
            } | null
            /**
             * Represents a Photon Controller persistent disk resource.
             */
            photonPersistentDisk?: {
              /**
               * fsType is the filesystem type to mount. Must be a filesystem type supported by the host operating system. Ex. "ext4", "xfs", "ntfs". Implicitly inferred to be "ext4" if unspecified.
               */
              fsType?: string | null
              /**
               * pdID is the ID that identifies Photon Controller persistent disk
               */
              pdID: string
            } | null
            /**
             * PortworxVolumeSource represents a Portworx volume resource.
             */
            portworxVolume?: {
              /**
               * fSType represents the filesystem type to mount Must be a filesystem type supported by the host operating system. Ex. "ext4", "xfs". Implicitly inferred to be "ext4" if unspecified.
               */
              fsType?: string | null
              /**
               * readOnly defaults to false (read/write). ReadOnly here will force the ReadOnly setting in VolumeMounts.
               */
              readOnly?: boolean | null
              /**
               * volumeID uniquely identifies a Portworx volume
               */
              volumeID: string
            } | null
            /**
             * Represents a projected volume source
             */
            projected?: {
              /**
               * defaultMode are the mode bits used to set permissions on created files by default. Must be an octal value between 0000 and 0777 or a decimal value between 0 and 511. YAML accepts both octal and decimal values, JSON requires decimal values for mode bits. Directories within the path are not affected by this setting. This might be in conflict with other options that affect the file mode, like fsGroup, and the result can be other mode bits set.
               */
              defaultMode?: number | null
              /**
               * sources is the list of volume projections
               */
              sources?:
                | ({
                    /**
                     * ClusterTrustBundleProjection describes how to select a set of ClusterTrustBundle objects and project their contents into the pod filesystem.
                     */
                    clusterTrustBundle?: {
                      /**
                       * A label selector is a label query over a set of resources. The result of matchLabels and matchExpressions are ANDed. An empty label selector matches all objects. A null label selector matches no objects.
                       */
                      labelSelector?: {
                        /**
                         * matchExpressions is a list of label selector requirements. The requirements are ANDed.
                         */
                        matchExpressions?:
                          | ({
                              /**
                               * key is the label key that the selector applies to.
                               */
                              key: string
                              /**
                               * operator represents a key's relationship to a set of values. Valid operators are In, NotIn, Exists and DoesNotExist.
                               */
                              operator: string
                              /**
                               * values is an array of string values. If the operator is In or NotIn, the values array must be non-empty. If the operator is Exists or DoesNotExist, the values array must be empty. This array is replaced during a strategic merge patch.
                               */
                              values?: (string | null)[] | null
                            } | null)[]
                          | null
                        /**
                         * matchLabels is a map of {key,value} pairs. A single {key,value} in the matchLabels map is equivalent to an element of matchExpressions, whose key field is "key", the operator is "In", and the values array contains only "value". The requirements are ANDed.
                         */
                        matchLabels?: {
                          [k: string]: string | null
                        } | null
                      } | null
                      /**
                       * Select a single ClusterTrustBundle by object name.  Mutually-exclusive with signerName and labelSelector.
                       */
                      name?: string | null
                      /**
                       * If true, don't block pod startup if the referenced ClusterTrustBundle(s) aren't available.  If using name, then the named ClusterTrustBundle is allowed not to exist.  If using signerName, then the combination of signerName and labelSelector is allowed to match zero ClusterTrustBundles.
                       */
                      optional?: boolean | null
                      /**
                       * Relative path from the volume root to write the bundle.
                       */
                      path: string
                      /**
                       * Select all ClusterTrustBundles that match this signer name. Mutually-exclusive with name.  The contents of all selected ClusterTrustBundles will be unified and deduplicated.
                       */
                      signerName?: string | null
                    } | null
                    /**
                     * Adapts a ConfigMap into a projected volume.
                     *
                     * The contents of the target ConfigMap's Data field will be presented in a projected volume as files using the keys in the Data field as the file names, unless the items element is populated with specific mappings of keys to paths. Note that this is identical to a configmap volume source without the default mode.
                     */
                    configMap?: {
                      /**
                       * items if unspecified, each key-value pair in the Data field of the referenced ConfigMap will be projected into the volume as a file whose name is the key and content is the value. If specified, the listed keys will be projected into the specified paths, and unlisted keys will not be present. If a key is specified which is not present in the ConfigMap, the volume setup will error unless it is marked optional. Paths must be relative and may not contain the '..' path or start with '..'.
                       */
                      items?:
                        | ({
                            /**
                             * key is the key to project.
                             */
                            key: string
                            /**
                             * mode is Optional: mode bits used to set permissions on this file. Must be an octal value between 0000 and 0777 or a decimal value between 0 and 511. YAML accepts both octal and decimal values, JSON requires decimal values for mode bits. If not specified, the volume defaultMode will be used. This might be in conflict with other options that affect the file mode, like fsGroup, and the result can be other mode bits set.
                             */
                            mode?: number | null
                            /**
                             * path is the relative path of the file to map the key to. May not be an absolute path. May not contain the path element '..'. May not start with the string '..'.
                             */
                            path: string
                          } | null)[]
                        | null
                      /**
                       * Name of the referent. More info: https://kubernetes.io/docs/concepts/overview/working-with-objects/names/#names
                       */
                      name?: string | null
                      /**
                       * optional specify whether the ConfigMap or its keys must be defined
                       */
                      optional?: boolean | null
                    } | null
                    /**
                     * Represents downward API info for projecting into a projected volume. Note that this is identical to a downwardAPI volume source without the default mode.
                     */
                    downwardAPI?: {
                      /**
                       * Items is a list of DownwardAPIVolume file
                       */
                      items?:
                        | ({
                            /**
                             * ObjectFieldSelector selects an APIVersioned field of an object.
                             */
                            fieldRef?: {
                              /**
                               * Version of the schema the FieldPath is written in terms of, defaults to "v1".
                               */
                              apiVersion?: string | null
                              /**
                               * Path of the field to select in the specified API version.
                               */
                              fieldPath: string
                            } | null
                            /**
                             * Optional: mode bits used to set permissions on this file, must be an octal value between 0000 and 0777 or a decimal value between 0 and 511. YAML accepts both octal and decimal values, JSON requires decimal values for mode bits. If not specified, the volume defaultMode will be used. This might be in conflict with other options that affect the file mode, like fsGroup, and the result can be other mode bits set.
                             */
                            mode?: number | null
                            /**
                             * Required: Path is  the relative path name of the file to be created. Must not be absolute or contain the '..' path. Must be utf-8 encoded. The first item of the relative path must not start with '..'
                             */
                            path: string
                            /**
                             * ResourceFieldSelector represents container resources (cpu, memory) and their output format
                             */
                            resourceFieldRef?: {
                              /**
                               * Container name: required for volumes, optional for env vars
                               */
                              containerName?: string | null
                              divisor?: (string | null) | (number | null)
                              /**
                               * Required: resource to select
                               */
                              resource: string
                            } | null
                          } | null)[]
                        | null
                    } | null
                    /**
                     * Adapts a secret into a projected volume.
                     *
                     * The contents of the target Secret's Data field will be presented in a projected volume as files using the keys in the Data field as the file names. Note that this is identical to a secret volume source without the default mode.
                     */
                    secret?: {
                      /**
                       * items if unspecified, each key-value pair in the Data field of the referenced Secret will be projected into the volume as a file whose name is the key and content is the value. If specified, the listed keys will be projected into the specified paths, and unlisted keys will not be present. If a key is specified which is not present in the Secret, the volume setup will error unless it is marked optional. Paths must be relative and may not contain the '..' path or start with '..'.
                       */
                      items?:
                        | ({
                            /**
                             * key is the key to project.
                             */
                            key: string
                            /**
                             * mode is Optional: mode bits used to set permissions on this file. Must be an octal value between 0000 and 0777 or a decimal value between 0 and 511. YAML accepts both octal and decimal values, JSON requires decimal values for mode bits. If not specified, the volume defaultMode will be used. This might be in conflict with other options that affect the file mode, like fsGroup, and the result can be other mode bits set.
                             */
                            mode?: number | null
                            /**
                             * path is the relative path of the file to map the key to. May not be an absolute path. May not contain the path element '..'. May not start with the string '..'.
                             */
                            path: string
                          } | null)[]
                        | null
                      /**
                       * Name of the referent. More info: https://kubernetes.io/docs/concepts/overview/working-with-objects/names/#names
                       */
                      name?: string | null
                      /**
                       * optional field specify whether the Secret or its key must be defined
                       */
                      optional?: boolean | null
                    } | null
                    /**
                     * ServiceAccountTokenProjection represents a projected service account token volume. This projection can be used to insert a service account token into the pods runtime filesystem for use against APIs (Kubernetes API Server or otherwise).
                     */
                    serviceAccountToken?: {
                      /**
                       * audience is the intended audience of the token. A recipient of a token must identify itself with an identifier specified in the audience of the token, and otherwise should reject the token. The audience defaults to the identifier of the apiserver.
                       */
                      audience?: string | null
                      /**
                       * expirationSeconds is the requested duration of validity of the service account token. As the token approaches expiration, the kubelet volume plugin will proactively rotate the service account token. The kubelet will start trying to rotate the token if the token is older than 80 percent of its time to live or if the token is older than 24 hours.Defaults to 1 hour and must be at least 10 minutes.
                       */
                      expirationSeconds?: number | null
                      /**
                       * path is the path relative to the mount point of the file to project the token into.
                       */
                      path: string
                    } | null
                  } | null)[]
                | null
            } | null
            /**
             * Represents a Quobyte mount that lasts the lifetime of a pod. Quobyte volumes do not support ownership management or SELinux relabeling.
             */
            quobyte?: {
              /**
               * group to map volume access to Default is no group
               */
              group?: string | null
              /**
               * readOnly here will force the Quobyte volume to be mounted with read-only permissions. Defaults to false.
               */
              readOnly?: boolean | null
              /**
               * registry represents a single or multiple Quobyte Registry services specified as a string as host:port pair (multiple entries are separated with commas) which acts as the central registry for volumes
               */
              registry: string
              /**
               * tenant owning the given Quobyte volume in the Backend Used with dynamically provisioned Quobyte volumes, value is set by the plugin
               */
              tenant?: string | null
              /**
               * user to map volume access to Defaults to serivceaccount user
               */
              user?: string | null
              /**
               * volume is a string that references an already created Quobyte volume by name.
               */
              volume: string
            } | null
            /**
             * Represents a Rados Block Device mount that lasts the lifetime of a pod. RBD volumes support ownership management and SELinux relabeling.
             */
            rbd?: {
              /**
               * fsType is the filesystem type of the volume that you want to mount. Tip: Ensure that the filesystem type is supported by the host operating system. Examples: "ext4", "xfs", "ntfs". Implicitly inferred to be "ext4" if unspecified. More info: https://kubernetes.io/docs/concepts/storage/volumes#rbd
               */
              fsType?: string | null
              /**
               * image is the rados image name. More info: https://examples.k8s.io/volumes/rbd/README.md#how-to-use-it
               */
              image: string
              /**
               * keyring is the path to key ring for RBDUser. Default is /etc/ceph/keyring. More info: https://examples.k8s.io/volumes/rbd/README.md#how-to-use-it
               */
              keyring?: string | null
              /**
               * monitors is a collection of Ceph monitors. More info: https://examples.k8s.io/volumes/rbd/README.md#how-to-use-it
               */
              monitors: (string | null)[]
              /**
               * pool is the rados pool name. Default is rbd. More info: https://examples.k8s.io/volumes/rbd/README.md#how-to-use-it
               */
              pool?: string | null
              /**
               * readOnly here will force the ReadOnly setting in VolumeMounts. Defaults to false. More info: https://examples.k8s.io/volumes/rbd/README.md#how-to-use-it
               */
              readOnly?: boolean | null
              /**
               * LocalObjectReference contains enough information to let you locate the referenced object inside the same namespace.
               */
              secretRef?: {
                /**
                 * Name of the referent. More info: https://kubernetes.io/docs/concepts/overview/working-with-objects/names/#names
                 */
                name?: string | null
              } | null
              /**
               * user is the rados user name. Default is admin. More info: https://examples.k8s.io/volumes/rbd/README.md#how-to-use-it
               */
              user?: string | null
            } | null
            /**
             * ScaleIOVolumeSource represents a persistent ScaleIO volume
             */
            scaleIO?: {
              /**
               * fsType is the filesystem type to mount. Must be a filesystem type supported by the host operating system. Ex. "ext4", "xfs", "ntfs". Default is "xfs".
               */
              fsType?: string | null
              /**
               * gateway is the host address of the ScaleIO API Gateway.
               */
              gateway: string
              /**
               * protectionDomain is the name of the ScaleIO Protection Domain for the configured storage.
               */
              protectionDomain?: string | null
              /**
               * readOnly Defaults to false (read/write). ReadOnly here will force the ReadOnly setting in VolumeMounts.
               */
              readOnly?: boolean | null
              /**
               * LocalObjectReference contains enough information to let you locate the referenced object inside the same namespace.
               */
              secretRef: {
                /**
                 * Name of the referent. More info: https://kubernetes.io/docs/concepts/overview/working-with-objects/names/#names
                 */
                name?: string | null
              }
              /**
               * sslEnabled Flag enable/disable SSL communication with Gateway, default false
               */
              sslEnabled?: boolean | null
              /**
               * storageMode indicates whether the storage for a volume should be ThickProvisioned or ThinProvisioned. Default is ThinProvisioned.
               */
              storageMode?: string | null
              /**
               * storagePool is the ScaleIO Storage Pool associated with the protection domain.
               */
              storagePool?: string | null
              /**
               * system is the name of the storage system as configured in ScaleIO.
               */
              system: string
              /**
               * volumeName is the name of a volume already created in the ScaleIO system that is associated with this volume source.
               */
              volumeName?: string | null
            } | null
            /**
             * Adapts a Secret into a volume.
             *
             * The contents of the target Secret's Data field will be presented in a volume as files using the keys in the Data field as the file names. Secret volumes support ownership management and SELinux relabeling.
             */
            secret?: {
              /**
               * defaultMode is Optional: mode bits used to set permissions on created files by default. Must be an octal value between 0000 and 0777 or a decimal value between 0 and 511. YAML accepts both octal and decimal values, JSON requires decimal values for mode bits. Defaults to 0644. Directories within the path are not affected by this setting. This might be in conflict with other options that affect the file mode, like fsGroup, and the result can be other mode bits set.
               */
              defaultMode?: number | null
              /**
               * items If unspecified, each key-value pair in the Data field of the referenced Secret will be projected into the volume as a file whose name is the key and content is the value. If specified, the listed keys will be projected into the specified paths, and unlisted keys will not be present. If a key is specified which is not present in the Secret, the volume setup will error unless it is marked optional. Paths must be relative and may not contain the '..' path or start with '..'.
               */
              items?:
                | ({
                    /**
                     * key is the key to project.
                     */
                    key: string
                    /**
                     * mode is Optional: mode bits used to set permissions on this file. Must be an octal value between 0000 and 0777 or a decimal value between 0 and 511. YAML accepts both octal and decimal values, JSON requires decimal values for mode bits. If not specified, the volume defaultMode will be used. This might be in conflict with other options that affect the file mode, like fsGroup, and the result can be other mode bits set.
                     */
                    mode?: number | null
                    /**
                     * path is the relative path of the file to map the key to. May not be an absolute path. May not contain the path element '..'. May not start with the string '..'.
                     */
                    path: string
                  } | null)[]
                | null
              /**
               * optional field specify whether the Secret or its keys must be defined
               */
              optional?: boolean | null
              /**
               * secretName is the name of the secret in the pod's namespace to use. More info: https://kubernetes.io/docs/concepts/storage/volumes#secret
               */
              secretName?: string | null
            } | null
            /**
             * Represents a StorageOS persistent volume resource.
             */
            storageos?: {
              /**
               * fsType is the filesystem type to mount. Must be a filesystem type supported by the host operating system. Ex. "ext4", "xfs", "ntfs". Implicitly inferred to be "ext4" if unspecified.
               */
              fsType?: string | null
              /**
               * readOnly defaults to false (read/write). ReadOnly here will force the ReadOnly setting in VolumeMounts.
               */
              readOnly?: boolean | null
              /**
               * LocalObjectReference contains enough information to let you locate the referenced object inside the same namespace.
               */
              secretRef?: {
                /**
                 * Name of the referent. More info: https://kubernetes.io/docs/concepts/overview/working-with-objects/names/#names
                 */
                name?: string | null
              } | null
              /**
               * volumeName is the human-readable name of the StorageOS volume.  Volume names are only unique within a namespace.
               */
              volumeName?: string | null
              /**
               * volumeNamespace specifies the scope of the volume within StorageOS.  If no namespace is specified then the Pod's namespace will be used.  This allows the Kubernetes name scoping to be mirrored within StorageOS for tighter integration. Set VolumeName to any name to override the default behaviour. Set to "default" if you are not using namespaces within StorageOS. Namespaces that do not pre-exist within StorageOS will be created.
               */
              volumeNamespace?: string | null
            } | null
            /**
             * Represents a vSphere volume resource.
             */
            vsphereVolume?: {
              /**
               * fsType is filesystem type to mount. Must be a filesystem type supported by the host operating system. Ex. "ext4", "xfs", "ntfs". Implicitly inferred to be "ext4" if unspecified.
               */
              fsType?: string | null
              /**
               * storagePolicyID is the storage Policy Based Management (SPBM) profile ID associated with the StoragePolicyName.
               */
              storagePolicyID?: string | null
              /**
               * storagePolicyName is the storage Policy Based Management (SPBM) profile name.
               */
              storagePolicyName?: string | null
              /**
               * volumePath is the path that identifies vSphere volume vmdk
               */
              volumePath: string
            } | null
          } | null)[]
        | null
    } | null
  }
  /**
   * ttlSecondsAfterFinished limits the lifetime of a Job that has finished execution (either Complete or Failed). If this field is set, ttlSecondsAfterFinished after the Job finishes, it is eligible to be automatically deleted. When the Job is being deleted, its lifecycle guarantees (e.g. finalizers) will be honored. If this field is unset, the Job won't be automatically deleted. If this field is set to zero, the Job becomes eligible to be deleted immediately after it finishes.
   */
  ttlSecondsAfterFinished?: number | null
};

type JobDetailsStatus = {
  /**
   * The number of pending and running pods.
   */
  active?: number | null
  /**
   * completedIndexes holds the completed indexes when .spec.completionMode = "Indexed" in a text format. The indexes are represented as decimal integers separated by commas. The numbers are listed in increasing order. Three or more consecutive numbers are compressed and represented by the first and last element of the series, separated by a hyphen. For example, if the completed indexes are 1, 3, 4, 5 and 7, they are represented as "1,3-5,7".
   */
  completedIndexes?: string | null
  /**
   * Time is a wrapper around time.Time which supports correct marshaling to YAML and JSON.  Wrappers are provided for many of the factory methods that the time package offers.
   */
  completionTime?: string | null
  /**
   * The latest available observations of an object's current state. When a Job fails, one of the conditions will have type "Failed" and status true. When a Job is suspended, one of the conditions will have type "Suspended" and status true; when the Job is resumed, the status of this condition will become false. When a Job is completed, one of the conditions will have type "Complete" and status true. More info: https://kubernetes.io/docs/concepts/workloads/controllers/jobs-run-to-completion/
   */
  conditions?:
    | ({
        /**
         * Time is a wrapper around time.Time which supports correct marshaling to YAML and JSON.  Wrappers are provided for many of the factory methods that the time package offers.
         */
        lastProbeTime?: string | null
        /**
         * Time is a wrapper around time.Time which supports correct marshaling to YAML and JSON.  Wrappers are provided for many of the factory methods that the time package offers.
         */
        lastTransitionTime?: string | null
        /**
         * Human readable message indicating details about last transition.
         */
        message?: string | null
        /**
         * (brief) reason for the condition's last transition.
         */
        reason?: string | null
        /**
         * Status of the condition, one of True, False, Unknown.
         */
        status: string
        /**
         * Type of job condition, Complete or Failed.
         */
        type: string
      } | null)[]
    | null
  /**
   * The number of pods which reached phase Failed.
   */
  failed?: number | null
  /**
   * FailedIndexes holds the failed indexes when backoffLimitPerIndex=true. The indexes are represented in the text format analogous as for the `completedIndexes` field, ie. they are kept as decimal integers separated by commas. The numbers are listed in increasing order. Three or more consecutive numbers are compressed and represented by the first and last element of the series, separated by a hyphen. For example, if the failed indexes are 1, 3, 4, 5 and 7, they are represented as "1,3-5,7". This field is beta-level. It can be used when the `JobBackoffLimitPerIndex` feature gate is enabled (enabled by default).
   */
  failedIndexes?: string | null
  /**
   * The number of pods which have a Ready condition.
   */
  ready?: number | null
  /**
   * Time is a wrapper around time.Time which supports correct marshaling to YAML and JSON.  Wrappers are provided for many of the factory methods that the time package offers.
   */
  startTime?: string | null
  /**
   * The number of pods which reached phase Succeeded.
   */
  succeeded?: number | null
  /**
   * The number of pods which are terminating (in phase Pending or Running and have a deletionTimestamp).
   *
   * This field is beta-level. The job controller populates the field when the feature gate JobPodReplacementPolicy is enabled (enabled by default).
   */
  terminating?: number | null
  /**
   * UncountedTerminatedPods holds UIDs of Pods that have terminated but haven't been accounted in Job status counters.
   */
  uncountedTerminatedPods?: {
    /**
     * failed holds UIDs of failed Pods.
     */
    failed?: (string | null)[] | null
    /**
     * succeeded holds UIDs of succeeded Pods.
     */
    succeeded?: (string | null)[] | null
  } | null
} 
/**
* Job represents the configuration of a single job.
*/

type JobDetails = {
 /**
  * APIVersion defines the versioned schema of this representation of an object. Servers should convert recognized schemas to the latest internal value, and may reject unrecognized values. More info: https://git.k8s.io/community/contributors/devel/sig-architecture/api-conventions.md#resources
  */
 apiVersion: "batch/v1";
 /**
  * Kind is a string value representing the REST resource this object represents. Servers may infer this from the endpoint the client submits requests to. Cannot be updated. In CamelCase. More info: https://git.k8s.io/community/contributors/devel/sig-architecture/api-conventions.md#types-kinds
  */
 kind: "Job";
 /**
  * ObjectMeta is metadata that all persisted resources must have, which includes all objects users must create.
  */
 metadata: JobDetailsMetada;
 /**
  * JobSpec describes how the job execution will look like.
  */
 spec: JobDetailsSpec;
 /**
  * JobStatus represents the current state of a Job.
  */
 status: JobDetailsStatus;
}

export {
  Jobs,
  JobsHeader,
  JobsResponse,
  JobDetails,
  JobDetailsMetada,
  JobDetailsSpec,
  JobDetailsStatus
};