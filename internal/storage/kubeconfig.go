package storage

import (
	"fmt"
	"sync"
	"time"

	"k8s.io/client-go/tools/clientcmd/api"
)

// KubeConfig represents a kubeconfig configuration
type KubeConfig struct {
	ID       string            `json:"id"`
	Name     string            `json:"name"`
	Clusters map[string]string `json:"clusters"`
	Created  time.Time         `json:"created"`
	Updated  time.Time         `json:"updated"`
}

// KubeConfigStore provides thread-safe storage for kubeconfigs
type KubeConfigStore struct {
	mu       sync.RWMutex
	configs  map[string]*api.Config
	metadata map[string]*KubeConfig
	nextID   int
}

// NewKubeConfigStore creates a new kubeconfig store
func NewKubeConfigStore() *KubeConfigStore {
	return &KubeConfigStore{
		configs:  make(map[string]*api.Config),
		metadata: make(map[string]*KubeConfig),
		nextID:   1,
	}
}

// AddKubeConfig adds a kubeconfig to the store
func (s *KubeConfigStore) AddKubeConfig(config *api.Config, name string) (string, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	// Validate the config
	if err := s.validateConfig(config); err != nil {
		return "", fmt.Errorf("invalid kubeconfig: %w", err)
	}

	// Generate unique ID
	id := fmt.Sprintf("config-%d", s.nextID)
	s.nextID++

	now := time.Now()

	// Extract cluster names
	clusters := make(map[string]string)
	for clusterName := range config.Clusters {
		clusters[clusterName] = clusterName
	}

	// Store the config
	s.configs[id] = config
	s.metadata[id] = &KubeConfig{
		ID:       id,
		Name:     name,
		Clusters: clusters,
		Created:  now,
		Updated:  now,
	}

	return id, nil
}

// GetKubeConfig retrieves a kubeconfig by ID
func (s *KubeConfigStore) GetKubeConfig(id string) (*api.Config, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	config, exists := s.configs[id]
	if !exists {
		return nil, fmt.Errorf("kubeconfig not found: %s", id)
	}

	return config, nil
}

// GetKubeConfigMetadata retrieves kubeconfig metadata by ID
func (s *KubeConfigStore) GetKubeConfigMetadata(id string) (*KubeConfig, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	metadata, exists := s.metadata[id]
	if !exists {
		return nil, fmt.Errorf("kubeconfig not found: %s", id)
	}

	return metadata, nil
}

// ListKubeConfigs returns all kubeconfig metadata
func (s *KubeConfigStore) ListKubeConfigs() map[string]*KubeConfig {
	s.mu.RLock()
	defer s.mu.RUnlock()

	result := make(map[string]*KubeConfig)
	for id, metadata := range s.metadata {
		result[id] = metadata
	}

	return result
}

// DeleteKubeConfig removes a kubeconfig by ID
func (s *KubeConfigStore) DeleteKubeConfig(id string) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	if _, exists := s.configs[id]; !exists {
		return fmt.Errorf("kubeconfig not found: %s", id)
	}

	delete(s.configs, id)
	delete(s.metadata, id)

	return nil
}

// UpdateKubeConfig updates an existing kubeconfig
func (s *KubeConfigStore) UpdateKubeConfig(id string, config *api.Config, name string) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	if _, exists := s.configs[id]; !exists {
		return fmt.Errorf("kubeconfig not found: %s", id)
	}

	// Validate the new config
	if err := s.validateConfig(config); err != nil {
		return fmt.Errorf("invalid kubeconfig: %w", err)
	}

	// Extract cluster names
	clusters := make(map[string]string)
	for clusterName := range config.Clusters {
		clusters[clusterName] = clusterName
	}

	// Update the config
	s.configs[id] = config
	s.metadata[id].Name = name
	s.metadata[id].Clusters = clusters
	s.metadata[id].Updated = time.Now()

	return nil
}

// validateConfig validates a kubeconfig
func (s *KubeConfigStore) validateConfig(config *api.Config) error {
	if config == nil {
		return fmt.Errorf("config is nil")
	}

	if len(config.Clusters) == 0 {
		return fmt.Errorf("no clusters defined")
	}

	if len(config.Contexts) == 0 {
		return fmt.Errorf("no contexts defined")
	}

	if len(config.AuthInfos) == 0 {
		return fmt.Errorf("no auth infos defined")
	}

	// Validate that all contexts reference valid clusters and auth infos
	for contextName, context := range config.Contexts {
		if context.Cluster == "" {
			return fmt.Errorf("context %s has no cluster", contextName)
		}
		if context.AuthInfo == "" {
			return fmt.Errorf("context %s has no auth info", contextName)
		}
		if _, exists := config.Clusters[context.Cluster]; !exists {
			return fmt.Errorf("context %s references non-existent cluster %s", contextName, context.Cluster)
		}
		if _, exists := config.AuthInfos[context.AuthInfo]; !exists {
			return fmt.Errorf("context %s references non-existent auth info %s", contextName, context.AuthInfo)
		}
	}

	return nil
}

// GetClustersResponse returns the response format expected by the frontend
func (s *KubeConfigStore) GetClustersResponse() map[string]interface{} {
	s.mu.RLock()
	defer s.mu.RUnlock()

	kubeConfigs := make(map[string]interface{})
	for id, metadata := range s.metadata {
		config := s.configs[id]
		if config == nil {
			continue
		}

		// Build detailed cluster information
		clusters := make(map[string]interface{})
		for contextName, context := range config.Contexts {
			authInfoName := context.AuthInfo

			// Get namespace from context if available
			namespace := "default"
			if context.Namespace != "" {
				namespace = context.Namespace
			}

			clusters[contextName] = map[string]interface{}{
				"name":      contextName,
				"namespace": namespace,
				"authInfo":  authInfoName,
				"connected": true, // TODO: Implement actual connection testing
			}
		}

		kubeConfigs[id] = map[string]interface{}{
			"name":     metadata.Name,
			"clusters": clusters,
		}
	}

	return map[string]interface{}{
		"kubeConfigs": kubeConfigs,
		"version":     "v1",
	}
}
