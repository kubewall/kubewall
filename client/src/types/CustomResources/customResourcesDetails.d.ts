type CustomResourceDetails = {
  apiVersion: string;
  kind: string;
  metadata: {
    annotations?: {
      [k: string]: string | null;
    };
    creationTimestamp: string;
    generation: number;
    name: string;
    namespace: string;
    resourceVersion: number;
    uid: string;
    labels?: {
      [k: string]: string | null;
    }
  };
  spec: {
    [k: string]: unkown;
  };
};

export {
  CustomResourceDetails
};
