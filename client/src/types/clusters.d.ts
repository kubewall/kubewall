type ClustersDetails = {
  name: string;
  absolutePath: string;
  fileExists: boolean;
  clusters: {
    [key: string]: {
      name: string,
      namespace: string,
      authInfo: string,
      connected: boolean,
    }
  }
};

type Clusters = {
  kubeConfigs: {
    [key: string]: ClustersDetails;
  };
  version: string;
};

export {
  ClustersDetails,
  Clusters
};