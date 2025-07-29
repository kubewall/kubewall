package k8s

import (
	"fmt"
	"log"
	"os"
	"sync"

	"helm.sh/helm/v3/pkg/action"
	"helm.sh/helm/v3/pkg/cli"
	"k8s.io/apimachinery/pkg/api/meta"
	"k8s.io/client-go/discovery"
	"k8s.io/client-go/rest"
	"k8s.io/client-go/restmapper"
	"k8s.io/client-go/tools/clientcmd"
	"k8s.io/client-go/tools/clientcmd/api"
)

// HelmClientFactory manages Helm action configuration instances
type HelmClientFactory struct {
	mu      sync.RWMutex
	clients map[string]*action.Configuration
}

// NewHelmClientFactory creates a new Helm client factory
func NewHelmClientFactory() *HelmClientFactory {
	return &HelmClientFactory{
		clients: make(map[string]*action.Configuration),
	}
}

// GetHelmClientForConfig returns a Helm action configuration for a specific config and cluster
func (f *HelmClientFactory) GetHelmClientForConfig(config *api.Config, clusterName string) (*action.Configuration, error) {
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

	// Create Helm settings
	settings := cli.New()

	// Create Helm action configuration
	actionConfig := new(action.Configuration)

	// Create a custom RESTClientGetter that uses our config
	restClientGetter := &CustomRESTClientGetter{
		restConfig: restConfig,
		namespace:  "default",
	}

	// Initialize the action configuration
	if err := actionConfig.Init(restClientGetter, settings.Namespace(), os.Getenv("HELM_DRIVER"), log.Printf); err != nil {
		return nil, fmt.Errorf("failed to initialize Helm action config: %w", err)
	}

	// Cache the client
	f.mu.Lock()
	f.clients[key] = actionConfig
	f.mu.Unlock()

	return actionConfig, nil
}

// CustomRESTClientGetter implements the RESTClientGetter interface for Helm
type CustomRESTClientGetter struct {
	restConfig *rest.Config
	namespace  string
}

// ToRESTConfig returns the REST config
func (r *CustomRESTClientGetter) ToRESTConfig() (*rest.Config, error) {
	return r.restConfig, nil
}

// ToDiscoveryClient returns the discovery client
func (r *CustomRESTClientGetter) ToDiscoveryClient() (discovery.CachedDiscoveryInterface, error) {
	config, err := r.ToRESTConfig()
	if err != nil {
		return nil, err
	}
	// Create a simple discovery client that implements CachedDiscoveryInterface
	discoveryClient, err := discovery.NewDiscoveryClientForConfig(config)
	if err != nil {
		return nil, err
	}
	return &cachedDiscoveryClient{discoveryClient}, nil
}

// cachedDiscoveryClient wraps discovery.DiscoveryClient to implement CachedDiscoveryInterface
type cachedDiscoveryClient struct {
	*discovery.DiscoveryClient
}

// Fresh implements CachedDiscoveryInterface
func (c *cachedDiscoveryClient) Fresh() bool {
	return true
}

// Invalidate implements CachedDiscoveryInterface
func (c *cachedDiscoveryClient) Invalidate() {
	// No-op for this implementation
}

// ToRESTMapper returns the REST mapper
func (r *CustomRESTClientGetter) ToRESTMapper() (meta.RESTMapper, error) {
	discoveryClient, err := r.ToDiscoveryClient()
	if err != nil {
		return nil, err
	}
	mapper := restmapper.NewDeferredDiscoveryRESTMapper(discoveryClient)
	expander := restmapper.NewShortcutExpander(mapper, discoveryClient, nil)
	return expander, nil
}

// ToRawKubeConfigLoader returns the raw kube config loader
func (r *CustomRESTClientGetter) ToRawKubeConfigLoader() clientcmd.ClientConfig {
	// Return a minimal client config
	return &minimalClientConfig{}
}

// minimalClientConfig implements clientcmd.ClientConfig
type minimalClientConfig struct{}

func (m *minimalClientConfig) RawConfig() (api.Config, error) {
	return api.Config{}, nil
}

func (m *minimalClientConfig) ClientConfig() (*rest.Config, error) {
	return nil, fmt.Errorf("not implemented")
}

func (m *minimalClientConfig) Namespace() (string, bool, error) {
	return "default", false, nil
}

func (m *minimalClientConfig) ConfigAccess() clientcmd.ConfigAccess {
	return nil
}

// Namespace returns the namespace
func (r *CustomRESTClientGetter) Namespace() (string, bool, error) {
	return r.namespace, false, nil
}

// ClearClients clears all cached clients
func (f *HelmClientFactory) ClearClients() {
	f.mu.Lock()
	defer f.mu.Unlock()
	f.clients = make(map[string]*action.Configuration)
}

// RemoveClient removes a specific client from cache
func (f *HelmClientFactory) RemoveClient(config *api.Config, clusterName string) {
	key := fmt.Sprintf("%p-%s", config, clusterName)
	f.mu.Lock()
	defer f.mu.Unlock()
	delete(f.clients, key)
}
