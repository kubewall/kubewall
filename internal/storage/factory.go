package storage

import (
	"fmt"
	"strings"

	"github.com/Facets-cloud/kube-dash/internal/config"
)

// StorageFactory creates storage instances based on configuration
type StorageFactory struct {
	config *config.DatabaseConfig
}

// NewStorageFactory creates a new storage factory
func NewStorageFactory(cfg *config.DatabaseConfig) *StorageFactory {
	return &StorageFactory{
		config: cfg,
	}
}

// CreateStorage creates a storage instance based on the configured type
func (f *StorageFactory) CreateStorage() (DatabaseStorage, error) {
	dbType := strings.ToLower(strings.TrimSpace(f.config.Type))

	switch dbType {
	case "sqlite", "":
		// Default to SQLite if no type specified or empty
		path := f.config.Path
		if path == "" {
			path = "./kube-dash.db"
		}
		return NewSQLiteStorage(path), nil

	case "postgres", "postgresql":
		if f.config.URL == "" {
			return nil, fmt.Errorf("PostgreSQL URL is required when using postgres storage type")
		}
		return NewPostgresStorage(f.config.URL), nil

	default:
		return nil, fmt.Errorf("unsupported storage type: %s (supported: sqlite, postgres)", dbType)
	}
}

// ValidateConfig validates the storage configuration
func (f *StorageFactory) ValidateConfig() error {
	dbType := strings.ToLower(strings.TrimSpace(f.config.Type))

	switch dbType {
	case "sqlite", "":
		// SQLite is always valid, path will default if empty
		return nil

	case "postgres", "postgresql":
		if f.config.URL == "" {
			return fmt.Errorf("DATABASE_URL environment variable is required for PostgreSQL")
		}
		// Basic URL validation
		if !strings.Contains(f.config.URL, "postgres://") && !strings.Contains(f.config.URL, "postgresql://") {
			return fmt.Errorf("invalid PostgreSQL URL format, should start with postgres:// or postgresql://")
		}
		return nil

	default:
		return fmt.Errorf("unsupported storage type: %s (supported: sqlite, postgres)", dbType)
	}
}

// GetStorageType returns the normalized storage type
func (f *StorageFactory) GetStorageType() StorageType {
	dbType := strings.ToLower(strings.TrimSpace(f.config.Type))

	switch dbType {
	case "sqlite", "":
		return StorageTypeSQLite
	case "postgres", "postgresql":
		return StorageTypePostgres
	default:
		return StorageTypeMemory // fallback to memory if unknown
	}
}