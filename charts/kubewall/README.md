
<!-- omit in toc -->
# Kubewall helm chart

<img src="/media/logo.png" style="width: 100px;">

- `Kubewall` allows you to manage Kubernetes clusters. 
- This Helm chart simplifies the installation and configuration of Kubewall.

<!-- omit in toc -->
## Table of Contents
- [Installation](#installation)
  - [Notes:](#notes)
  - [Using Custom TLS Certificates](#using-custom-tls-certificates)
  - [Using a Custom Service Account](#using-a-custom-service-account)
- [Upgrading the Chart](#upgrading-the-chart)
- [Configuration Parameters](#configuration-parameters)


## Installation

To install the kubewall chart using Helm, run the following command:

```bash
helm install kubewall oci://ghcr.io/kubewall/charts/kubewall -n kubewall-system --create-namespace
```

### Notes:

- **Default Setup**: By default, Kubewall runs on port `8443` with self-signed certificates.
- **Namespace**: A new namespace `kubewall-system` will be created automatically if it doesn't exist.

### Using Custom TLS Certificates

- To use your own TLS certificates instead of the default self-signed ones:

1. **Create a Kubernetes Secret**: Store your TLS certificate and key in a secret.

  ```sh
  # Create namespace 
  kubectl create namespace kubewall-system
   
  # Create a TLS secret in the `kubewall-system` namespace
  kubectl   create secret tls kubewall-tls-secret \
            -n kubewall-system                    \
            --cert=tls.crt                        \
            --key=tls.key
   ```

2. **Install Kubewall with your certificates**:

  ```bash
  helm install kubewall   \
    --create-namespace    \
    -n kubewall-system    \
    --version v0.0.11     \
    --set tls.secretName=kubewall-tls-secret
    oci://ghcr.io/kubewall/kubewall \
    
   ```

### Using a Custom Service Account

By default, the chart creates a service account with `admin` RBAC permissions in the release namespace. If you'd like Kubewall to use an existing service account, you can disable the creation of a new one.

1. **Install Kubewall with an existing service account**:

  ```bash
  helm install kubewall                                 \
    --create-namespace                                  \
    -n kubewall-system                                  \ 
    --version v0.0.11                                   \
    --set serviceAccount.create=false                   \
    --set serviceAccount.name=<yourServiceAccountName>  \
    oci://ghcr.io/kubewall/kubewall
   ```

## Upgrading the Chart

- To upgrade to a newer version of the chart, run the following command:

  ```bash
  helm upgrade kubewall oci://ghcr.io/kubewall/kubewall \
    -n kubewall-system \
    --version v0.0.11
  ```

## Configuration Parameters

- The following are some key configuration parameters you can customize when installing the chart:

| Parameter               | Description                                                                                       | Default  |
|-------------------------|---------------------------------------------------------------------------------------------------|----------|
| `tls.secretName`         | Kubernetes secret name containing your TLS certificate and key. Must be in the `kubewall-system` namespace. | `""`     |
| `service.port`           | The HTTPS port number Kubewall listens on.                                                        | `8443`   |
| `serviceAccount.create`  | Set to `false` if you want to use an existing service account.                                     | `true`   |
| `serviceAccount.name`    | Name of the service account to use (if `serviceAccount.create=false`).                            | `""`     |

- For a complete list of configurable parameters, refer to the values file or documentation.
