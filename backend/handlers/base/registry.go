package base

import "sync"

// handlerRegistry caches handler instances per (config, cluster) so each HTTP
// request reuses the wrapper around the shared informer instead of rebuilding
// it (and re-running WaitForSync) on every call.
var handlerRegistry sync.Map

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
