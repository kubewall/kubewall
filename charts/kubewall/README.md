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