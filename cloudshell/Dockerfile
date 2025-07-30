FROM ubuntu:22.04

# Set environment variables
ENV DEBIAN_FRONTEND=noninteractive
ENV KUBECTL_VERSION=v1.28.0
ENV HELM_VERSION=v3.14.0

# Install basic packages
RUN apt-get update && apt-get install -y \
    curl \
    wget \
    git \
    vim \
    nano \
    less \
    jq \
    yq \
    bash-completion \
    && rm -rf /var/lib/apt/lists/*

# Install kubectl
RUN curl -LO "https://dl.k8s.io/release/${KUBECTL_VERSION}/bin/linux/amd64/kubectl" \
    && chmod +x kubectl \
    && mv kubectl /usr/local/bin/

# Install helm
RUN curl -LO "https://get.helm.sh/helm-${HELM_VERSION}-linux-amd64.tar.gz" \
    && tar -xzf helm-${HELM_VERSION}-linux-amd64.tar.gz \
    && mv linux-amd64/helm /usr/local/bin/ \
    && rm -rf linux-amd64 helm-${HELM_VERSION}-linux-amd64.tar.gz

# Install kubectl bash completion
RUN kubectl completion bash > /etc/bash_completion.d/kubectl

# Install helm bash completion
RUN helm completion bash > /etc/bash_completion.d/helm

# Set up shell environment
RUN echo 'source /etc/bash_completion.d/kubectl' >> /root/.bashrc \
    && echo 'source /etc/bash_completion.d/helm' >> /root/.bashrc \
    && echo 'alias k=kubectl' >> /root/.bashrc \
    && echo 'complete -o default -F __start_kubectl k' >> /root/.bashrc \
    && echo 'export PATH=/usr/local/bin:$PATH' >> /root/.bashrc

# Create a non-root user
RUN useradd -m -s /bin/bash cloudshell \
    && mkdir -p /home/cloudshell/.kube \
    && chown -R cloudshell:cloudshell /home/cloudshell

# Copy bashrc to user
RUN cp /root/.bashrc /home/cloudshell/.bashrc \
    && chown cloudshell:cloudshell /home/cloudshell/.bashrc

# Set working directory
WORKDIR /home/cloudshell

# Switch to non-root user
USER cloudshell

# Set default command
CMD ["/bin/bash"] 