package k8s

import (
	"fmt"
	"sync"

	"k8s.io/client-go/kubernetes"
	"k8s.io/client-go/tools/clientcmd"
	"k8s.io/client-go/tools/clientcmd/api"
)

// ClientFactory manages Kubernetes client instances
type ClientFactory struct {
	mu      sync.RWMutex
	clients map[string]*kubernetes.Clientset
}

// NewClientFactory creates a new client factory
func NewClientFactory() *ClientFactory {
	return &ClientFactory{
		clients: make(map[string]*kubernetes.Clientset),
	}
}

// GetClientForConfig returns a Kubernetes client for a specific config and cluster
func (f *ClientFactory) GetClientForConfig(config *api.Config, clusterName string) (*kubernetes.Clientset, error) {
	// Create a unique key for this config+cluster combination
	key := fmt.Sprintf("%p-%s", config, clusterName)

	f.mu.RLock()
	if client, exists := f.clients[key]; exists {
		f.mu.RUnlock()
		return client, nil
	}
	f.mu.RUnlock()

	// Create a copy of the config and set the context to the specific cluster
	configCopy := config.DeepCopy()

	// Find the context that matches the cluster name
	for contextName, context := range configCopy.Contexts {
		if context.Cluster == clusterName {
			configCopy.CurrentContext = contextName
			break
		}
	}

	// If no matching context found, use the first context
	if configCopy.CurrentContext == "" && len(configCopy.Contexts) > 0 {
		for contextName := range configCopy.Contexts {
			configCopy.CurrentContext = contextName
			break
		}
	}

	// Create client config
	clientConfig := clientcmd.NewDefaultClientConfig(*configCopy, &clientcmd.ConfigOverrides{})
	restConfig, err := clientConfig.ClientConfig()
	if err != nil {
		return nil, fmt.Errorf("failed to create client config: %w", err)
	}

	// Create Kubernetes client
	client, err := kubernetes.NewForConfig(restConfig)
	if err != nil {
		return nil, fmt.Errorf("failed to create Kubernetes client: %w", err)
	}

	// Cache the client
	f.mu.Lock()
	f.clients[key] = client
	f.mu.Unlock()

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
}

// RemoveClient removes a specific client from cache
func (f *ClientFactory) RemoveClient(config *api.Config, clusterName string) {
	key := fmt.Sprintf("%p-%s", config, clusterName)
	f.mu.Lock()
	defer f.mu.Unlock()
	delete(f.clients, key)
}
