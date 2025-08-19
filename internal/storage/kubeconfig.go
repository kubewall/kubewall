package storage

import (
	"fmt"
	"sync"
	"time"

	"github.com/google/uuid"
	"k8s.io/client-go/tools/clientcmd/api"

	"github.com/Facets-cloud/kube-dash/internal/config"
)

// KubeConfig represents a kubeconfig configuration
type KubeConfig struct {
	ID       string            `json:"id"`
	Name     string            `json:"name"`
	Clusters map[string]string `json:"clusters"`
	Created  time.Time         `json:"created"`
	Updated  time.Time         `json:"updated"`
}

// ClusterStatus represents the status of a cluster
type ClusterStatus struct {
	Name      string `json:"name"`
	Namespace string `json:"namespace"`
	AuthInfo  string `json:"authInfo"`
	Reachable bool   `json:"reachable"`
	Error     string `json:"error,omitempty"`
}

// KubeConfigStore provides thread-safe storage for kubeconfigs
type KubeConfigStore struct {
	mu       sync.RWMutex
	configs  map[string]*api.Config
	metadata map[string]*KubeConfig
	db       DatabaseStorage // persistent storage backend
	useDB    bool            // whether to use persistent storage
}

// NewKubeConfigStore creates a new kubeconfig store with in-memory storage
func NewKubeConfigStore() *KubeConfigStore {
	return &KubeConfigStore{
		configs:  make(map[string]*api.Config),
		metadata: make(map[string]*KubeConfig),
		useDB:    false,
	}
}

// NewKubeConfigStoreWithDB creates a new kubeconfig store with persistent storage
func NewKubeConfigStoreWithDB(dbConfig *config.DatabaseConfig) (*KubeConfigStore, error) {
	factory := NewStorageFactory(dbConfig)
	
	// Validate configuration
	if err := factory.ValidateConfig(); err != nil {
		return nil, fmt.Errorf("invalid database configuration: %w", err)
	}

	// Create storage backend
	db, err := factory.CreateStorage()
	if err != nil {
		return nil, fmt.Errorf("failed to create storage backend: %w", err)
	}

	// Initialize the database
	if err := db.Initialize(); err != nil {
		return nil, fmt.Errorf("failed to initialize database: %w", err)
	}

	store := &KubeConfigStore{
		configs:  make(map[string]*api.Config),
		metadata: make(map[string]*KubeConfig),
		db:       db,
		useDB:    true,
	}

	// Load existing data from database into memory cache
	if err := store.loadFromDB(); err != nil {
		return nil, fmt.Errorf("failed to load existing data: %w", err)
	}

	return store, nil
}

// Close closes the database connection if using persistent storage
func (s *KubeConfigStore) Close() error {
	if s.useDB && s.db != nil {
		return s.db.Close()
	}
	return nil
}

// HasDatabase returns true if the store is using database storage
func (s *KubeConfigStore) HasDatabase() bool {
	return s.useDB && s.db != nil
}

// GetDatabase returns the underlying database storage interface
func (s *KubeConfigStore) GetDatabase() DatabaseStorage {
	if s.useDB && s.db != nil {
		return s.db
	}
	return nil
}

// loadFromDB loads existing kubeconfigs from the database into memory cache
func (s *KubeConfigStore) loadFromDB() error {
	if !s.useDB || s.db == nil {
		return nil
	}

	// Load metadata
	metadata, err := s.db.ListKubeConfigs()
	if err != nil {
		return fmt.Errorf("failed to load kubeconfig metadata: %w", err)
	}

	// Load configs and populate cache
	for id, meta := range metadata {
		config, err := s.db.GetKubeConfig(id)
		if err != nil {
			// Log error but continue loading other configs
			continue
		}
		s.configs[id] = config
		s.metadata[id] = meta
	}

	return nil
}

// HealthCheck verifies the storage backend is healthy
func (s *KubeConfigStore) HealthCheck() error {
	if s.useDB && s.db != nil {
		return s.db.HealthCheck()
	}
	return nil // In-memory storage is always healthy
}

// AddKubeConfig adds a kubeconfig to the store
func (s *KubeConfigStore) AddKubeConfig(config *api.Config, name string) (string, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	// Validate the config
	if err := s.validateConfig(config); err != nil {
		return "", fmt.Errorf("invalid kubeconfig: %w", err)
	}

	// Generate unique ID using UUID
	id := uuid.New().String()

	now := time.Now()

	// Extract cluster names
	clusters := make(map[string]string)
	for clusterName := range config.Clusters {
		clusters[clusterName] = clusterName
	}

	// Store in persistent storage if available
	if s.useDB && s.db != nil {
		if err := s.db.AddKubeConfig(id, name, config, clusters, now, now); err != nil {
			return "", fmt.Errorf("failed to store kubeconfig in database: %w", err)
		}
	}

	// Store in memory cache
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

	// Try memory cache first
	config, exists := s.configs[id]
	if exists {
		return config, nil
	}

	// If using database and not in cache, try database
	if s.useDB && s.db != nil {
		dbConfig, err := s.db.GetKubeConfig(id)
		if err == nil {
			// Cache the result
			s.configs[id] = dbConfig
			return dbConfig, nil
		}
	}

	return nil, fmt.Errorf("kubeconfig not found: %s", id)
}

// GetKubeConfigMetadata retrieves kubeconfig metadata by ID
func (s *KubeConfigStore) GetKubeConfigMetadata(id string) (*KubeConfig, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	// Try memory cache first
	metadata, exists := s.metadata[id]
	if exists {
		return metadata, nil
	}

	// If using database and not in cache, try database
	if s.useDB && s.db != nil {
		dbMetadata, err := s.db.GetKubeConfigMetadata(id)
		if err == nil {
			// Cache the result
			s.metadata[id] = dbMetadata
			return dbMetadata, nil
		}
	}

	return nil, fmt.Errorf("kubeconfig not found: %s", id)
}

// ListKubeConfigs returns all kubeconfig metadata
func (s *KubeConfigStore) ListKubeConfigs() map[string]*KubeConfig {
	s.mu.RLock()
	defer s.mu.RUnlock()

	// If using database, ensure we have the latest data
	if s.useDB && s.db != nil {
		if dbMetadata, err := s.db.ListKubeConfigs(); err == nil {
			// Update memory cache with database data
			for id, metadata := range dbMetadata {
				s.metadata[id] = metadata
			}
		}
	}

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

	// Check if exists in memory cache or database
	_, existsInMemory := s.configs[id]
	existsInDB := false
	if s.useDB && s.db != nil {
		if _, err := s.db.GetKubeConfigMetadata(id); err == nil {
			existsInDB = true
		}
	}

	if !existsInMemory && !existsInDB {
		return fmt.Errorf("kubeconfig not found: %s", id)
	}

	// Delete from database if using persistent storage
	if s.useDB && s.db != nil && existsInDB {
		if err := s.db.DeleteKubeConfig(id); err != nil {
			return fmt.Errorf("failed to delete kubeconfig from database: %w", err)
		}
	}

	// Delete from memory cache
	delete(s.configs, id)
	delete(s.metadata, id)

	return nil
}

// UpdateKubeConfig updates an existing kubeconfig
func (s *KubeConfigStore) UpdateKubeConfig(id string, config *api.Config, name string) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	// Check if exists in memory cache or database
	_, existsInMemory := s.configs[id]
	existsInDB := false
	if s.useDB && s.db != nil {
		if _, err := s.db.GetKubeConfigMetadata(id); err == nil {
			existsInDB = true
		}
	}

	if !existsInMemory && !existsInDB {
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

	now := time.Now()

	// Update in database if using persistent storage
	if s.useDB && s.db != nil {
		if err := s.db.UpdateKubeConfig(id, name, config, clusters, now); err != nil {
			return fmt.Errorf("failed to update kubeconfig in database: %w", err)
		}
	}

	// Update in memory cache
	s.configs[id] = config
	if s.metadata[id] == nil {
		// Create metadata if it doesn't exist in memory
		s.metadata[id] = &KubeConfig{
			ID:       id,
			Name:     name,
			Clusters: clusters,
			Created:  now, // We don't know the original created time
			Updated:  now,
		}
	} else {
		s.metadata[id].Name = name
		s.metadata[id].Clusters = clusters
		s.metadata[id].Updated = now
	}

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

			// For now, we'll set connected to true and let the frontend handle reachability
			// In a future enhancement, we could store and return actual connectivity status
			clusters[contextName] = map[string]interface{}{
				"name":      contextName,
				"namespace": namespace,
				"authInfo":  authInfoName,
				"connected": true, // This will be updated by frontend validation
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
