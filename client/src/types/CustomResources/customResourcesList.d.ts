type CustomResourcesPrinterColumns = {
  jsonPath: string;
  name: string;
  type: string;
}

type CustomResourcesCollection = {
  apiVersion: string;
  kind: string;
  metadata: {
    annotations: {
      [k: string]: string
    };
    creationTimestamp: string;
    generation: number;
    name: string;
    namespace: string;
    resourceVersion: string;
    uid: string;
  };
  spec: {
    checksum: string;
    source: string;
  }
}

type CustomResourcesList = {
  additionalPrinterColumns: CustomResourcesPrinterColumns[];
  list: CustomResourcesCollection[];
}

type CustomResourceHeaders = {
  [k: string]: unkown;
}
export {
  CustomResourcesList,
  CustomResourcesPrinterColumns,
  CustomResourceHeaders,
  CustomResourcesCollection
};