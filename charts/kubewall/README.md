# kubewall Helm Chart

kubewall is a Kubernetes dashboard that helps you manage your Kubernetes clusters. This guide will help you install and configure kubewall using Helm.

## Table of Contents

- [Quick Start](#quick-start)
- [Installation Options](#installation-options)
  - [Simple Install](#simple-install)
  - [Using Custom TLS Certificates](#using-custom-tls-certificates)
  - [Using a Custom Service Account](#using-a-custom-service-account)
- [Upgrading](#upgrading)
- [Ingress Configuration](#ingress-configuration)
  - [Basic Ingress with Auto TLS](#basic-ingress-with-auto-tls-self-signed-certificates)
  - [Ingress without TLS](#ingress-without-tls)
  - [Ingress with Custom TLS Certificate](#ingress-with-custom-tls-certificate)
  - [Ingress with cert-manager](#ingress-with-cert-manager-production)
  - [Using a Values File](#using-a-values-file-for-ingress)
- [Configuration Parameters](#configuration-parameters)
- [Uninstalling](#uninstalling)
- [Troubleshooting](#troubleshooting)


## Quick Start

Install kubewall with a single command:

```bash
helm install kubewall oci://ghcr.io/kubewall/charts/kubewall \
  -n kubewall-system --create-namespace
```

This will:
- Create a namespace called `kubewall-system`
- Deploy kubewall with self-signed TLS certificates
- Run kubewall on port `8443` (HTTPS)

Access kubewall by port-forwarding:

```bash
kubectl port-forward -n kubewall-system svc/kubewall 8443:8443
```

Then open your browser to: `https://localhost:8443`

**Note:** You'll see a security warning because of the self-signed certificate. This is normal - click "Advanced" and proceed.

---

## Installation Options

### Simple Install

The simplest way to install kubewall:

```bash
helm install kubewall oci://ghcr.io/kubewall/charts/kubewall \
  -n kubewall-system --create-namespace
```

**What happens:**
- **kubewall** is installed in the `kubewall-system` namespace
- Self-signed TLS certificates are automatically created
- A service account with admin permissions is created
- **kubewall** runs on port `8443` with HTTPS

### Using Custom TLS Certificates

If you have your own TLS certificates (for example, from your organization's CA), you can use them instead of the auto-generated self-signed certificates.

**Step 1:** Create a Kubernetes secret with your certificate and key

```bash
# Create the namespace first
kubectl create namespace kubewall-system

# Create the TLS secret
kubectl -n kubewall-system create secret tls kubewall-tls-secret \
  --cert=path/to/your/tls.crt \
  --key=path/to/your/tls.key
```

**Step 2:** Install kubewall using your certificate

```bash
helm install kubewall oci://ghcr.io/kubewall/charts/kubewall \
  -n kubewall-system --create-namespace \
  --set tls.secretName=kubewall-tls-secret
```

### Using a Custom Service Account

By default, kubewall creates a service account with admin permissions. If you want to use your own service account (for example, with limited permissions), follow these steps:

**Step 1:** Create your service account and RBAC rules

```bash
# This is just an example - adjust permissions as needed
kubectl create namespace kubewall-system
kubectl -n kubewall-system create serviceaccount my-kubewall-sa

# Create a role with the permissions you want
kubectl -n kubewall-system create role kubewall-role \
  --verb=get,list,watch \
  --resource=pods,services,deployments

# Bind the role to the service account
kubectl -n kubewall-system create rolebinding kubewall-binding \
  --role=kubewall-role \
  --serviceaccount=kubewall-system:my-kubewall-sa
```

**Step 2:** Install kubewall with your service account

```bash
helm install kubewall oci://ghcr.io/kubewall/charts/kubewall \
  -n kubewall-system --create-namespace \
  --set serviceAccount.create=false \
  --set serviceAccount.name=my-kubewall-sa
```

---

## Upgrading

To upgrade kubewall to a newer version:

```bash
helm upgrade kubewall oci://ghcr.io/kubewall/charts/kubewall \
  -n kubewall-system
```

To upgrade to a specific version:

```bash
helm upgrade kubewall oci://ghcr.io/kubewall/charts/kubewall \
  -n kubewall-system --version v0.0.11
```

To upgrade and change configuration:

```bash
helm upgrade kubewall oci://ghcr.io/kubewall/charts/kubewall \
  -n kubewall-system \
  --set resources.limits.memory=512Mi
```

---

## Ingress Configuration

Ingress allows you to access kubewall from outside your cluster using a domain name (like `kubewall.example.com`). 

**Important Notes:**
- You need an ingress controller (like NGINX Ingress) installed in your cluster
- If using **zsh shell**, put quotes around arguments with square brackets `[0]` to avoid errors
- **kubewall** automatically configures HTTPS communication between ingress and the backend

### Basic Ingress with Auto TLS (Self-Signed Certificates)

This is the easiest way to set up ingress. kubewall will automatically create self-signed TLS certificates for you.

**Perfect for:** Development, testing, internal clusters

```bash
helm install kubewall oci://ghcr.io/kubewall/charts/kubewall \
  -n kubewall-system --create-namespace \
  --set ingress.enabled=true \
  --set ingress.className=nginx \
  --set 'ingress.hosts[0].host=kubewall.example.com' \
  --set 'ingress.hosts[0].paths[0].path=/' \
  --set 'ingress.hosts[0].paths[0].pathType=Prefix'
```

**Replace `kubewall.example.com` with your domain name.**

**What happens:**
- Ingress is enabled
- A self-signed TLS certificate is automatically created (valid for 5 years)
- HTTPS is configured automatically
- You can access kubewall at `https://kubewall.example.com`

**Note:** Your browser will show a security warning because the certificate is self-signed. This is expected.

### Ingress with Custom TLS Certificate

If you have your own TLS certificate (for example, from your organization):

**Step 1:** Create a TLS secret with your certificate

```bash
kubectl create namespace kubewall-system
kubectl -n kubewall-system create secret tls my-ingress-tls \
  --cert=path/to/your/tls.crt \
  --key=path/to/your/tls.key
```

**Step 2:** Install kubewall with your certificate

```bash
helm install kubewall oci://ghcr.io/kubewall/charts/kubewall \
  -n kubewall-system --create-namespace \
  --set ingress.enabled=true \
  --set ingress.className=nginx \
  --set 'ingress.hosts[0].host=kubewall.example.com' \
  --set 'ingress.hosts[0].paths[0].path=/' \
  --set 'ingress.hosts[0].paths[0].pathType=Prefix' \
  --set ingress.tls.secretName=my-ingress-tls
```

### Ingress with cert-manager

For production environments, use cert-manager to automatically get free TLS certificates from Let's Encrypt.

**Prerequisites:**
- cert-manager must be installed in your cluster
- You need a ClusterIssuer configured (see [cert-manager docs](https://cert-manager.io/docs/))

**Install with cert-manager:**

```bash
helm install kubewall oci://ghcr.io/kubewall/charts/kubewall \
  -n kubewall-system --create-namespace \
  --set ingress.enabled=true \
  --set ingress.className=nginx \
  --set ingress.tls.autoTLS=false \
  --set ingress.tls.secretName=kubewall-tls \
  --set 'ingress.annotations.cert-manager\.io/cluster-issuer=letsencrypt-prod' \
  --set 'ingress.annotations.nginx\.ingress\.kubernetes\.io/ssl-redirect=true' \
  --set 'ingress.hosts[0].host=kubewall.example.com' \
  --set 'ingress.hosts[0].paths[0].path=/' \
  --set 'ingress.hosts[0].paths[0].pathType=Prefix'
```

**Replace:**
- `kubewall.example.com` with your actual domain
- `letsencrypt-prod` with your ClusterIssuer name

**What happens:**
- cert-manager automatically requests a certificate from Let's Encrypt
- The certificate is stored in a secret called `kubewall-tls`
- cert-manager automatically renews the certificate before it expires

### Using a Values File for Ingress

For complex configurations, it's easier to use a values file instead of many `--set` flags.

**Create a file called `my-values.yaml`:**

**Option 1: With auto-generated self-signed certificates**

```yaml
ingress:
  enabled: true
  className: nginx
  hosts:
    - host: kubewall.example.com
      paths:
        - path: /
          pathType: Prefix
  tls:
    autoTLS: true  # Auto-generate self-signed certificates
```

**Option 2: With cert-manager**

```yaml
ingress:
  enabled: true
  className: nginx
  annotations:
    cert-manager.io/cluster-issuer: letsencrypt-prod
    nginx.ingress.kubernetes.io/ssl-redirect: "true"
  hosts:
    - host: kubewall.example.com
      paths:
        - path: /
          pathType: Prefix
  tls:
    autoTLS: false  # Disable auto-generation
    secretName: kubewall-tls  # cert-manager will create this
```

**Option 3: With custom certificate**

```yaml
ingress:
  enabled: true
  className: nginx
  hosts:
    - host: kubewall.example.com
      paths:
        - path: /
          pathType: Prefix
  tls:
    secretName: my-ingress-tls  # Your pre-created secret
```

**Install using your values file:**

```bash
helm install kubewall oci://ghcr.io/kubewall/charts/kubewall \
  -n kubewall-system --create-namespace \
  -f my-values.yaml
```

---

## Configuration Parameters

Below are all the configuration options you can customize when installing kubewall.

### Core Configuration

| Parameter | Description                    | Default |
|-----------|--------------------------------|---------|
| `replicaCount` | Number of kubewall pod replicas     | `1` |
| `nameOverride` | Override the chart name        | `""` |
| `fullnameOverride` | Override the full release name | `""` |


### Image Configuration

| Parameter | Description                                       | Default |
|-----------|---------------------------------------------------|---------|
| `image.repository` | kubewall container image repository                    | `ghcr.io/kubewall/kubewall` |
| `image.tag` | Image tag (defaults to chart appVersion if empty) | `""` |
| `image.pullPolicy` | Image pull policy (Always, IfNotPresent, Never)   | `IfNotPresent` |
| `imagePullSecrets` | Image pull secrets for private registries         | `[]` |


### TLS Configuration (Service)

These settings control the TLS certificates used by the kubewall service itself.

| Parameter | Description | Default |
|-----------|-------------|---------|
| `tls.secretName` | Name of existing TLS secret for the service. Leave empty to auto-generate self-signed certificates | `""` |
| `tls.host` | Hostname for the TLS certificate | `kubewall.local` |


### Service Configuration

| Parameter | Description                                                 | Default |
|-----------|-------------------------------------------------------------|---------|
| `service.type` | Kubernetes service type (ClusterIP, NodePort, LoadBalancer) | `ClusterIP` |
| `service.listen` | Address and port for kubewall to listen on                       | `:8443` |

### Ingress Configuration

These settings control external access to kubewall through an ingress controller.

| Parameter | Description | Default |
|-----------|-------------|---------|
| `ingress.enabled` | Enable ingress for external access | `false` |
| `ingress.className` | Ingress class name (e.g., nginx, traefik) | `""` |
| `ingress.annotations` | Annotations for the ingress resource | `{"nginx.ingress.kubernetes.io/backend-protocol": "HTTPS"}` |
| `ingress.hosts` | List of ingress hosts and paths | `[{host: "kubewall.local", paths: [{path: "/", pathType: "Prefix"}]}]` |
| `ingress.tls.autoTLS` | Automatically generate self-signed TLS certificates for ingress | `true` |
| `ingress.tls.secretName` | Name of existing TLS secret for ingress (disables autoTLS when set) | `""` |


### Service Account Configuration

| Parameter | Description                                               | Default |
|-----------|-----------------------------------------------------------|---------|
| `serviceAccount.create` | Create a service account for kubewall                          | `true` |
| `serviceAccount.name` | Name of the service account (auto-generated if empty)     | `""` |
| `serviceAccount.annotations` | Annotations for the service account (e.g., for IAM roles) | `{}` |


### Resource Configuration

Control CPU and memory limits for the kubewall container.

| Parameter | Description                      | Default |
|-----------|----------------------------------|---------|
| `resources.limits.cpu` | CPU limit for kubewall container      | `100m` |
| `resources.limits.memory` | Memory limit for kubewall container   | `256Mi` |
| `resources.requests.cpu` | CPU request for kubewall container    | `100m` |
| `resources.requests.memory` | Memory request for kubewall container | `256Mi` |


### Storage Configuration

Configure persistent storage for kubewall data.

| Parameter | Description                                    | Default |
|-----------|------------------------------------------------|---------|
| `pvc.name` | Name of the PersistentVolumeClaim              | `kubewall-data` |
| `pvc.storage` | Storage size for the PVC                       | `20Mi` |
| `pvc.accessModes` | Access mode for the PVC                        | `ReadWriteOnce` |
| `pvc.storageClass` | Storage class for the PVC (empty uses default) | `""` |
| `kubewallData.mountPath` | Mount path for kubewall data inside the container   | `/.kubewall` |


### Kubernetes Client Configuration

Configure how kubewall communicates with the Kubernetes API.

| Parameter | Description | Default |
|-----------|-------------|---------|
| `k8s_client_burst` | Maximum burst for Kubernetes API client throttling | `""` |
| `k8s_client_qps` | Queries per second limit for Kubernetes API client | `""` |


### Pod Configuration

Advanced pod scheduling and security settings.

| Parameter | Description | Default |
|-----------|-------------|---------|
| `podAnnotations` | Annotations to add to the pod | `{}` |
| `podSecurityContext` | Security context for the pod | `{}` |
| `securityContext` | Security context for the container | `{}` |
| `nodeSelector` | Node labels for pod assignment | `{}` |
| `tolerations` | Tolerations for pod scheduling | `[]` |
| `affinity` | Affinity rules for pod scheduling | `{}` |


### Complete Example with Multiple Parameters

```bash
helm install kubewall oci://ghcr.io/kubewall/charts/kubewall \
  -n kubewall-system --create-namespace \
  --set replicaCount=2 \
  --set resources.limits.memory=512Mi \
  --set resources.requests.cpu=200m \
  --set pvc.storage=100Mi \
  --set ingress.enabled=true \
  --set ingress.className=nginx \
  --set 'ingress.hosts[0].host=kubewall.example.com' \
  --set 'ingress.hosts[0].paths[0].path=/' \
  --set 'ingress.hosts[0].paths[0].pathType=Prefix'
```

---

## Uninstalling

To completely remove kubewall from your cluster:

```bash
helm uninstall kubewall -n kubewall-system
```

To also delete the namespace:

```bash
helm uninstall kubewall -n kubewall-system
kubectl delete namespace kubewall-system
```

**Note:** This will delete all data stored in the PersistentVolumeClaim.

---

## Troubleshooting

### Check if kubewall is running

```bash
kubectl get pods -n kubewall-system
```

You should see a pod with status `Running`.

### View kubewall logs

```bash
kubectl logs -n kubewall-system -l app.kubernetes.io/name=kubewall
```

### Check the service

```bash
kubectl get svc -n kubewall-system
```

### Check ingress status

```bash
kubectl get ingress -n kubewall-system
kubectl describe ingress -n kubewall-system
```

### Common Issues

**Issue: Pod is not starting**
```bash
# Check pod events
kubectl describe pod -n kubewall-system -l app.kubernetes.io/name=kubewall

# Common causes:
# - Image pull errors (check imagePullSecrets)
# - Resource limits too low
# - PVC not binding (check storage class)
```

**Issue: Can't access through ingress**
```bash
# Check if ingress controller is installed
kubectl get pods -n ingress-nginx

# Check ingress configuration
kubectl get ingress -n kubewall-system -o yaml

# Common causes:
# - Ingress controller not installed
# - DNS not pointing to ingress controller
# - TLS certificate issues
```

**Issue: TLS handshake errors in logs**

This usually means the ingress is sending HTTP to an HTTPS backend. Make sure the annotation is set:
```bash
--set 'ingress.annotations.nginx\.ingress\.kubernetes\.io/backend-protocol=HTTPS'
```

This is set by default in the chart, but can be overridden if you specify custom annotations.

---

## Additional Resources

- [Helm Documentation](https://helm.sh/docs/)
- [Kubernetes Ingress Documentation](https://kubernetes.io/docs/concepts/services-networking/ingress/)
- [cert-manager Documentation](https://cert-manager.io/docs/)
- [NGINX Ingress Controller](https://kubernetes.github.io/ingress-nginx/)
