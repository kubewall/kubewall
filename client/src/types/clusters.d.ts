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
      reachable?: boolean,
      error?: string,
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