// Unified script generator for both bearer token and kubeconfig creation
export const generateUnifiedKubernetesScript = (outputType: 'bearer' | 'kubeconfig') => {
  return `#!/bin/bash

# Kube-dash Access Setup Script
# This script creates the necessary Kubernetes resources for kube-dash access
# Usage: ./setup-kube-dash-access.sh --output-type ${outputType}

set -e

# Parse command line arguments
OUTPUT_TYPE="${outputType}"
while [[ $# -gt 0 ]]; do
  case $1 in
    --output-type)
      OUTPUT_TYPE="$2"
      shift 2
      ;;
    *)
      echo "Unknown option $1"
      exit 1
      ;;
  esac
done

# Validate output type
if [[ "$OUTPUT_TYPE" != "bearer" && "$OUTPUT_TYPE" != "kubeconfig" ]]; then
  echo "Error: --output-type must be either 'bearer' or 'kubeconfig'"
  exit 1
fi

echo "Setting up kube-dash access with output type: $OUTPUT_TYPE"

# Get current cluster name
CLUSTER_NAME=$(kubectl config view --minify -o jsonpath='{.clusters[0].name}')
echo "Detected cluster: $CLUSTER_NAME"

echo "Creating kube-dash namespace..."
kubectl create namespace kube-dash --dry-run=client -o yaml | kubectl apply -f -

echo "Creating ServiceAccount..."
cat <<EOF | kubectl apply -f -
apiVersion: v1
kind: ServiceAccount
metadata:
  name: kube-dash
  namespace: kube-dash
EOF

echo "Creating ClusterRoleBinding..."
cat <<EOF | kubectl apply -f -
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRoleBinding
metadata:
  name: kube-dash-crb
roleRef:
  apiGroup: rbac.authorization.k8s.io
  kind: ClusterRole
  name: cluster-admin
subjects:
- kind: ServiceAccount
  name: kube-dash
  namespace: kube-dash
EOF

echo "Creating Secret for ServiceAccount token..."
cat <<EOF | kubectl apply -f -
apiVersion: v1
kind: Secret
metadata:
  name: kube-dash-secret
  namespace: kube-dash
  annotations:
    kubernetes.io/service-account.name: kube-dash
type: kubernetes.io/service-account-token
EOF

echo "Waiting for token to be generated..."
sleep 5

if [[ "$OUTPUT_TYPE" == "bearer" ]]; then
  echo "\n=== BEARER TOKEN INFORMATION ==="
  echo "Use the following information for Bearer Token authentication:"
  
  echo "\nAPI Server Endpoint:"
  kubectl config view --minify -o jsonpath='{.clusters[0].cluster.server}'
  echo
  
  echo "\nBearer Token:"
  kubectl get secret kube-dash-secret -n kube-dash -o jsonpath='{.data.token}' | base64 -d
  echo
  
  echo "\n=== SETUP COMPLETE ==="
  echo "Copy the API Server Endpoint and Bearer Token above to configure your connection."
  
  echo "\n=== CLEANUP COMMANDS ==="
  echo "# Run these commands to remove all created resources when no longer needed:"
  echo "# WARNING: This will revoke kube-dash access to your cluster"
  echo "#"
  echo "# kubectl delete clusterrolebinding kube-dash-crb"
  echo "# kubectl delete secret kube-dash-secret -n kube-dash"
  echo "# kubectl delete serviceaccount kube-dash -n kube-dash"
  echo "# kubectl delete namespace kube-dash"
  echo "#"
  echo "# Note: Deleting the namespace will remove all resources in it"
  
elif [[ "$OUTPUT_TYPE" == "kubeconfig" ]]; then
  echo "\n=== KUBECONFIG INFORMATION ==="
  echo "Use the following information to create your kubeconfig:"
  
  echo "\nCluster Endpoint:"
  kubectl config view --minify -o jsonpath='{.clusters[0].cluster.server}'
  echo
  
  echo "\nCA Certificate (base64 encoded):"
  # Try to get CA cert from the service account secret first, fallback to cluster CA
  CA_CERT=$(kubectl get secret kube-dash-secret -n kube-dash -o jsonpath='{.data.ca\\\.crt}' 2>/dev/null || kubectl config view --raw --minify --flatten -o jsonpath='{.clusters[].cluster.certificate-authority-data}')
  echo "$CA_CERT"
  echo
  
  echo "\nToken:"
  kubectl get secret kube-dash-secret -n kube-dash -o jsonpath='{.data.token}' | base64 -d
  echo
  
  echo "\n=== KUBECONFIG TEMPLATE ==="
  cat <<KUBECONFIG
apiVersion: v1
kind: Config
clusters:
- cluster:
    certificate-authority-data: \$(kubectl get secret kube-dash-secret -n kube-dash -o jsonpath='{.data.ca\\\.crt}' 2>/dev/null || kubectl config view --raw --minify --flatten -o jsonpath='{.clusters[].cluster.certificate-authority-data}')
    server: \$(kubectl config view --minify -o jsonpath='{.clusters[0].cluster.server}')
  name: $CLUSTER_NAME
contexts:
- context:
    cluster: $CLUSTER_NAME
    user: kube-dash
  name: kube-dash-$CLUSTER_NAME
current-context: kube-dash-$CLUSTER_NAME
users:
- name: kube-dash
  user:
    token: \$(kubectl get secret kube-dash-secret -n kube-dash -o jsonpath='{.data.token}' | base64 -d)
KUBECONFIG
  
  echo "\n=== SETUP COMPLETE ==="
  echo "Resources created successfully in kube-dash namespace!"
  echo "Context name: kube-dash-\$CLUSTER_NAME"
  echo "Copy the kubeconfig template above and replace the \\\$(...) expressions with actual values."
  
  echo "\n=== CLEANUP COMMANDS ==="
  echo "# Run these commands to remove all created resources when no longer needed:"
  echo "# WARNING: This will revoke kube-dash access to your cluster"
  echo "#"
  echo "# kubectl delete clusterrolebinding kube-dash-crb"
  echo "# kubectl delete secret kube-dash-secret -n kube-dash"
  echo "# kubectl delete serviceaccount kube-dash -n kube-dash"
  echo "# kubectl delete namespace kube-dash"
  echo "#"
  echo "# Note: Deleting the namespace will remove all resources in it"
fi
`;
};