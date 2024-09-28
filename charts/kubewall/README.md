# Kubewall Helm Chart

## Install Chart

```console
# Helm install with kubewall-system
$ helm install -n kubewall-system kubewall oci://ghcr.io/kubewall/kubewall --version v0.0.4 --create-namespace


# By default it runs kubewall on https 8443 with self signed certs
# If you want to use your own certificates

# Create a secret having your certificate and key
$ kubectl create namespace kubewall-system
$ kubectl -n kubewall-system create secret tls kubewall-tls-secret --cert=tls.crt --key=tls.key

$ helm install -n kubewall-system kubewall oci://ghcr.io/kubewall/kubewall --version v0.0.4 --create-namespace --set tls.secretName=kubewall-tls-secret


# By default it creates a service account in the specified release namespace with admin rbac binding
# If you want kubewall to use your own service account serviceAccount.create=false serviceAccount.name=<yourServiceAccountInReleaseNamespace>


$ helm install -n kubewall-system kubewall oci://ghcr.io/kubewall/kubewall --version v0.0.4 --create-namespace --set serviceAccount.create=false --set serviceAccount.name=<yourserviceAccountName>

```

## Upgrade Chart

```console
$ helm upgrade -n kubewall-system kubeall oci://ghcr.io/kubewall/kubewall --version v0.0.4
```


## Parameters

| Parameter                                                  | Description                                                                                                                                                                                                                                                                                    | Default                                                                                                                                                               |
|:-----------------------------------------------------------|:-----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|:----------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| tls.secretName                       | kubernetes secret name present in kubewall-system namespace containing your certs | ""  
| service.port                       | https port number to listen | 8443  |