type PersistentVolumesResponse = {
  name: string;
  age: string;
  spec: {
    storageClassName: string;
    volumeMode: string;
    claimRef: string;
  },
  status: {
    phase: string;
  }
  hasUpdated: boolean;
};

type PersistentVolumesHeaders = {
  name: string;
  age: string;
  storageClassName: string;
  volumeMode: string;
  claimRef: string;
  phase: string;
};

type PersistentVolumeDetailsMetadata = {
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

type PersistentVolumeDetailsSpec = {
  /**
   * accessModes contains all ways the volume can be mounted. More info: https://kubernetes.io/docs/concepts/storage/persistent-volumes#access-modes
   */
  accessModes?: (string | null)[] | null;
  /**
   * Represents a Persistent Disk resource in AWS.
   *
   * An AWS EBS disk must exist before mounting to a container. The disk must also be in the same AWS zone as the kubelet. An AWS EBS disk can only be mounted as read/write once. AWS EBS volumes support ownership management and SELinux relabeling.
   */
  awsElasticBlockStore?: {
    /**
     * fsType is the filesystem type of the volume that you want to mount. Tip: Ensure that the filesystem type is supported by the host operating system. Examples: "ext4", "xfs", "ntfs". Implicitly inferred to be "ext4" if unspecified. More info: https://kubernetes.io/docs/concepts/storage/volumes#awselasticblockstore
     */
    fsType?: string | null;
    /**
     * partition is the partition in the volume that you want to mount. If omitted, the default is to mount by volume name. Examples: For volume /dev/sda1, you specify the partition as "1". Similarly, the volume partition for /dev/sda is "0" (or you can leave the property empty).
     */
    partition?: number | null;
    /**
     * readOnly value true will force the readOnly setting in VolumeMounts. More info: https://kubernetes.io/docs/concepts/storage/volumes#awselasticblockstore
     */
    readOnly?: boolean | null;
    /**
     * volumeID is unique ID of the persistent disk resource in AWS (Amazon EBS volume). More info: https://kubernetes.io/docs/concepts/storage/volumes#awselasticblockstore
     */
    volumeID: string;
    [k: string]: unknown;
  } | null;
  /**
   * AzureDisk represents an Azure Data Disk mount on the host and bind mount to the pod.
   */
  azureDisk?: {
    /**
     * cachingMode is the Host Caching mode: None, Read Only, Read Write.
     */
    cachingMode?: string | null;
    /**
     * diskName is the Name of the data disk in the blob storage
     */
    diskName: string;
    /**
     * diskURI is the URI of data disk in the blob storage
     */
    diskURI: string;
    /**
     * fsType is Filesystem type to mount. Must be a filesystem type supported by the host operating system. Ex. "ext4", "xfs", "ntfs". Implicitly inferred to be "ext4" if unspecified.
     */
    fsType?: string | null;
    /**
     * kind expected values are Shared: multiple blob disks per storage account  Dedicated: single blob disk per storage account  Managed: azure managed data disk (only in managed availability set). defaults to shared
     */
    kind?: string | null;
    /**
     * readOnly Defaults to false (read/write). ReadOnly here will force the ReadOnly setting in VolumeMounts.
     */
    readOnly?: boolean | null;
    [k: string]: unknown;
  } | null;
  /**
   * AzureFile represents an Azure File Service mount on the host and bind mount to the pod.
   */
  azureFile?: {
    /**
     * readOnly defaults to false (read/write). ReadOnly here will force the ReadOnly setting in VolumeMounts.
     */
    readOnly?: boolean | null;
    /**
     * secretName is the name of secret that contains Azure Storage Account Name and Key
     */
    secretName: string;
    /**
     * secretNamespace is the namespace of the secret that contains Azure Storage Account Name and Key default is the same as the Pod
     */
    secretNamespace?: string | null;
    /**
     * shareName is the azure Share Name
     */
    shareName: string;
    [k: string]: unknown;
  } | null;
  /**
   * capacity is the description of the persistent volume's resources and capacity. More info: https://kubernetes.io/docs/concepts/storage/persistent-volumes#capacity
   */
  capacity?: {
    [k: string]: (string | null) | (number | null);
  } | null;
  /**
   * Represents a Ceph Filesystem mount that lasts the lifetime of a pod Cephfs volumes do not support ownership management or SELinux relabeling.
   */
  cephfs?: {
    /**
     * monitors is Required: Monitors is a collection of Ceph monitors More info: https://examples.k8s.io/volumes/cephfs/README.md#how-to-use-it
     */
    monitors: (string | null)[];
    /**
     * path is Optional: Used as the mounted root, rather than the full Ceph tree, default is /
     */
    path?: string | null;
    /**
     * readOnly is Optional: Defaults to false (read/write). ReadOnly here will force the ReadOnly setting in VolumeMounts. More info: https://examples.k8s.io/volumes/cephfs/README.md#how-to-use-it
     */
    readOnly?: boolean | null;
    /**
     * secretFile is Optional: SecretFile is the path to key ring for User, default is /etc/ceph/user.secret More info: https://examples.k8s.io/volumes/cephfs/README.md#how-to-use-it
     */
    secretFile?: string | null;
    /**
     * SecretReference represents a Secret Reference. It has enough information to retrieve secret in any namespace
     */
    secretRef?: {
      /**
       * name is unique within a namespace to reference a secret resource.
       */
      name?: string | null;
      /**
       * namespace defines the space within which the secret name must be unique.
       */
      namespace?: string | null;
      [k: string]: unknown;
    } | null;
    /**
     * user is Optional: User is the rados user name, default is admin More info: https://examples.k8s.io/volumes/cephfs/README.md#how-to-use-it
     */
    user?: string | null;
    [k: string]: unknown;
  } | null;
  /**
   * Represents a cinder volume resource in Openstack. A Cinder volume must exist before mounting to a container. The volume must also be in the same region as the kubelet. Cinder volumes support ownership management and SELinux relabeling.
   */
  cinder?: {
    /**
     * fsType Filesystem type to mount. Must be a filesystem type supported by the host operating system. Examples: "ext4", "xfs", "ntfs". Implicitly inferred to be "ext4" if unspecified. More info: https://examples.k8s.io/mysql-cinder-pd/README.md
     */
    fsType?: string | null;
    /**
     * readOnly is Optional: Defaults to false (read/write). ReadOnly here will force the ReadOnly setting in VolumeMounts. More info: https://examples.k8s.io/mysql-cinder-pd/README.md
     */
    readOnly?: boolean | null;
    /**
     * SecretReference represents a Secret Reference. It has enough information to retrieve secret in any namespace
     */
    secretRef?: {
      /**
       * name is unique within a namespace to reference a secret resource.
       */
      name?: string | null;
      /**
       * namespace defines the space within which the secret name must be unique.
       */
      namespace?: string | null;
      [k: string]: unknown;
    } | null;
    /**
     * volumeID used to identify the volume in cinder. More info: https://examples.k8s.io/mysql-cinder-pd/README.md
     */
    volumeID: string;
    [k: string]: unknown;
  } | null;
  /**
   * ObjectReference contains enough information to let you inspect or modify the referred object.
   */
  claimRef?: {
    /**
     * API version of the referent.
     */
    apiVersion?: string | null;
    /**
     * If referring to a piece of an object instead of an entire object, this string should contain a valid JSON/Go field access statement, such as desiredState.manifest.containers[2]. For example, if the object reference is to a container within a pod, this would take on a value like: "spec.containers{name}" (where "name" refers to the name of the container that triggered the event) or if no container name is specified "spec.containers[2]" (container with index 2 in this pod). This syntax is chosen only to have some well-defined way of referencing a part of an object.
     */
    fieldPath?: string | null;
    /**
     * Kind of the referent. More info: https://git.k8s.io/community/contributors/devel/sig-architecture/api-conventions.md#types-kinds
     */
    kind?: string | null;
    /**
     * Name of the referent. More info: https://kubernetes.io/docs/concepts/overview/working-with-objects/names/#names
     */
    name?: string | null;
    /**
     * Namespace of the referent. More info: https://kubernetes.io/docs/concepts/overview/working-with-objects/namespaces/
     */
    namespace?: string | null;
    /**
     * Specific resourceVersion to which this reference is made, if any. More info: https://git.k8s.io/community/contributors/devel/sig-architecture/api-conventions.md#concurrency-control-and-consistency
     */
    resourceVersion?: string | null;
    /**
     * UID of the referent. More info: https://kubernetes.io/docs/concepts/overview/working-with-objects/names/#uids
     */
    uid?: string | null;
    [k: string]: unknown;
  } | null;
  /**
   * Represents storage that is managed by an external CSI volume driver (Beta feature)
   */
  csi?: {
    /**
     * SecretReference represents a Secret Reference. It has enough information to retrieve secret in any namespace
     */
    controllerExpandSecretRef?: {
      /**
       * name is unique within a namespace to reference a secret resource.
       */
      name?: string | null;
      /**
       * namespace defines the space within which the secret name must be unique.
       */
      namespace?: string | null;
      [k: string]: unknown;
    } | null;
    /**
     * SecretReference represents a Secret Reference. It has enough information to retrieve secret in any namespace
     */
    controllerPublishSecretRef?: {
      /**
       * name is unique within a namespace to reference a secret resource.
       */
      name?: string | null;
      /**
       * namespace defines the space within which the secret name must be unique.
       */
      namespace?: string | null;
      [k: string]: unknown;
    } | null;
    /**
     * driver is the name of the driver to use for this volume. Required.
     */
    driver: string;
    /**
     * fsType to mount. Must be a filesystem type supported by the host operating system. Ex. "ext4", "xfs", "ntfs".
     */
    fsType?: string | null;
    /**
     * SecretReference represents a Secret Reference. It has enough information to retrieve secret in any namespace
     */
    nodeExpandSecretRef?: {
      /**
       * name is unique within a namespace to reference a secret resource.
       */
      name?: string | null;
      /**
       * namespace defines the space within which the secret name must be unique.
       */
      namespace?: string | null;
      [k: string]: unknown;
    } | null;
    /**
     * SecretReference represents a Secret Reference. It has enough information to retrieve secret in any namespace
     */
    nodePublishSecretRef?: {
      /**
       * name is unique within a namespace to reference a secret resource.
       */
      name?: string | null;
      /**
       * namespace defines the space within which the secret name must be unique.
       */
      namespace?: string | null;
      [k: string]: unknown;
    } | null;
    /**
     * SecretReference represents a Secret Reference. It has enough information to retrieve secret in any namespace
     */
    nodeStageSecretRef?: {
      /**
       * name is unique within a namespace to reference a secret resource.
       */
      name?: string | null;
      /**
       * namespace defines the space within which the secret name must be unique.
       */
      namespace?: string | null;
      [k: string]: unknown;
    } | null;
    /**
     * readOnly value to pass to ControllerPublishVolumeRequest. Defaults to false (read/write).
     */
    readOnly?: boolean | null;
    /**
     * volumeAttributes of the volume to publish.
     */
    volumeAttributes?: {
      [k: string]: string | null;
    } | null;
    /**
     * volumeHandle is the unique volume name returned by the CSI volume plugin’s CreateVolume to refer to the volume on all subsequent calls. Required.
     */
    volumeHandle: string;
    [k: string]: unknown;
  } | null;
  /**
   * Represents a Fibre Channel volume. Fibre Channel volumes can only be mounted as read/write once. Fibre Channel volumes support ownership management and SELinux relabeling.
   */
  fc?: {
    /**
     * fsType is the filesystem type to mount. Must be a filesystem type supported by the host operating system. Ex. "ext4", "xfs", "ntfs". Implicitly inferred to be "ext4" if unspecified.
     */
    fsType?: string | null;
    /**
     * lun is Optional: FC target lun number
     */
    lun?: number | null;
    /**
     * readOnly is Optional: Defaults to false (read/write). ReadOnly here will force the ReadOnly setting in VolumeMounts.
     */
    readOnly?: boolean | null;
    /**
     * targetWWNs is Optional: FC target worldwide names (WWNs)
     */
    targetWWNs?: (string | null)[] | null;
    /**
     * wwids Optional: FC volume world wide identifiers (wwids) Either wwids or combination of targetWWNs and lun must be set, but not both simultaneously.
     */
    wwids?: (string | null)[] | null;
    [k: string]: unknown;
  } | null;
  /**
   * FlexPersistentVolumeSource represents a generic persistent volume resource that is provisioned/attached using an exec based plugin.
   */
  flexVolume?: {
    /**
     * driver is the name of the driver to use for this volume.
     */
    driver: string;
    /**
     * fsType is the Filesystem type to mount. Must be a filesystem type supported by the host operating system. Ex. "ext4", "xfs", "ntfs". The default filesystem depends on FlexVolume script.
     */
    fsType?: string | null;
    /**
     * options is Optional: this field holds extra command options if any.
     */
    options?: {
      [k: string]: string | null;
    } | null;
    /**
     * readOnly is Optional: defaults to false (read/write). ReadOnly here will force the ReadOnly setting in VolumeMounts.
     */
    readOnly?: boolean | null;
    /**
     * SecretReference represents a Secret Reference. It has enough information to retrieve secret in any namespace
     */
    secretRef?: {
      /**
       * name is unique within a namespace to reference a secret resource.
       */
      name?: string | null;
      /**
       * namespace defines the space within which the secret name must be unique.
       */
      namespace?: string | null;
      [k: string]: unknown;
    } | null;
    [k: string]: unknown;
  } | null;
  /**
   * Represents a Flocker volume mounted by the Flocker agent. One and only one of datasetName and datasetUUID should be set. Flocker volumes do not support ownership management or SELinux relabeling.
   */
  flocker?: {
    /**
     * datasetName is Name of the dataset stored as metadata -> name on the dataset for Flocker should be considered as deprecated
     */
    datasetName?: string | null;
    /**
     * datasetUUID is the UUID of the dataset. This is unique identifier of a Flocker dataset
     */
    datasetUUID?: string | null;
    [k: string]: unknown;
  } | null;
  /**
   * Represents a Persistent Disk resource in Google Compute Engine.
   *
   * A GCE PD must exist before mounting to a container. The disk must also be in the same GCE project and zone as the kubelet. A GCE PD can only be mounted as read/write once or read-only many times. GCE PDs support ownership management and SELinux relabeling.
   */
  gcePersistentDisk?: {
    /**
     * fsType is filesystem type of the volume that you want to mount. Tip: Ensure that the filesystem type is supported by the host operating system. Examples: "ext4", "xfs", "ntfs". Implicitly inferred to be "ext4" if unspecified. More info: https://kubernetes.io/docs/concepts/storage/volumes#gcepersistentdisk
     */
    fsType?: string | null;
    /**
     * partition is the partition in the volume that you want to mount. If omitted, the default is to mount by volume name. Examples: For volume /dev/sda1, you specify the partition as "1". Similarly, the volume partition for /dev/sda is "0" (or you can leave the property empty). More info: https://kubernetes.io/docs/concepts/storage/volumes#gcepersistentdisk
     */
    partition?: number | null;
    /**
     * pdName is unique name of the PD resource in GCE. Used to identify the disk in GCE. More info: https://kubernetes.io/docs/concepts/storage/volumes#gcepersistentdisk
     */
    pdName: string;
    /**
     * readOnly here will force the ReadOnly setting in VolumeMounts. Defaults to false. More info: https://kubernetes.io/docs/concepts/storage/volumes#gcepersistentdisk
     */
    readOnly?: boolean | null;
    [k: string]: unknown;
  } | null;
  /**
   * Represents a Glusterfs mount that lasts the lifetime of a pod. Glusterfs volumes do not support ownership management or SELinux relabeling.
   */
  glusterfs?: {
    /**
     * endpoints is the endpoint name that details Glusterfs topology. More info: https://examples.k8s.io/volumes/glusterfs/README.md#create-a-pod
     */
    endpoints: string;
    /**
     * endpointsNamespace is the namespace that contains Glusterfs endpoint. If this field is empty, the EndpointNamespace defaults to the same namespace as the bound PVC. More info: https://examples.k8s.io/volumes/glusterfs/README.md#create-a-pod
     */
    endpointsNamespace?: string | null;
    /**
     * path is the Glusterfs volume path. More info: https://examples.k8s.io/volumes/glusterfs/README.md#create-a-pod
     */
    path: string;
    /**
     * readOnly here will force the Glusterfs volume to be mounted with read-only permissions. Defaults to false. More info: https://examples.k8s.io/volumes/glusterfs/README.md#create-a-pod
     */
    readOnly?: boolean | null;
    [k: string]: unknown;
  } | null;
  /**
   * Represents a host path mapped into a pod. Host path volumes do not support ownership management or SELinux relabeling.
   */
  hostPath?: {
    /**
     * path of the directory on the host. If the path is a symlink, it will follow the link to the real path. More info: https://kubernetes.io/docs/concepts/storage/volumes#hostpath
     */
    path: string;
    /**
     * type for HostPath Volume Defaults to "" More info: https://kubernetes.io/docs/concepts/storage/volumes#hostpath
     */
    type?: string | null;
    [k: string]: unknown;
  } | null;
  /**
   * ISCSIPersistentVolumeSource represents an ISCSI disk. ISCSI volumes can only be mounted as read/write once. ISCSI volumes support ownership management and SELinux relabeling.
   */
  iscsi?: {
    /**
     * chapAuthDiscovery defines whether support iSCSI Discovery CHAP authentication
     */
    chapAuthDiscovery?: boolean | null;
    /**
     * chapAuthSession defines whether support iSCSI Session CHAP authentication
     */
    chapAuthSession?: boolean | null;
    /**
     * fsType is the filesystem type of the volume that you want to mount. Tip: Ensure that the filesystem type is supported by the host operating system. Examples: "ext4", "xfs", "ntfs". Implicitly inferred to be "ext4" if unspecified. More info: https://kubernetes.io/docs/concepts/storage/volumes#iscsi
     */
    fsType?: string | null;
    /**
     * initiatorName is the custom iSCSI Initiator Name. If initiatorName is specified with iscsiInterface simultaneously, new iSCSI interface <target portal>:<volume name> will be created for the connection.
     */
    initiatorName?: string | null;
    /**
     * iqn is Target iSCSI Qualified Name.
     */
    iqn: string;
    /**
     * iscsiInterface is the interface Name that uses an iSCSI transport. Defaults to 'default' (tcp).
     */
    iscsiInterface?: string | null;
    /**
     * lun is iSCSI Target Lun number.
     */
    lun: number;
    /**
     * portals is the iSCSI Target Portal List. The Portal is either an IP or ip_addr:port if the port is other than default (typically TCP ports 860 and 3260).
     */
    portals?: (string | null)[] | null;
    /**
     * readOnly here will force the ReadOnly setting in VolumeMounts. Defaults to false.
     */
    readOnly?: boolean | null;
    /**
     * SecretReference represents a Secret Reference. It has enough information to retrieve secret in any namespace
     */
    secretRef?: {
      /**
       * name is unique within a namespace to reference a secret resource.
       */
      name?: string | null;
      /**
       * namespace defines the space within which the secret name must be unique.
       */
      namespace?: string | null;
      [k: string]: unknown;
    } | null;
    /**
     * targetPortal is iSCSI Target Portal. The Portal is either an IP or ip_addr:port if the port is other than default (typically TCP ports 860 and 3260).
     */
    targetPortal: string;
    [k: string]: unknown;
  } | null;
  /**
   * Local represents directly-attached storage with node affinity (Beta feature)
   */
  local?: {
    /**
     * fsType is the filesystem type to mount. It applies only when the Path is a block device. Must be a filesystem type supported by the host operating system. Ex. "ext4", "xfs", "ntfs". The default value is to auto-select a filesystem if unspecified.
     */
    fsType?: string | null;
    /**
     * path of the full path to the volume on the node. It can be either a directory or block device (disk, partition, ...).
     */
    path: string;
    [k: string]: unknown;
  } | null;
  /**
   * mountOptions is the list of mount options, e.g. ["ro", "soft"]. Not validated - mount will simply fail if one is invalid. More info: https://kubernetes.io/docs/concepts/storage/persistent-volumes/#mount-options
   */
  mountOptions?: (string | null)[] | null;
  /**
   * Represents an NFS mount that lasts the lifetime of a pod. NFS volumes do not support ownership management or SELinux relabeling.
   */
  nfs?: {
    /**
     * path that is exported by the NFS server. More info: https://kubernetes.io/docs/concepts/storage/volumes#nfs
     */
    path: string;
    /**
     * readOnly here will force the NFS export to be mounted with read-only permissions. Defaults to false. More info: https://kubernetes.io/docs/concepts/storage/volumes#nfs
     */
    readOnly?: boolean | null;
    /**
     * server is the hostname or IP address of the NFS server. More info: https://kubernetes.io/docs/concepts/storage/volumes#nfs
     */
    server: string;
    [k: string]: unknown;
  } | null;
  /**
   * VolumeNodeAffinity defines constraints that limit what nodes this volume can be accessed from.
   */
  nodeAffinity?: {
    /**
     * A node selector represents the union of the results of one or more label queries over a set of nodes; that is, it represents the OR of the selectors represented by the node selector terms.
     */
    required?: {
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
              key: string;
              /**
               * Represents a key's relationship to a set of values. Valid operators are In, NotIn, Exists, DoesNotExist. Gt, and Lt.
               */
              operator: string;
              /**
               * An array of string values. If the operator is In or NotIn, the values array must be non-empty. If the operator is Exists or DoesNotExist, the values array must be empty. If the operator is Gt or Lt, the values array must have a single element, which will be interpreted as an integer. This array is replaced during a strategic merge patch.
               */
              values?: (string | null)[] | null;
              [k: string]: unknown;
            } | null)[]
          | null;
        /**
         * A list of node selector requirements by node's fields.
         */
        matchFields?:
          | ({
              /**
               * The label key that the selector applies to.
               */
              key: string;
              /**
               * Represents a key's relationship to a set of values. Valid operators are In, NotIn, Exists, DoesNotExist. Gt, and Lt.
               */
              operator: string;
              /**
               * An array of string values. If the operator is In or NotIn, the values array must be non-empty. If the operator is Exists or DoesNotExist, the values array must be empty. If the operator is Gt or Lt, the values array must have a single element, which will be interpreted as an integer. This array is replaced during a strategic merge patch.
               */
              values?: (string | null)[] | null;
              [k: string]: unknown;
            } | null)[]
          | null;
        [k: string]: unknown;
      } | null)[];
      [k: string]: unknown;
    } | null;
    [k: string]: unknown;
  } | null;
  /**
   * persistentVolumeReclaimPolicy defines what happens to a persistent volume when released from its claim. Valid options are Retain (default for manually created PersistentVolumes), Delete (default for dynamically provisioned PersistentVolumes), and Recycle (deprecated). Recycle must be supported by the volume plugin underlying this PersistentVolume. More info: https://kubernetes.io/docs/concepts/storage/persistent-volumes#reclaiming
   */
  persistentVolumeReclaimPolicy?: string | null;
  /**
   * Represents a Photon Controller persistent disk resource.
   */
  photonPersistentDisk?: {
    /**
     * fsType is the filesystem type to mount. Must be a filesystem type supported by the host operating system. Ex. "ext4", "xfs", "ntfs". Implicitly inferred to be "ext4" if unspecified.
     */
    fsType?: string | null;
    /**
     * pdID is the ID that identifies Photon Controller persistent disk
     */
    pdID: string;
    [k: string]: unknown;
  } | null;
  /**
   * PortworxVolumeSource represents a Portworx volume resource.
   */
  portworxVolume?: {
    /**
     * fSType represents the filesystem type to mount Must be a filesystem type supported by the host operating system. Ex. "ext4", "xfs". Implicitly inferred to be "ext4" if unspecified.
     */
    fsType?: string | null;
    /**
     * readOnly defaults to false (read/write). ReadOnly here will force the ReadOnly setting in VolumeMounts.
     */
    readOnly?: boolean | null;
    /**
     * volumeID uniquely identifies a Portworx volume
     */
    volumeID: string;
    [k: string]: unknown;
  } | null;
  /**
   * Represents a Quobyte mount that lasts the lifetime of a pod. Quobyte volumes do not support ownership management or SELinux relabeling.
   */
  quobyte?: {
    /**
     * group to map volume access to Default is no group
     */
    group?: string | null;
    /**
     * readOnly here will force the Quobyte volume to be mounted with read-only permissions. Defaults to false.
     */
    readOnly?: boolean | null;
    /**
     * registry represents a single or multiple Quobyte Registry services specified as a string as host:port pair (multiple entries are separated with commas) which acts as the central registry for volumes
     */
    registry: string;
    /**
     * tenant owning the given Quobyte volume in the Backend Used with dynamically provisioned Quobyte volumes, value is set by the plugin
     */
    tenant?: string | null;
    /**
     * user to map volume access to Defaults to serivceaccount user
     */
    user?: string | null;
    /**
     * volume is a string that references an already created Quobyte volume by name.
     */
    volume: string;
    [k: string]: unknown;
  } | null;
  /**
   * Represents a Rados Block Device mount that lasts the lifetime of a pod. RBD volumes support ownership management and SELinux relabeling.
   */
  rbd?: {
    /**
     * fsType is the filesystem type of the volume that you want to mount. Tip: Ensure that the filesystem type is supported by the host operating system. Examples: "ext4", "xfs", "ntfs". Implicitly inferred to be "ext4" if unspecified. More info: https://kubernetes.io/docs/concepts/storage/volumes#rbd
     */
    fsType?: string | null;
    /**
     * image is the rados image name. More info: https://examples.k8s.io/volumes/rbd/README.md#how-to-use-it
     */
    image: string;
    /**
     * keyring is the path to key ring for RBDUser. Default is /etc/ceph/keyring. More info: https://examples.k8s.io/volumes/rbd/README.md#how-to-use-it
     */
    keyring?: string | null;
    /**
     * monitors is a collection of Ceph monitors. More info: https://examples.k8s.io/volumes/rbd/README.md#how-to-use-it
     */
    monitors: (string | null)[];
    /**
     * pool is the rados pool name. Default is rbd. More info: https://examples.k8s.io/volumes/rbd/README.md#how-to-use-it
     */
    pool?: string | null;
    /**
     * readOnly here will force the ReadOnly setting in VolumeMounts. Defaults to false. More info: https://examples.k8s.io/volumes/rbd/README.md#how-to-use-it
     */
    readOnly?: boolean | null;
    /**
     * SecretReference represents a Secret Reference. It has enough information to retrieve secret in any namespace
     */
    secretRef?: {
      /**
       * name is unique within a namespace to reference a secret resource.
       */
      name?: string | null;
      /**
       * namespace defines the space within which the secret name must be unique.
       */
      namespace?: string | null;
      [k: string]: unknown;
    } | null;
    /**
     * user is the rados user name. Default is admin. More info: https://examples.k8s.io/volumes/rbd/README.md#how-to-use-it
     */
    user?: string | null;
    [k: string]: unknown;
  } | null;
  /**
   * ScaleIOPersistentVolumeSource represents a persistent ScaleIO volume
   */
  scaleIO?: {
    /**
     * fsType is the filesystem type to mount. Must be a filesystem type supported by the host operating system. Ex. "ext4", "xfs", "ntfs". Default is "xfs"
     */
    fsType?: string | null;
    /**
     * gateway is the host address of the ScaleIO API Gateway.
     */
    gateway: string;
    /**
     * protectionDomain is the name of the ScaleIO Protection Domain for the configured storage.
     */
    protectionDomain?: string | null;
    /**
     * readOnly defaults to false (read/write). ReadOnly here will force the ReadOnly setting in VolumeMounts.
     */
    readOnly?: boolean | null;
    /**
     * SecretReference represents a Secret Reference. It has enough information to retrieve secret in any namespace
     */
    secretRef: {
      /**
       * name is unique within a namespace to reference a secret resource.
       */
      name?: string | null;
      /**
       * namespace defines the space within which the secret name must be unique.
       */
      namespace?: string | null;
      [k: string]: unknown;
    };
    /**
     * sslEnabled is the flag to enable/disable SSL communication with Gateway, default false
     */
    sslEnabled?: boolean | null;
    /**
     * storageMode indicates whether the storage for a volume should be ThickProvisioned or ThinProvisioned. Default is ThinProvisioned.
     */
    storageMode?: string | null;
    /**
     * storagePool is the ScaleIO Storage Pool associated with the protection domain.
     */
    storagePool?: string | null;
    /**
     * system is the name of the storage system as configured in ScaleIO.
     */
    system: string;
    /**
     * volumeName is the name of a volume already created in the ScaleIO system that is associated with this volume source.
     */
    volumeName?: string | null;
    [k: string]: unknown;
  } | null;
  /**
   * storageClassName is the name of StorageClass to which this persistent volume belongs. Empty value means that this volume does not belong to any StorageClass.
   */
  storageClassName?: string | null;
  /**
   * Represents a StorageOS persistent volume resource.
   */
  storageos?: {
    /**
     * fsType is the filesystem type to mount. Must be a filesystem type supported by the host operating system. Ex. "ext4", "xfs", "ntfs". Implicitly inferred to be "ext4" if unspecified.
     */
    fsType?: string | null;
    /**
     * readOnly defaults to false (read/write). ReadOnly here will force the ReadOnly setting in VolumeMounts.
     */
    readOnly?: boolean | null;
    /**
     * ObjectReference contains enough information to let you inspect or modify the referred object.
     */
    secretRef?: {
      /**
       * API version of the referent.
       */
      apiVersion?: string | null;
      /**
       * If referring to a piece of an object instead of an entire object, this string should contain a valid JSON/Go field access statement, such as desiredState.manifest.containers[2]. For example, if the object reference is to a container within a pod, this would take on a value like: "spec.containers{name}" (where "name" refers to the name of the container that triggered the event) or if no container name is specified "spec.containers[2]" (container with index 2 in this pod). This syntax is chosen only to have some well-defined way of referencing a part of an object.
       */
      fieldPath?: string | null;
      /**
       * Kind of the referent. More info: https://git.k8s.io/community/contributors/devel/sig-architecture/api-conventions.md#types-kinds
       */
      kind?: string | null;
      /**
       * Name of the referent. More info: https://kubernetes.io/docs/concepts/overview/working-with-objects/names/#names
       */
      name?: string | null;
      /**
       * Namespace of the referent. More info: https://kubernetes.io/docs/concepts/overview/working-with-objects/namespaces/
       */
      namespace?: string | null;
      /**
       * Specific resourceVersion to which this reference is made, if any. More info: https://git.k8s.io/community/contributors/devel/sig-architecture/api-conventions.md#concurrency-control-and-consistency
       */
      resourceVersion?: string | null;
      /**
       * UID of the referent. More info: https://kubernetes.io/docs/concepts/overview/working-with-objects/names/#uids
       */
      uid?: string | null;
      [k: string]: unknown;
    } | null;
    /**
     * volumeName is the human-readable name of the StorageOS volume.  Volume names are only unique within a namespace.
     */
    volumeName?: string | null;
    /**
     * volumeNamespace specifies the scope of the volume within StorageOS.  If no namespace is specified then the Pod's namespace will be used.  This allows the Kubernetes name scoping to be mirrored within StorageOS for tighter integration. Set VolumeName to any name to override the default behaviour. Set to "default" if you are not using namespaces within StorageOS. Namespaces that do not pre-exist within StorageOS will be created.
     */
    volumeNamespace?: string | null;
    [k: string]: unknown;
  } | null;
  /**
   * Name of VolumeAttributesClass to which this persistent volume belongs. Empty value is not allowed. When this field is not set, it indicates that this volume does not belong to any VolumeAttributesClass. This field is mutable and can be changed by the CSI driver after a volume has been updated successfully to a new class. For an unbound PersistentVolume, the volumeAttributesClassName will be matched with unbound PersistentVolumeClaims during the binding process. This is an alpha field and requires enabling VolumeAttributesClass feature.
   */
  volumeAttributesClassName?: string | null;
  /**
   * volumeMode defines if a volume is intended to be used with a formatted filesystem or to remain in raw block state. Value of Filesystem is implied when not included in spec.
   */
  volumeMode?: string | null;
  /**
   * Represents a vSphere volume resource.
   */
  vsphereVolume?: {
    /**
     * fsType is filesystem type to mount. Must be a filesystem type supported by the host operating system. Ex. "ext4", "xfs", "ntfs". Implicitly inferred to be "ext4" if unspecified.
     */
    fsType?: string | null;
    /**
     * storagePolicyID is the storage Policy Based Management (SPBM) profile ID associated with the StoragePolicyName.
     */
    storagePolicyID?: string | null;
    /**
     * storagePolicyName is the storage Policy Based Management (SPBM) profile name.
     */
    storagePolicyName?: string | null;
    /**
     * volumePath is the path that identifies vSphere volume vmdk
     */
    volumePath: string;
    [k: string]: unknown;
  } | null;
  [k: string]: unknown;
}

type PersistentVolumeDetailsStatus = {
  /**
   * Time is a wrapper around time.Time which supports correct marshaling to YAML and JSON.  Wrappers are provided for many of the factory methods that the time package offers.
   */
  lastPhaseTransitionTime?: string | null;
  /**
   * message is a human-readable message indicating details about why the volume is in this state.
   */
  message?: string | null;
  /**
   * phase indicates if a volume is available, bound to a claim, or released by a claim. More info: https://kubernetes.io/docs/concepts/storage/persistent-volumes#phase
   */
  phase?: string | null;
  /**
   * reason is a brief CamelCase string that describes any failure and is meant for machine parsing and tidy display in the CLI.
   */
  reason?: string | null;
  [k: string]: unknown;
}
/**
 * PersistentVolume (PV) is a storage resource provisioned by an administrator. It is analogous to a node. More info: https://kubernetes.io/docs/concepts/storage/persistent-volumes
 */
type PersistentVolumeDetails = {
  /**
   * APIVersion defines the versioned schema of this representation of an object. Servers should convert recognized schemas to the latest internal value, and may reject unrecognized values. More info: https://git.k8s.io/community/contributors/devel/sig-architecture/api-conventions.md#resources
   */
  apiVersion?: string ;
  /**
   * Kind is a string value representing the REST resource this object represents. Servers may infer this from the endpoint the client submits requests to. Cannot be updated. In CamelCase. More info: https://git.k8s.io/community/contributors/devel/sig-architecture/api-conventions.md#types-kinds
   */
  kind?: "PersistentVolume";
  /**
   * ObjectMeta is metadata that all persisted resources must have, which includes all objects users must create.
   */
  metadata: PersistentVolumeDetailsMetadata;
  /**
   * PersistentVolumeSpec is the specification of a persistent volume.
   */
  spec: PersistentVolumeDetailsSpec;
  /**
   * PersistentVolumeStatus is the current status of a persistent volume.
   */
  status: PersistentVolumeDetailsStatus;
  [k: string]: unknown;
}

export {
  PersistentVolumesHeaders,
  PersistentVolumesResponse,
  PersistentVolumeDetails,
  PersistentVolumeDetailsMetadata,
  PersistentVolumeDetailsSpec,
  PersistentVolumeDetailsStatus,
};