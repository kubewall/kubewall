type PersistentVolumeClaimsResponse = {
  namespace: string;
  name: string;
  age: string;
  spec: {
    volumeName: string;
    storageClassName: string;
    volumeMode: string;
    storage: string;
  },
  status: {
    phase: string;
  }
  hasUpdated: boolean;
};

type PersistentVolumeClaimsHeaders = {
  namespace: string;
  name: string;
  age: string;
  volumeName: string;
  storageClassName: string;
  volumeMode: string;
  storage: string;
  phase: string;
};

type PersistentVolumeClaimDetailsMetadata = {
  /**
   * Annotations is an unstructured key value map stored with a resource that may be set by external tools to store and retrieve arbitrary metadata. They are not queryable and should be preserved when modifying objects. More info: https://kubernetes.io/docs/concepts/overview/working-with-objects/annotations
   */
  annotations?: {
    [k: string]: string | null;
  } | null;
  /**
   * Time is a wrapper around time.Time which supports correct marshaling to YAML and JSON.  Wrappers are provided for many of the factory methods that the time package offers.
   */
  creationTimestamp?: string | null;
  /**
   * Number of seconds allowed for this object to gracefully terminate before it will be removed from the system. Only set when deletionTimestamp is also set. May only be shortened. Read-only.
   */
  deletionGracePeriodSeconds?: number | null;
  /**
   * Time is a wrapper around time.Time which supports correct marshaling to YAML and JSON.  Wrappers are provided for many of the factory methods that the time package offers.
   */
  deletionTimestamp?: string | null;
  /**
   * Must be empty before the object is deleted from the registry. Each entry is an identifier for the responsible component that will remove the entry from the list. If the deletionTimestamp of the object is non-nil, entries in this list can only be removed. Finalizers may be processed and removed in any order.  Order is NOT enforced because it introduces significant risk of stuck finalizers. finalizers is a shared field, any actor with permission can reorder it. If the finalizer list is processed in order, then this can lead to a situation in which the component responsible for the first finalizer in the list is waiting for a signal (field value, external system, or other) produced by a component responsible for a finalizer later in the list, resulting in a deadlock. Without enforced ordering finalizers are free to order amongst themselves and are not vulnerable to ordering changes in the list.
   */
  finalizers?: (string | null)[] | null;
  /**
   * GenerateName is an optional prefix, used by the server, to generate a unique name ONLY IF the Name field has not been provided. If this field is used, the name returned to the client will be different than the name passed. This value will also be combined with a unique suffix. The provided value has the same validation rules as the Name field, and may be truncated by the length of the suffix required to make the value unique on the server.
   *
   * If this field is specified and the generated name exists, the server will return a 409.
   *
   * Applied only if Name is not specified. More info: https://git.k8s.io/community/contributors/devel/sig-architecture/api-conventions.md#idempotency
   */
  generateName?: string | null;
  /**
   * A sequence number representing a specific generation of the desired state. Populated by the system. Read-only.
   */
  generation?: number | null;
  /**
   * Map of string keys and values that can be used to organize and categorize (scope and select) objects. May match selectors of replication controllers and services. More info: https://kubernetes.io/docs/concepts/overview/working-with-objects/labels
   */
  labels?: {
    [k: string]: string | null;
  } | null;
  /**
   * ManagedFields maps workflow-id and version to the set of fields that are managed by that workflow. This is mostly for internal housekeeping, and users typically shouldn't need to set or understand this field. A workflow can be the user's name, a controller's name, or the name of a specific apply path like "ci-cd". The set of fields is always in the version that the workflow used when modifying the object.
   */
  managedFields?:
    | ({
        /**
         * APIVersion defines the version of this resource that this field set applies to. The format is "group/version" just like the top-level APIVersion field. It is necessary to track the version of a field set because it cannot be automatically converted.
         */
        apiVersion?: string | null;
        /**
         * FieldsType is the discriminator for the different fields format and version. There is currently only one possible value: "FieldsV1"
         */
        fieldsType?: string | null;
        /**
         * FieldsV1 stores a set of fields in a data structure like a Trie, in JSON format.
         *
         * Each key is either a '.' representing the field itself, and will always map to an empty set, or a string representing a sub-field or item. The string will follow one of these four formats: 'f:<name>', where <name> is the name of a field in a struct, or key in a map 'v:<value>', where <value> is the exact json formatted value of a list item 'i:<index>', where <index> is position of a item in a list 'k:<keys>', where <keys> is a map of  a list item's key fields to their unique values If a key maps to an empty Fields value, the field that key represents is part of the set.
         *
         * The exact format is defined in sigs.k8s.io/structured-merge-diff
         */
        fieldsV1?: {
          [k: string]: unknown;
        } | null;
        /**
         * Manager is an identifier of the workflow managing these fields.
         */
        manager?: string | null;
        /**
         * Operation is the type of operation which lead to this ManagedFieldsEntry being created. The only valid values for this field are 'Apply' and 'Update'.
         */
        operation?: string | null;
        /**
         * Subresource is the name of the subresource used to update that object, or empty string if the object was updated through the main resource. The value of this field is used to distinguish between managers, even if they share the same name. For example, a status update will be distinct from a regular update using the same manager name. Note that the APIVersion field is not related to the Subresource field and it always corresponds to the version of the main resource.
         */
        subresource?: string | null;
        /**
         * Time is a wrapper around time.Time which supports correct marshaling to YAML and JSON.  Wrappers are provided for many of the factory methods that the time package offers.
         */
        time?: string | null;
        [k: string]: unknown;
      } | null)[]
    | null;
  /**
   * Name must be unique within a namespace. Is required when creating resources, although some resources may allow a client to request the generation of an appropriate name automatically. Name is primarily intended for creation idempotence and configuration definition. Cannot be updated. More info: https://kubernetes.io/docs/concepts/overview/working-with-objects/names#names
   */
  name?: string | null;
  /**
   * Namespace defines the space within which each name must be unique. An empty namespace is equivalent to the "default" namespace, but "default" is the canonical representation. Not all objects are required to be scoped to a namespace - the value of this field for those objects will be empty.
   *
   * Must be a DNS_LABEL. Cannot be updated. More info: https://kubernetes.io/docs/concepts/overview/working-with-objects/namespaces
   */
  namespace?: string | null;
  /**
   * List of objects depended by this object. If ALL objects in the list have been deleted, this object will be garbage collected. If this object is managed by a controller, then an entry in this list will point to this controller, with the controller field set to true. There cannot be more than one managing controller.
   */
  ownerReferences?:
    | ({
        /**
         * API version of the referent.
         */
        apiVersion: string;
        /**
         * If true, AND if the owner has the "foregroundDeletion" finalizer, then the owner cannot be deleted from the key-value store until this reference is removed. See https://kubernetes.io/docs/concepts/architecture/garbage-collection/#foreground-deletion for how the garbage collector interacts with this field and enforces the foreground deletion. Defaults to false. To set this field, a user needs "delete" permission of the owner, otherwise 422 (Unprocessable Entity) will be returned.
         */
        blockOwnerDeletion?: boolean | null;
        /**
         * If true, this reference points to the managing controller.
         */
        controller?: boolean | null;
        /**
         * Kind of the referent. More info: https://git.k8s.io/community/contributors/devel/sig-architecture/api-conventions.md#types-kinds
         */
        kind: string;
        /**
         * Name of the referent. More info: https://kubernetes.io/docs/concepts/overview/working-with-objects/names#names
         */
        name: string;
        /**
         * UID of the referent. More info: https://kubernetes.io/docs/concepts/overview/working-with-objects/names#uids
         */
        uid: string;
        [k: string]: unknown;
      } | null)[]
    | null;
  /**
   * An opaque value that represents the internal version of this object that can be used by clients to determine when objects have changed. May be used for optimistic concurrency, change detection, and the watch operation on a resource or set of resources. Clients must treat these values as opaque and passed unmodified back to the server. They may only be valid for a particular resource or set of resources.
   *
   * Populated by the system. Read-only. Value must be treated as opaque by clients and . More info: https://git.k8s.io/community/contributors/devel/sig-architecture/api-conventions.md#concurrency-control-and-consistency
   */
  resourceVersion?: string | null;
  /**
   * Deprecated: selfLink is a legacy read-only field that is no longer populated by the system.
   */
  selfLink?: string | null;
  /**
   * UID is the unique in time and space value for this object. It is typically generated by the server on successful creation of a resource and is not allowed to change on PUT operations.
   *
   * Populated by the system. Read-only. More info: https://kubernetes.io/docs/concepts/overview/working-with-objects/names#uids
   */
  uid?: string | null;
  [k: string]: unknown;
};

type PersistentVolumeClaimDetailsSpec = {
  /**
   * accessModes contains the desired access modes the volume should have. More info: https://kubernetes.io/docs/concepts/storage/persistent-volumes#access-modes-1
   */
  accessModes?: (string | null)[] | null;
  /**
   * TypedLocalObjectReference contains enough information to let you locate the typed referenced object inside the same namespace.
   */
  dataSource?: {
    /**
     * APIGroup is the group for the resource being referenced. If APIGroup is not specified, the specified Kind must be in the core API group. For any other third-party types, APIGroup is required.
     */
    apiGroup?: string | null;
    /**
     * Kind is the type of resource being referenced
     */
    kind: string;
    /**
     * Name is the name of resource being referenced
     */
    name: string;
    [k: string]: unknown;
  } | null;
  dataSourceRef?: {
    /**
     * APIGroup is the group for the resource being referenced. If APIGroup is not specified, the specified Kind must be in the core API group. For any other third-party types, APIGroup is required.
     */
    apiGroup?: string | null;
    /**
     * Kind is the type of resource being referenced
     */
    kind: string;
    /**
     * Name is the name of resource being referenced
     */
    name: string;
    /**
     * Namespace is the namespace of resource being referenced Note that when a namespace is specified, a gateway.networking.k8s.io/ReferenceGrant object is required in the referent namespace to allow that namespace's owner to accept the reference. See the ReferenceGrant documentation for details. (Alpha) This field requires the CrossNamespaceVolumeDataSource feature gate to be enabled.
     */
    namespace?: string | null;
    [k: string]: unknown;
  } | null;
  /**
   * VolumeResourceRequirements describes the storage resource requirements for a volume.
   */
  resources?: {
    /**
     * Limits describes the maximum amount of compute resources allowed. More info: https://kubernetes.io/docs/concepts/configuration/manage-resources-containers/
     */
    limits?: {
      [k: string]: (string | null) | (number | null);
    } | null;
    /**
     * Requests describes the minimum amount of compute resources required. If Requests is omitted for a container, it defaults to Limits if that is explicitly specified, otherwise to an implementation-defined value. Requests cannot exceed Limits. More info: https://kubernetes.io/docs/concepts/configuration/manage-resources-containers/
     */
    requests?: {
      [k: string]: (string | null) | (number | null);
    } | null;
    [k: string]: unknown;
  } | null;
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
          key: string;
          /**
           * operator represents a key's relationship to a set of values. Valid operators are In, NotIn, Exists and DoesNotExist.
           */
          operator: string;
          /**
           * values is an array of string values. If the operator is In or NotIn, the values array must be non-empty. If the operator is Exists or DoesNotExist, the values array must be empty. This array is replaced during a strategic merge patch.
           */
          values?: (string | null)[] | null;
          [k: string]: unknown;
        } | null)[]
      | null;
    /**
     * matchLabels is a map of {key,value} pairs. A single {key,value} in the matchLabels map is equivalent to an element of matchExpressions, whose key field is "key", the operator is "In", and the values array contains only "value". The requirements are ANDed.
     */
    matchLabels?: {
      [k: string]: string | null;
    } | null;
    [k: string]: unknown;
  } | null;
  /**
   * storageClassName is the name of the StorageClass required by the claim. More info: https://kubernetes.io/docs/concepts/storage/persistent-volumes#class-1
   */
  storageClassName?: string | null;
  /**
   * volumeAttributesClassName may be used to set the VolumeAttributesClass used by this claim. If specified, the CSI driver will create or update the volume with the attributes defined in the corresponding VolumeAttributesClass. This has a different purpose than storageClassName, it can be changed after the claim is created. An empty string value means that no VolumeAttributesClass will be applied to the claim but it's not allowed to reset this field to empty string once it is set. If unspecified and the PersistentVolumeClaim is unbound, the default VolumeAttributesClass will be set by the persistentvolume controller if it exists. If the resource referred to by volumeAttributesClass does not exist, this PersistentVolumeClaim will be set to a Pending state, as reflected by the modifyVolumeStatus field, until such as a resource exists. More info: https://kubernetes.io/docs/concepts/storage/volume-attributes-classes/ (Alpha) Using this field requires the VolumeAttributesClass feature gate to be enabled.
   */
  volumeAttributesClassName?: string | null;
  /**
   * volumeMode defines what type of volume is required by the claim. Value of Filesystem is implied when not included in claim spec.
   */
  volumeMode?: string | null;
  /**
   * volumeName is the binding reference to the PersistentVolume backing this claim.
   */
  volumeName?: string | null;
  [k: string]: unknown;
};

type PersistentVolumeClaimDetailsStatus = {
  /**
   * accessModes contains the actual access modes the volume backing the PVC has. More info: https://kubernetes.io/docs/concepts/storage/persistent-volumes#access-modes-1
   */
  accessModes?: (string | null)[] | null;
  /**
   * allocatedResourceStatuses stores status of resource being resized for the given PVC. Key names follow standard Kubernetes label syntax. Valid values are either:
   * 	* Un-prefixed keys:
   * 		- storage - the capacity of the volume.
   * 	* Custom resources must use implementation-defined prefixed names such as "example.com/my-custom-resource"
   * Apart from above values - keys that are unprefixed or have kubernetes.io prefix are considered reserved and hence may not be used.
   *
   * ClaimResourceStatus can be in any of following states:
   * 	- ControllerResizeInProgress:
   * 		State set when resize controller starts resizing the volume in control-plane.
   * 	- ControllerResizeFailed:
   * 		State set when resize has failed in resize controller with a terminal error.
   * 	- NodeResizePending:
   * 		State set when resize controller has finished resizing the volume but further resizing of
   * 		volume is needed on the node.
   * 	- NodeResizeInProgress:
   * 		State set when kubelet starts resizing the volume.
   * 	- NodeResizeFailed:
   * 		State set when resizing has failed in kubelet with a terminal error. Transient errors don't set
   * 		NodeResizeFailed.
   * For example: if expanding a PVC for more capacity - this field can be one of the following states:
   * 	- pvc.status.allocatedResourceStatus['storage'] = "ControllerResizeInProgress"
   *      - pvc.status.allocatedResourceStatus['storage'] = "ControllerResizeFailed"
   *      - pvc.status.allocatedResourceStatus['storage'] = "NodeResizePending"
   *      - pvc.status.allocatedResourceStatus['storage'] = "NodeResizeInProgress"
   *      - pvc.status.allocatedResourceStatus['storage'] = "NodeResizeFailed"
   * When this field is not set, it means that no resize operation is in progress for the given PVC.
   *
   * A controller that receives PVC update with previously unknown resourceName or ClaimResourceStatus should ignore the update for the purpose it was designed. For example - a controller that only is responsible for resizing capacity of the volume, should ignore PVC updates that change other valid resources associated with PVC.
   *
   * This is an alpha field and requires enabling RecoverVolumeExpansionFailure feature.
   */
  allocatedResourceStatuses?: {
    [k: string]: string | null;
  } | null;
  /**
   * allocatedResources tracks the resources allocated to a PVC including its capacity. Key names follow standard Kubernetes label syntax. Valid values are either:
   * 	* Un-prefixed keys:
   * 		- storage - the capacity of the volume.
   * 	* Custom resources must use implementation-defined prefixed names such as "example.com/my-custom-resource"
   * Apart from above values - keys that are unprefixed or have kubernetes.io prefix are considered reserved and hence may not be used.
   *
   * Capacity reported here may be larger than the actual capacity when a volume expansion operation is requested. For storage quota, the larger value from allocatedResources and PVC.spec.resources is used. If allocatedResources is not set, PVC.spec.resources alone is used for quota calculation. If a volume expansion capacity request is lowered, allocatedResources is only lowered if there are no expansion operations in progress and if the actual volume capacity is equal or lower than the requested capacity.
   *
   * A controller that receives PVC update with previously unknown resourceName should ignore the update for the purpose it was designed. For example - a controller that only is responsible for resizing capacity of the volume, should ignore PVC updates that change other valid resources associated with PVC.
   *
   * This is an alpha field and requires enabling RecoverVolumeExpansionFailure feature.
   */
  allocatedResources?: {
    [k: string]: (string | null) | (number | null);
  } | null;
  /**
   * capacity represents the actual resources of the underlying volume.
   */
  capacity?: {
    [k: string]: (string | null) | (number | null);
  } | null;
  /**
   * conditions is the current Condition of persistent volume claim. If underlying persistent volume is being resized then the Condition will be set to 'Resizing'.
   */
  conditions?:
    | ({
        /**
         * Time is a wrapper around time.Time which supports correct marshaling to YAML and JSON.  Wrappers are provided for many of the factory methods that the time package offers.
         */
        lastProbeTime?: string | null;
        /**
         * Time is a wrapper around time.Time which supports correct marshaling to YAML and JSON.  Wrappers are provided for many of the factory methods that the time package offers.
         */
        lastTransitionTime?: string | null;
        /**
         * message is the human-readable message indicating details about last transition.
         */
        message?: string | null;
        /**
         * reason is a unique, this should be a short, machine understandable string that gives the reason for condition's last transition. If it reports "Resizing" that means the underlying persistent volume is being resized.
         */
        reason?: string | null;
        status: string;
        type: string;
      } | null)[]
    | null;
  /**
   * currentVolumeAttributesClassName is the current name of the VolumeAttributesClass the PVC is using. When unset, there is no VolumeAttributeClass applied to this PersistentVolumeClaim This is an alpha field and requires enabling VolumeAttributesClass feature.
   */
  currentVolumeAttributesClassName?: string | null;
  /**
   * ModifyVolumeStatus represents the status object of ControllerModifyVolume operation
   */
  modifyVolumeStatus?: {
    /**
     * status is the status of the ControllerModifyVolume operation. It can be in any of following states:
     *  - Pending
     *    Pending indicates that the PersistentVolumeClaim cannot be modified due to unmet requirements, such as
     *    the specified VolumeAttributesClass not existing.
     *  - InProgress
     *    InProgress indicates that the volume is being modified.
     *  - Infeasible
     *   Infeasible indicates that the request has been rejected as invalid by the CSI driver. To
     * 	  resolve the error, a valid VolumeAttributesClass needs to be specified.
     * Note: New statuses can be added in the future. Consumers should check for unknown statuses and fail appropriately.
     */
    status: string;
    /**
     * targetVolumeAttributesClassName is the name of the VolumeAttributesClass the PVC currently being reconciled
     */
    targetVolumeAttributesClassName?: string | null;
    [k: string]: unknown;
  } | null;
  /**
   * phase represents the current phase of PersistentVolumeClaim.
   */
  phase?: string | null;
  [k: string]: unknown;
}

/**
 * PersistentVolumeClaim is a user's request for and claim to a persistent volume
 */
type PersistentVolumeClaimDetails = {
  /**
   * APIVersion defines the versioned schema of this representation of an object. Servers should convert recognized schemas to the latest internal value, and may reject unrecognized values. More info: https://git.k8s.io/community/contributors/devel/sig-architecture/api-conventions.md#resources
   */
  apiVersion?: string;
  /**
   * Kind is a string value representing the REST resource this object represents. Servers may infer this from the endpoint the client submits requests to. Cannot be updated. In CamelCase. More info: https://git.k8s.io/community/contributors/devel/sig-architecture/api-conventions.md#types-kinds
   */
  kind: "PersistentVolume";
  /**
   * ObjectMeta is metadata that all persisted resources must have, which includes all objects users must create.
   */
  metadata: PersistentVolumeClaimDetailsMetadata;
  /**
   * PersistentVolumeClaimSpec describes the common attributes of storage devices and allows a Source for provider-specific attributes
   */
  spec: PersistentVolumeClaimDetailsSpec;
  /**
   * PersistentVolumeClaimStatus is the current status of a persistent volume claim.
   */
  status: PersistentVolumeClaimDetailsStatus;
  [k: string]: unknown;
}


export {
  PersistentVolumeClaimsHeaders,
  PersistentVolumeClaimsResponse,
  PersistentVolumeClaimDetailsMetadata,
  PersistentVolumeClaimDetailsSpec,
  PersistentVolumeClaimDetailsStatus,
  PersistentVolumeClaimDetails
};