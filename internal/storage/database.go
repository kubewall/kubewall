package storage

import (
	"time"

	"k8s.io/client-go/tools/clientcmd/api"
	"github.com/Facets-cloud/kube-dash/internal/types"
)

// DatabaseStorage defines the interface for persistent storage operations
type DatabaseStorage interface {
	// Initialize sets up the database connection and creates necessary tables
	Initialize() error

	// Close closes the database connection
	Close() error

	// AddKubeConfig stores a kubeconfig in the database
	AddKubeConfig(id, name string, config *api.Config, clusters map[string]string, created, updated time.Time) error

	// GetKubeConfig retrieves a kubeconfig by ID
	GetKubeConfig(id string) (*api.Config, error)

	// GetKubeConfigMetadata retrieves kubeconfig metadata by ID
	GetKubeConfigMetadata(id string) (*KubeConfig, error)

	// ListKubeConfigs returns all kubeconfig metadata
	ListKubeConfigs() (map[string]*KubeConfig, error)

	// UpdateKubeConfig updates an existing kubeconfig
	UpdateKubeConfig(id, name string, config *api.Config, clusters map[string]string, updated time.Time) error

	// DeleteKubeConfig removes a kubeconfig by ID
	DeleteKubeConfig(id string) error

	// HealthCheck verifies the database connection is healthy
	HealthCheck() error

	// Trace storage operations
	StoreTrace(trace *types.Trace) error
	GetTrace(traceID string) (*types.Trace, error)
	QueryTraces(filter types.TraceFilter) ([]*types.Trace, int, error)
	DeleteExpiredTraces(cutoff time.Time) error

	// Cache storage operations
	SetCache(key string, data []byte, expiresAt time.Time) error
	GetCache(key string) ([]byte, time.Time, error)
	DeleteExpiredCache(cutoff time.Time) error
	ClearCache() error
}

// StorageType represents the type of storage backend
type StorageType string

const (
	StorageTypeMemory   StorageType = "memory"
	StorageTypeSQLite   StorageType = "sqlite"
	StorageTypePostgres StorageType = "postgres"
)