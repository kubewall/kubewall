type NodeListResponse = {
  age: string,
  hasUpdated: boolean,
  name: string,
  resourceVersion: string,
  roles: string[],
  spec: {
      podCIDR: string,
      podCIDRs: string[],
      providerID: string
  },
  status: {
      addresses: {
          internalIP: string
      },
      conditionStatus: "True" | "False" | "Unkown",
      nodeInfo: {
          architecture: string,
          bootID: string,
          containerRuntimeVersion: string,
          kernelVersion: string,
          kubeProxyVersion: string,
          kubeletVersion: string,
          machineID: string,
          operatingSystem: string,
          osImage: string,
          systemUUID: string
      }
  }
};

type NodeList = {
  age: string,
  resourceVersion: string,
  name: string,
  roles: string,
  conditionStatus: string,
  architecture: string,
  bootID: string,
  containerRuntimeVersion: string,
  kernelVersion: string,
  kubeProxyVersion: string,
  kubeletVersion: string,
  machineID: string,
  operatingSystem: string,
  osImage: string,
  systemUUID: string
};

type NodesListHeaders = NodeList;

type NodeDetailsMetadata = {
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
        [k: string]: unknown
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
        [k: string]: unknown
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
  [k: string]: unknown
}

type NodeDetailsSpec = {
  /**
   * NodeConfigSource specifies a source of node configuration. Exactly one subfield (excluding metadata) must be non-nil. This API is deprecated since 1.22
   */
  configSource?: {
    /**
     * ConfigMapNodeConfigSource contains the information to reference a ConfigMap as a config source for the Node. This API is deprecated since 1.22: https://git.k8s.io/enhancements/keps/sig-node/281-dynamic-kubelet-configuration
     */
    configMap?: {
      /**
       * KubeletConfigKey declares which key of the referenced ConfigMap corresponds to the KubeletConfiguration structure This field is required in all cases.
       */
      kubeletConfigKey: string
      /**
       * Name is the metadata.name of the referenced ConfigMap. This field is required in all cases.
       */
      name: string
      /**
       * Namespace is the metadata.namespace of the referenced ConfigMap. This field is required in all cases.
       */
      namespace: string
      /**
       * ResourceVersion is the metadata.ResourceVersion of the referenced ConfigMap. This field is forbidden in Node.Spec, and required in Node.Status.
       */
      resourceVersion?: string | null
      /**
       * UID is the metadata.UID of the referenced ConfigMap. This field is forbidden in Node.Spec, and required in Node.Status.
       */
      uid?: string | null
      [k: string]: unknown
    } | null
    [k: string]: unknown
  } | null
  /**
   * Deprecated. Not all kubelets will set this field. Remove field after 1.13. see: https://issues.k8s.io/61966
   */
  externalID?: string | null
  /**
   * PodCIDR represents the pod IP range assigned to the node.
   */
  podCIDR?: string | null
  /**
   * podCIDRs represents the IP ranges assigned to the node for usage by Pods on that node. If this field is specified, the 0th entry must match the podCIDR field. It may contain at most 1 value for each of IPv4 and IPv6.
   */
  podCIDRs?: (string | null)[] | null
  /**
   * ID of the node assigned by the cloud provider in the format: <ProviderName>://<ProviderSpecificNodeID>
   */
  providerID?: string | null
  /**
   * If specified, the node's taints.
   */
  taints?:
    | ({
        /**
         * Required. The effect of the taint on pods that do not tolerate the taint. Valid effects are NoSchedule, PreferNoSchedule and NoExecute.
         */
        effect: string
        /**
         * Required. The taint key to be applied to a node.
         */
        key: string
        /**
         * Time is a wrapper around time.Time which supports correct marshaling to YAML and JSON.  Wrappers are provided for many of the factory methods that the time package offers.
         */
        timeAdded?: string | null
        /**
         * The taint value corresponding to the taint key.
         */
        value?: string | null
        [k: string]: unknown
      } | null)[]
    | null
  /**
   * Unschedulable controls node schedulability of new pods. By default, node is schedulable. More info: https://kubernetes.io/docs/concepts/nodes/node/#manual-node-administration
   */
  unschedulable?: boolean | null
  [k: string]: unknown
}

type NodeDetailsStatus = {
  /**
   * List of addresses reachable to the node. Queried from cloud provider, if available. More info: https://kubernetes.io/docs/concepts/nodes/node/#addresses Note: This field is declared as mergeable, but the merge key is not sufficiently unique, which can cause data corruption when it is merged. Callers should instead use a full-replacement patch. See https://pr.k8s.io/79391 for an example. Consumers should assume that addresses can change during the lifetime of a Node. However, there are some exceptions where this may not be possible, such as Pods that inherit a Node's address in its own status or consumers of the downward API (status.hostIP).
   */
  addresses?:
    | ({
        /**
         * The node address.
         */
        address: string
        /**
         * Node address type, one of Hostname, ExternalIP or InternalIP.
         */
        type: string
        [k: string]: unknown
      } | null)[]
    | null
  /**
   * Allocatable represents the resources of a node that are available for scheduling. Defaults to Capacity.
   */
  allocatable?: {
    [k: string]: (string | null) | (number | null)
  } | null
  /**
   * Capacity represents the total resources of a node. More info: https://kubernetes.io/docs/concepts/storage/persistent-volumes#capacity
   */
  capacity?: {
    [k: string]: (string | null) | (number | null)
  } | null
  /**
   * Conditions is an array of current observed node conditions. More info: https://kubernetes.io/docs/concepts/nodes/node/#condition
   */
  conditions?:
    | ({
        /**
         * Time is a wrapper around time.Time which supports correct marshaling to YAML and JSON.  Wrappers are provided for many of the factory methods that the time package offers.
         */
        lastHeartbeatTime?: string | null
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
         * Type of node condition.
         */
        type: string
      } | null)[]
    | null
  /**
   * NodeConfigStatus describes the status of the config assigned by Node.Spec.ConfigSource.
   */
  config?: {
    /**
     * NodeConfigSource specifies a source of node configuration. Exactly one subfield (excluding metadata) must be non-nil. This API is deprecated since 1.22
     */
    active?: {
      /**
       * ConfigMapNodeConfigSource contains the information to reference a ConfigMap as a config source for the Node. This API is deprecated since 1.22: https://git.k8s.io/enhancements/keps/sig-node/281-dynamic-kubelet-configuration
       */
      configMap?: {
        /**
         * KubeletConfigKey declares which key of the referenced ConfigMap corresponds to the KubeletConfiguration structure This field is required in all cases.
         */
        kubeletConfigKey: string
        /**
         * Name is the metadata.name of the referenced ConfigMap. This field is required in all cases.
         */
        name: string
        /**
         * Namespace is the metadata.namespace of the referenced ConfigMap. This field is required in all cases.
         */
        namespace: string
        /**
         * ResourceVersion is the metadata.ResourceVersion of the referenced ConfigMap. This field is forbidden in Node.Spec, and required in Node.Status.
         */
        resourceVersion?: string | null
        /**
         * UID is the metadata.UID of the referenced ConfigMap. This field is forbidden in Node.Spec, and required in Node.Status.
         */
        uid?: string | null
        [k: string]: unknown
      } | null
      [k: string]: unknown
    } | null
    /**
     * NodeConfigSource specifies a source of node configuration. Exactly one subfield (excluding metadata) must be non-nil. This API is deprecated since 1.22
     */
    assigned?: {
      /**
       * ConfigMapNodeConfigSource contains the information to reference a ConfigMap as a config source for the Node. This API is deprecated since 1.22: https://git.k8s.io/enhancements/keps/sig-node/281-dynamic-kubelet-configuration
       */
      configMap?: {
        /**
         * KubeletConfigKey declares which key of the referenced ConfigMap corresponds to the KubeletConfiguration structure This field is required in all cases.
         */
        kubeletConfigKey: string
        /**
         * Name is the metadata.name of the referenced ConfigMap. This field is required in all cases.
         */
        name: string
        /**
         * Namespace is the metadata.namespace of the referenced ConfigMap. This field is required in all cases.
         */
        namespace: string
        /**
         * ResourceVersion is the metadata.ResourceVersion of the referenced ConfigMap. This field is forbidden in Node.Spec, and required in Node.Status.
         */
        resourceVersion?: string | null
        /**
         * UID is the metadata.UID of the referenced ConfigMap. This field is forbidden in Node.Spec, and required in Node.Status.
         */
        uid?: string | null
        [k: string]: unknown
      } | null
      [k: string]: unknown
    } | null
    /**
     * Error describes any problems reconciling the Spec.ConfigSource to the Active config. Errors may occur, for example, attempting to checkpoint Spec.ConfigSource to the local Assigned record, attempting to checkpoint the payload associated with Spec.ConfigSource, attempting to load or validate the Assigned config, etc. Errors may occur at different points while syncing config. Earlier errors (e.g. download or checkpointing errors) will not result in a rollback to LastKnownGood, and may resolve across Kubelet retries. Later errors (e.g. loading or validating a checkpointed config) will result in a rollback to LastKnownGood. In the latter case, it is usually possible to resolve the error by fixing the config assigned in Spec.ConfigSource. You can find additional information for debugging by searching the error message in the Kubelet log. Error is a human-readable description of the error state; machines can check whether or not Error is empty, but should not rely on the stability of the Error text across Kubelet versions.
     */
    error?: string | null
    /**
     * NodeConfigSource specifies a source of node configuration. Exactly one subfield (excluding metadata) must be non-nil. This API is deprecated since 1.22
     */
    lastKnownGood?: {
      /**
       * ConfigMapNodeConfigSource contains the information to reference a ConfigMap as a config source for the Node. This API is deprecated since 1.22: https://git.k8s.io/enhancements/keps/sig-node/281-dynamic-kubelet-configuration
       */
      configMap?: {
        /**
         * KubeletConfigKey declares which key of the referenced ConfigMap corresponds to the KubeletConfiguration structure This field is required in all cases.
         */
        kubeletConfigKey: string
        /**
         * Name is the metadata.name of the referenced ConfigMap. This field is required in all cases.
         */
        name: string
        /**
         * Namespace is the metadata.namespace of the referenced ConfigMap. This field is required in all cases.
         */
        namespace: string
        /**
         * ResourceVersion is the metadata.ResourceVersion of the referenced ConfigMap. This field is forbidden in Node.Spec, and required in Node.Status.
         */
        resourceVersion?: string | null
        /**
         * UID is the metadata.UID of the referenced ConfigMap. This field is forbidden in Node.Spec, and required in Node.Status.
         */
        uid?: string | null
        [k: string]: unknown
      } | null
      [k: string]: unknown
    } | null
    [k: string]: unknown
  } | null
  /**
   * NodeDaemonEndpoints lists ports opened by daemons running on the Node.
   */
  daemonEndpoints?: {
    /**
     * DaemonEndpoint contains information about a single Daemon endpoint.
     */
    kubeletEndpoint?: {
      /**
       * Port number of the given endpoint.
       */
      Port: number
      [k: string]: unknown
    } | null
    [k: string]: unknown
  } | null
  /**
   * List of container images on this node
   */
  images?:
    | ({
        /**
         * Names by which this image is known. e.g. ["kubernetes.example/hyperkube:v1.0.7", "cloud-vendor.registry.example/cloud-vendor/hyperkube:v1.0.7"]
         */
        names?: (string | null)[] | null
        /**
         * The size of the image in bytes.
         */
        sizeBytes?: number | null
        [k: string]: unknown
      } | null)[]
    | null
  /**
   * NodeSystemInfo is a set of ids/uuids to uniquely identify the node.
   */
  nodeInfo?: {
    /**
     * The Architecture reported by the node
     */
    architecture: string
    /**
     * Boot ID reported by the node.
     */
    bootID: string
    /**
     * ContainerRuntime Version reported by the node through runtime remote API (e.g. containerd://1.4.2).
     */
    containerRuntimeVersion: string
    /**
     * Kernel Version reported by the node from 'uname -r' (e.g. 3.16.0-0.bpo.4-amd64).
     */
    kernelVersion: string
    /**
     * KubeProxy Version reported by the node.
     */
    kubeProxyVersion: string
    /**
     * Kubelet Version reported by the node.
     */
    kubeletVersion: string
    /**
     * MachineID reported by the node. For unique machine identification in the cluster this field is preferred. Learn more from man(5) machine-id: http://man7.org/linux/man-pages/man5/machine-id.5.html
     */
    machineID: string
    /**
     * The Operating System reported by the node
     */
    operatingSystem: string
    /**
     * OS Image reported by the node from /etc/os-release (e.g. Debian GNU/Linux 7 (wheezy)).
     */
    osImage: string
    /**
     * SystemUUID reported by the node. For unique machine identification MachineID is preferred. This field is specific to Red Hat hosts https://access.redhat.com/documentation/en-us/red_hat_subscription_management/1/html/rhsm/uuid
     */
    systemUUID: string
    [k: string]: unknown
  } | null
  /**
   * NodePhase is the recently observed lifecycle phase of the node. More info: https://kubernetes.io/docs/concepts/nodes/node/#phase The field is never populated, and now is deprecated.
   */
  phase?: string | null
  /**
   * The available runtime handlers.
   */
  runtimeHandlers?:
    | ({
        /**
         * NodeRuntimeHandlerFeatures is a set of runtime features.
         */
        features?: {
          /**
           * RecursiveReadOnlyMounts is set to true if the runtime handler supports RecursiveReadOnlyMounts.
           */
          recursiveReadOnlyMounts?: boolean | null
          [k: string]: unknown
        } | null
        /**
         * Runtime handler name. Empty for the default runtime handler.
         */
        name?: string | null
        [k: string]: unknown
      } | null)[]
    | null
  /**
   * List of volumes that are attached to the node.
   */
  volumesAttached?:
    | ({
        /**
         * DevicePath represents the device path where the volume should be available
         */
        devicePath: string
        /**
         * Name of the attached volume
         */
        name: string
        [k: string]: unknown
      } | null)[]
    | null
  /**
   * List of attachable volumes in use (mounted) by the node.
   */
  volumesInUse?: (string | null)[] | null
  [k: string]: unknown
}
/**
 * Node is a worker node in Kubernetes. Each node will have a unique identifier in the cache (i.e. in etcd).
 */
type NodeDetails = {
  /**
   * APIVersion defines the versioned schema of this representation of an object. Servers should convert recognized schemas to the latest internal value, and may reject unrecognized values. More info: https://git.k8s.io/community/contributors/devel/sig-architecture/api-conventions.md#resources
   */
  apiVersion?: string | null
  /**
   * Kind is a string value representing the REST resource this object represents. Servers may infer this from the endpoint the client submits requests to. Cannot be updated. In CamelCase. More info: https://git.k8s.io/community/contributors/devel/sig-architecture/api-conventions.md#types-kinds
   */
  kind?: "Node" | null
  /**
   * ObjectMeta is metadata that all persisted resources must have, which includes all objects users must create.
   */
  metadata: NodeDetailsMetadata
  /**
   * NodeSpec describes the attributes that a node is created with.
   */
  spec: NodeDetailsSpec
  /**
   * NodeStatus is information about the current status of a node.
   */
  status: NodeDetailsStatus

  [k: string]: unknown
}

export {
  NodeDetails,
  NodeDetailsMetadata,
  NodeDetailsSpec,
  NodeList,
  NodesListHeaders,
  NodeListResponse,
};
