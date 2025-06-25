# Stage 1: Build the Go application and download kubectl for the correct architecture
FROM --platform=$BUILDPLATFORM public.ecr.aws/docker/library/golang:1.24 as builder

WORKDIR /app
ARG TARGETARCH
# Update the package list and install unzip
RUN apt update && apt install -y unzip
# Install kubectl for the correct architecture
# Using TARGETARCH to ensure the right binary is downloaded
RUN ARCH=$(case $TARGETARCH in \
    amd64) echo "amd64" ;; \
    arm64) echo "arm64" ;; \
    esac) \
    && curl -LO "https://dl.k8s.io/release/$(curl -L -s https://dl.k8s.io/release/stable.txt)/bin/linux/${TARGETARCH}/kubectl" \
    && chmod +x kubectl

# Install kubelogin (OIDC plugin)
RUN ARCH=$(case $TARGETARCH in \
    amd64) echo "amd64" ;; \
    arm64) echo "arm64" ;; \
    esac) \
    && curl -Lo kubectl-oidc_login.zip https://github.com/int128/kubelogin/releases/latest/download/kubelogin_linux_${TARGETARCH}.zip \
    && unzip kubectl-oidc_login.zip \
    && mv kubelogin kubectl-oidc_login \
    && chmod +x kubectl-oidc_login

# Stage 2: Create the final scratch image with the compiled binaries
FROM --platform=$BUILDPLATFORM gcr.io/distroless/static-debian12
COPY --from=builder /app/kubectl /usr/bin/kubectl
COPY --from=builder /app/kubectl-oidc_login /usr/bin/kubectl-oidc_login
COPY kubewall /usr/bin/kubewall
ENV HOME="/"
ENTRYPOINT ["/usr/bin/kubewall"]