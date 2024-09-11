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
};

type KubeconfigFileConfig = {
  config: string;
}

export {
  BearerTokenConfig,
  CertificateConfig,
  KubeconfigFileConfig
};
