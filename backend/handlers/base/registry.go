package base

import "sync"

// handlerRegistry caches handler instances per (config, cluster) so each HTTP
// request reuses the wrapper around the shared informer instead of rebuilding
// it (and re-running WaitForSync) on every call.
var handlerRegistry sync.Map

// clusterInitOnce guards the one-time per-cluster setup performed the first
// time a request selects a cluster: resource discovery and the fan-out that
// starts every informer. It lives here rather than beside that middleware so
// Reset can clear it together with the caches it gates.
var clusterInitOnce sync.Map

// GetOrCreateHandler returns the cached handler for key, constructing it via
// create on first use. Concurrent first calls may both run create; only one
// instance is stored and returned, which is safe because informer event
// handler registration is guarded separately by informerInitOnce.
func GetOrCreateHandler[T any](key string, create func() T) T {
	if v, ok := handlerRegistry.Load(key); ok {
		return v.(T)
	}
	v, _ := handlerRegistry.LoadOrStore(key, create())
	return v.(T)
}

// ClusterInit runs init exactly once for key.
func ClusterInit(key string, init func()) {
	once, _ := clusterInitOnce.LoadOrStore(key, &sync.Once{})
	once.(*sync.Once).Do(init)
}

// Reset drops every cached handler and every init guard.
func Reset() {
	clearSyncMap(&handlerRegistry)
	clearSyncMap(&informerInitOnce)
	clearSyncMap(&clusterInitOnce)
}

func clearSyncMap(m *sync.Map) {
	m.Range(func(key, _ any) bool {
		m.Delete(key)
		return true
	})
}
