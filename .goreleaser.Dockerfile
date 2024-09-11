# Stage 1: Build the Go application and download kubectl for the correct architecture
FROM --platform=$BUILDPLATFORM public.ecr.aws/docker/library/golang:1.21 as builder

WORKDIR /app
ARG TARGETARCH

# Set the kubectl version
ENV KUBECTL_VERSION=v1.31.0

# Install kubectl for the correct architecture
# Using TARGETARCH to ensure the right binary is downloaded
RUN ARCH=$(case $TARGETARCH in \
    amd64) echo "amd64" ;; \
    arm64) echo "arm64" ;; \
    esac) \
    && curl -LO "https://dl.k8s.io/release/${KUBECTL_VERSION}/bin/linux/${TARGETARCH}/kubectl" \
    && chmod +x kubectl

# Stage 2: Create the final distroless image with the compiled binaries
FROM --platform=$BUILDPLATFORM scratch
COPY --from=builder /app/kubectl /usr/bin/kubectl
COPY kubewall /usr/bin/kubewall
ENTRYPOINT ["/usr/bin/kubewall"]