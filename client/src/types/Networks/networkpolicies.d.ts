import { OwnerReference } from "../misc";

type NetworkPoliciesHeaders = {
  namespace: string;
  name: string;
  podSelector: string;
  policyTypes: string;
  age: string;
};

type NetworkPoliciesResponse = {
  hasUpdated: boolean;
} & NetworkPoliciesHeaders;

type NetworkPolicyDetailsMetadata = {
  annotations?: {
    [k: string]: string | null;
  } | null;
  creationTimestamp?: string | null;
  deletionGracePeriodSeconds?: number | null;
  deletionTimestamp?: string | null;
  generateName?: string | null;
  generation?: number | null;
  labels?: {
    [k: string]: string | null;
  } | null;
  name?: string | null;
  namespace?: string | null;
  ownerReferences?: (OwnerReference | null)[] | null;
  resourceVersion?: string | null;
  uid?: string | null;
};

type NetworkPolicyDetails = {
  apiVersion?: string | null;
  kind?: 'NetworkPolicy';
  metadata: NetworkPolicyDetailsMetadata;
  spec: {
    egress?: (object | null)[] | null;
    ingress?: (object | null)[] | null;
    podSelector: {
      matchExpressions?: (object | null)[] | null;
      matchLabels?: {
        [k: string]: string | null;
      } | null;
    };
    policyTypes?: (string | null)[] | null;
    [k: string]: unknown;
  };
};

export {
  NetworkPoliciesHeaders,
  NetworkPoliciesResponse,
  NetworkPolicyDetails,
  NetworkPolicyDetailsMetadata
};
