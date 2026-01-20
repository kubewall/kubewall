type BearerTokenConfig = {
  name: string;
  apiServer: string;
  token: string;
};

type CertificateConfig = {
  name: string;
  apiServer: string;
  certificate: string;
  certificateKey: string;
  tlsMode: 'system' | 'custom' | 'insecure';
  caCertificate: string;
};

type KubeconfigFileConfig = {
  config: string;
}

export {
  BearerTokenConfig,
  CertificateConfig,
  KubeconfigFileConfig
};
