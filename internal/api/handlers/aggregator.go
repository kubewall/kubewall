package handlers

import (
	"github.com/Facets-cloud/kube-dash/internal/k8s"
	"github.com/Facets-cloud/kube-dash/internal/storage"
	"github.com/Facets-cloud/kube-dash/pkg/logger"
)

// HandlerAggregator aggregates all resource handlers into a single interface
type HandlerAggregator struct {
	*ResourcesHandler
	// Individual resource handlers will be added here as we create them
	// Workloads    *WorkloadsHandler
	// Networking   *NetworkingHandler
	// Storage      *StorageHandler
	// AccessControl *AccessControlHandler
	// Configurations *ConfigurationsHandler
	// Cluster      *ClusterHandler
	// WebSocket    *WebSocketHandler
}

// NewHandlerAggregator creates a new handler aggregator with all resource handlers
func NewHandlerAggregator(store *storage.KubeConfigStore, clientFactory *k8s.ClientFactory, log *logger.Logger) *HandlerAggregator {
	baseHandler := NewResourcesHandler(store, clientFactory, log)

	return &HandlerAggregator{
		ResourcesHandler: baseHandler,
		// Individual handlers will be initialized here as we create them
		// Workloads:    NewWorkloadsHandler(store, clientFactory, log),
		// Networking:   NewNetworkingHandler(store, clientFactory, log),
		// Storage:      NewStorageHandler(store, clientFactory, log),
		// AccessControl: NewAccessControlHandler(store, clientFactory, log),
		// Configurations: NewConfigurationsHandler(store, clientFactory, log),
		// Cluster:      NewClusterHandler(store, clientFactory, log),
		// WebSocket:    NewWebSocketHandler(store, clientFactory, log),
	}
}

// GetResourcesHandler returns the base resources handler
func (h *HandlerAggregator) GetResourcesHandler() *ResourcesHandler {
	return h.ResourcesHandler
}
