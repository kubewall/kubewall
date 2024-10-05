type CustomResourcesDefinitionDetails = {
  metadata: {
    name: string,
    uid: string,
    resourceVersion: string,
    generation: number,
    creationTimestamp: string,
    labels: {
      [k: string]: string
    },
    annotations: {
      [k: string]: string
    }
  },
  spec: {
    group: string,
    names: {
      plural: string,
      singular: string,
      kind: string,
      listKind: string
    },
    scope: string,
    conversion: {
      strategy: string
    }
  },
  status: {
    conditions: [
      {
        [k: string]: string
      }
    ],
    acceptedNames: {
      plural: string,
      singular: string,
      kind: string,
      listKind: string
    },
    storedVersions: string[]
  }
};

export {
  CustomResourcesDefinitionDetails
};
