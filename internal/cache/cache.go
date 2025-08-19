package cache

import (
	"encoding/json"
	"fmt"
	"sync"
	"time"

	"github.com/Facets-cloud/kube-dash/internal/storage"
)

// Cache defines the interface for caching operations
type Cache interface {
	// Set stores data in cache with TTL
	Set(key string, data interface{}, ttl time.Duration) error
	// Get retrieves data from cache if it exists and is not expired
	Get(key string) (interface{}, bool, error)
	// Delete removes a specific cache entry
	Delete(key string) error
	// Clear removes all cache entries
	Clear() error
	// CleanupExpired removes expired cache entries
	CleanupExpired() error
}

// MemoryCache implements Cache interface using in-memory storage
type MemoryCache struct {
	cache map[string]CacheEntry
	mutex sync.RWMutex
}

// CacheEntry represents a cached item with expiration
type CacheEntry struct {
	Data      interface{} `json:"data"`
	ExpiresAt time.Time   `json:"expiresAt"`
}

// NewMemoryCache creates a new in-memory cache
func NewMemoryCache() *MemoryCache {
	return &MemoryCache{
		cache: make(map[string]CacheEntry),
	}
}

// Set stores data in memory cache with TTL
func (mc *MemoryCache) Set(key string, data interface{}, ttl time.Duration) error {
	mc.mutex.Lock()
	defer mc.mutex.Unlock()

	mc.cache[key] = CacheEntry{
		Data:      data,
		ExpiresAt: time.Now().Add(ttl),
	}
	return nil
}

// Get retrieves data from memory cache if it exists and is not expired
func (mc *MemoryCache) Get(key string) (interface{}, bool, error) {
	mc.mutex.RLock()
	defer mc.mutex.RUnlock()

	if entry, exists := mc.cache[key]; exists && time.Now().Before(entry.ExpiresAt) {
		return entry.Data, true, nil
	}
	return nil, false, nil
}

// Delete removes a specific cache entry from memory
func (mc *MemoryCache) Delete(key string) error {
	mc.mutex.Lock()
	defer mc.mutex.Unlock()

	delete(mc.cache, key)
	return nil
}

// Clear removes all cache entries from memory
func (mc *MemoryCache) Clear() error {
	mc.mutex.Lock()
	defer mc.mutex.Unlock()

	mc.cache = make(map[string]CacheEntry)
	return nil
}

// CleanupExpired removes expired cache entries from memory
func (mc *MemoryCache) CleanupExpired() error {
	mc.mutex.Lock()
	defer mc.mutex.Unlock()

	now := time.Now()
	for key, entry := range mc.cache {
		if now.After(entry.ExpiresAt) {
			delete(mc.cache, key)
		}
	}
	return nil
}

// DatabaseCache implements Cache interface using database storage
type DatabaseCache struct {
	db storage.DatabaseStorage
}

// NewDatabaseCache creates a new database-backed cache
func NewDatabaseCache(db storage.DatabaseStorage) *DatabaseCache {
	return &DatabaseCache{
		db: db,
	}
}

// Set stores data in database cache with TTL
func (dc *DatabaseCache) Set(key string, data interface{}, ttl time.Duration) error {
	// Serialize data to JSON
	dataBytes, err := json.Marshal(data)
	if err != nil {
		return fmt.Errorf("failed to marshal cache data: %w", err)
	}

	expiresAt := time.Now().Add(ttl)
	return dc.db.SetCache(key, dataBytes, expiresAt)
}

// Get retrieves data from database cache if it exists and is not expired
func (dc *DatabaseCache) Get(key string) (interface{}, bool, error) {
	dataBytes, expiresAt, err := dc.db.GetCache(key)
	if err != nil {
		// Cache miss or expired
		return nil, false, nil
	}

	// Check if still valid (database should handle this, but double-check)
	if time.Now().After(expiresAt) {
		return nil, false, nil
	}

	// Deserialize data from JSON
	var data interface{}
	if err := json.Unmarshal(dataBytes, &data); err != nil {
		return nil, false, fmt.Errorf("failed to unmarshal cache data: %w", err)
	}

	return data, true, nil
}

// Delete removes a specific cache entry from database
func (dc *DatabaseCache) Delete(key string) error {
	// For now, we'll implement this by setting an expired entry
	// A more efficient approach would be to add a DeleteCache method to DatabaseStorage
	return dc.db.SetCache(key, []byte("{}"), time.Now().Add(-1*time.Hour))
}

// Clear removes all cache entries from database
func (dc *DatabaseCache) Clear() error {
	return dc.db.ClearCache()
}

// CleanupExpired removes expired cache entries from database
func (dc *DatabaseCache) CleanupExpired() error {
	return dc.db.DeleteExpiredCache(time.Now())
}

// CacheManager provides a unified interface for cache operations with automatic cleanup
type CacheManager struct {
	cache       Cache
	cleanupTick *time.Ticker
	stopCleanup chan bool
}

// NewCacheManager creates a new cache manager with automatic cleanup
func NewCacheManager(cache Cache, cleanupInterval time.Duration) *CacheManager {
	cm := &CacheManager{
		cache:       cache,
		cleanupTick: time.NewTicker(cleanupInterval),
		stopCleanup: make(chan bool),
	}

	// Start background cleanup
	go cm.startCleanup()

	return cm
}

// Set stores data in cache with TTL
func (cm *CacheManager) Set(key string, data interface{}, ttl time.Duration) error {
	return cm.cache.Set(key, data, ttl)
}

// Get retrieves data from cache if it exists and is not expired
func (cm *CacheManager) Get(key string) (interface{}, bool, error) {
	return cm.cache.Get(key)
}

// Delete removes a specific cache entry
func (cm *CacheManager) Delete(key string) error {
	return cm.cache.Delete(key)
}

// Clear removes all cache entries
func (cm *CacheManager) Clear() error {
	return cm.cache.Clear()
}

// Close stops the cache manager and cleanup routine
func (cm *CacheManager) Close() {
	if cm.cleanupTick != nil {
		cm.cleanupTick.Stop()
	}
	if cm.stopCleanup != nil {
		cm.stopCleanup <- true
		close(cm.stopCleanup)
	}
}

// startCleanup runs periodic cache cleanup
func (cm *CacheManager) startCleanup() {
	for {
		select {
		case <-cm.cleanupTick.C:
			if err := cm.cache.CleanupExpired(); err != nil {
				// Log error but continue (in a real implementation, use proper logger)
				fmt.Printf("Warning: cache cleanup failed: %v\n", err)
			}
		case <-cm.stopCleanup:
			return
		}
	}
}

// GetCacheKey generates a cache key for the given parameters
func GetCacheKey(operation string, params ...string) string {
	key := operation
	for _, param := range params {
		key += ":" + param
	}
	return key
}