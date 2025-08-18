package k8s

import (
	"context"
	"fmt"
	"sync"

	"github.com/Facets-cloud/kube-dash/internal/tracing"

	"k8s.io/client-go/kubernetes"
	"k8s.io/client-go/tools/clientcmd"
	"k8s.io/client-go/tools/clientcmd/api"
	metricsclient "k8s.io/metrics/pkg/client/clientset/versioned"
)

// ClientFactory manages Kubernetes client instances
type ClientFactory struct {
	mu            sync.RWMutex
	clients       map[string]*kubernetes.Clientset
	metrics       map[string]*metricsclient.Clientset
	tracingHelper *tracing.TracingHelper
}

// NewClientFactory creates a new client factory
func NewClientFactory() *ClientFactory {
	return &ClientFactory{
		clients:       make(map[string]*kubernetes.Clientset),
		metrics:       make(map[string]*metricsclient.Clientset),
		tracingHelper: tracing.GetTracingHelper(),
	}
}

// GetClientForConfig returns a Kubernetes client for a specific config and cluster
func (f *ClientFactory) GetClientForConfig(config *api.Config, clusterName string) (*kubernetes.Clientset, error) {
	return f.GetClientForConfigWithContext(context.Background(), config, clusterName)
}

// GetClientForConfigWithContext returns a Kubernetes client for a specific config and cluster with tracing context
func (f *ClientFactory) GetClientForConfigWithContext(ctx context.Context, config *api.Config, clusterName string) (*kubernetes.Clientset, error) {
	// Start child span for client creation
	ctx, clientSpan := f.tracingHelper.StartAuthSpan(ctx, "create-k8s-client")
	defer clientSpan.End()

	// Create a unique key for this config+cluster combination
	key := fmt.Sprintf("%p-%s", config, clusterName)
	f.tracingHelper.AddResourceAttributes(clientSpan, clusterName, "k8s-client", 1)

	// Start child span for cache lookup
	_, cacheSpan := f.tracingHelper.StartDataProcessingSpan(ctx, "check-client-cache")
	defer cacheSpan.End()

	f.mu.RLock()
	if client, exists := f.clients[key]; exists {
		f.mu.RUnlock()
		f.tracingHelper.RecordSuccess(cacheSpan, "Client found in cache")
		f.tracingHelper.RecordSuccess(clientSpan, "Retrieved cached Kubernetes client")
		return client, nil
	}
	f.mu.RUnlock()
	f.tracingHelper.RecordSuccess(cacheSpan, "Client not in cache, creating new")

	// Start child span for config processing
	_, configSpan := f.tracingHelper.StartDataProcessingSpan(ctx, "process-kubeconfig")
	defer configSpan.End()

	// Create a copy of the config and set the context to the specific cluster
	configCopy := config.DeepCopy()

	// Find the context that matches the cluster name
	contextFound := false
	for contextName, context := range configCopy.Contexts {
		if context.Cluster == clusterName {
			configCopy.CurrentContext = contextName
			contextFound = true
			break
		}
	}

	// If no matching context found, use the first context
	if !contextFound && len(configCopy.Contexts) > 0 {
		for contextName := range configCopy.Contexts {
			configCopy.CurrentContext = contextName
			break
		}
	}
	f.tracingHelper.AddResourceAttributes(configSpan, configCopy.CurrentContext, "k8s-context", len(configCopy.Contexts))
	f.tracingHelper.RecordSuccess(configSpan, fmt.Sprintf("Processed kubeconfig with context: %s", configCopy.CurrentContext))

	// Start child span for REST config creation
	_, restConfigSpan := f.tracingHelper.StartKubernetesAPISpan(ctx, "create", "rest-config", "")
	defer restConfigSpan.End()

	// Create client config
	clientConfig := clientcmd.NewDefaultClientConfig(*configCopy, &clientcmd.ConfigOverrides{})
	restConfig, err := clientConfig.ClientConfig()
	if err != nil {
		f.tracingHelper.RecordError(restConfigSpan, err, "Failed to create REST config")
		f.tracingHelper.RecordError(clientSpan, err, "Failed to create client config")
		return nil, fmt.Errorf("failed to create client config: %w", err)
	}
	f.tracingHelper.AddResourceAttributes(restConfigSpan, restConfig.Host, "k8s-host", 1)
	f.tracingHelper.RecordSuccess(restConfigSpan, fmt.Sprintf("Created REST config for host: %s", restConfig.Host))

	// Start child span for Kubernetes client creation
	_, k8sClientSpan := f.tracingHelper.StartKubernetesAPISpan(ctx, "create", "k8s-clientset", "")
	defer k8sClientSpan.End()

	// Create Kubernetes client
	client, err := kubernetes.NewForConfig(restConfig)
	if err != nil {
		f.tracingHelper.RecordError(k8sClientSpan, err, "Failed to create Kubernetes client")
		f.tracingHelper.RecordError(clientSpan, err, "Failed to create Kubernetes client")
		return nil, fmt.Errorf("failed to create Kubernetes client: %w", err)
	}
	f.tracingHelper.RecordSuccess(k8sClientSpan, "Created Kubernetes clientset")

	// Start child span for caching
	_, cacheStoreSpan := f.tracingHelper.StartDataProcessingSpan(ctx, "cache-client")
	defer cacheStoreSpan.End()

	// Cache the client
	f.mu.Lock()
	f.clients[key] = client
	f.mu.Unlock()
	f.tracingHelper.RecordSuccess(cacheStoreSpan, "Cached Kubernetes client")
	f.tracingHelper.RecordSuccess(clientSpan, fmt.Sprintf("Successfully created and cached Kubernetes client for cluster: %s", clusterName))

	return client, nil
}

// GetClientForConfigID returns a Kubernetes client for a config ID and cluster
func (f *ClientFactory) GetClientForConfigID(config *api.Config, configID, clusterName string) (*kubernetes.Clientset, error) {
	return f.GetClientForConfig(config, clusterName)
}

// ClearClients clears all cached clients
func (f *ClientFactory) ClearClients() {
	f.mu.Lock()
	defer f.mu.Unlock()
	f.clients = make(map[string]*kubernetes.Clientset)
	f.metrics = make(map[string]*metricsclient.Clientset)
}

// RemoveClient removes a specific client from cache
func (f *ClientFactory) RemoveClient(config *api.Config, clusterName string) {
	key := fmt.Sprintf("%p-%s", config, clusterName)
	f.mu.Lock()
	defer f.mu.Unlock()
	delete(f.clients, key)
	delete(f.metrics, key)
}

// GetMetricsClientForConfig returns a Metrics client for a specific config and cluster
func (f *ClientFactory) GetMetricsClientForConfig(config *api.Config, clusterName string) (*metricsclient.Clientset, error) {
	key := fmt.Sprintf("%p-%s", config, clusterName)

	f.mu.RLock()
	if client, exists := f.metrics[key]; exists {
		f.mu.RUnlock()
		return client, nil
	}
	f.mu.RUnlock()

	// Create a copy of the config and set the context to the specific cluster
	configCopy := config.DeepCopy()
	for contextName, context := range configCopy.Contexts {
		if context.Cluster == clusterName {
			configCopy.CurrentContext = contextName
			break
		}
	}
	if configCopy.CurrentContext == "" && len(configCopy.Contexts) > 0 {
		for contextName := range configCopy.Contexts {
			configCopy.CurrentContext = contextName
			break
		}
	}

	clientConfig := clientcmd.NewDefaultClientConfig(*configCopy, &clientcmd.ConfigOverrides{})
	restConfig, err := clientConfig.ClientConfig()
	if err != nil {
		return nil, fmt.Errorf("failed to create client config: %w", err)
	}

	metricsClient, err := metricsclient.NewForConfig(restConfig)
	if err != nil {
		return nil, fmt.Errorf("failed to create Metrics client: %w", err)
	}

	f.mu.Lock()
	f.metrics[key] = metricsClient
	f.mu.Unlock()

	return metricsClient, nil
}
