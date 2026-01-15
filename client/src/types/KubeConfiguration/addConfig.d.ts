/**
 * Configuration for bearer token authentication
 * @property configName - User-provided identifier for the kubeconfig file (e.g., "my-cluster")
 * @property name - Cluster/context name to be stored in the kubeconfig YAML
 * @property apiServer - Kubernetes API server URL
 * @property token - Bearer token for authentication
 */
type BearerTokenConfig = {
  configName: string;
  name: string;
  apiServer: string;
  token: string;
};

/**
 * Configuration for certificate-based authentication
 * @property configName - User-provided identifier for the kubeconfig file (e.g., "my-cluster")
 * @property name - Cluster/context name to be stored in the kubeconfig YAML
 * @property apiServer - Kubernetes API server URL
 * @property certificate - Client certificate data (base64 encoded)
 * @property certificateKey - Client certificate key data (base64 encoded)
 */
type CertificateConfig = {
  configName: string;
  name: string;
  apiServer: string;
  certificate: string;
  certificateKey: string;
};

/**
 * Configuration for kubeconfig file upload
 * @property configName - User-provided identifier for the kubeconfig file (e.g., "my-cluster")
 * @property config - Raw kubeconfig file content
 */
type KubeconfigFileConfig = {
  configName: string;
  config: string;
}

export {
  BearerTokenConfig,
  CertificateConfig,
  KubeconfigFileConfig
};
