import { Namespaces, NamespacesResponse } from "../../types";

const allNamespace = {
  name: 'All Namespaces',
  uid: '',
  resourceVersion: '',
  age: '2023-11-21T05:46:34Z',
  labels: {
    'kubernetes.io/metadata.name': ''
  },
  finalizers: [],
  phase: ''
};

const formatNamespace = (namespaces: NamespacesResponse[]) => {
  return namespaces.map((namespace) => ({
    name: namespace.metadata.name,
    uid: namespace.metadata.uid,
    resourceVersion: namespace.metadata.resourceVersion,
    age: namespace.metadata.creationTimestamp,
    labels: namespace.metadata.labels,
    finalizers: namespace.spec.finalizers,
    phase: namespace.status.phase,
    hasUpdated: namespace.hasUpdated,
  }));
};

const namespacesFilter = (namespaces: Namespaces[]) => {
  return namespaces.map(({name}) => ({
    label: name,
    value: name
  }));
};

export {
  allNamespace,
  formatNamespace,
  namespacesFilter
};