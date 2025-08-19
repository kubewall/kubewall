package tracing

import (
	"context"

	"github.com/Facets-cloud/kube-dash/internal/config"
	"github.com/Facets-cloud/kube-dash/internal/types"
)

// TraceStoreInterface defines the common interface for trace storage implementations
type TraceStoreInterface interface {
	// StoreTrace stores a trace
	StoreTrace(trace *types.Trace) error
	// GetTrace retrieves a trace by ID
	GetTrace(traceID string) (*types.Trace, error)
	// QueryTraces retrieves traces based on filters
	QueryTraces(filter types.TraceFilter) ([]*types.Trace, int, error)
	// GetServiceMap returns the current service map
	GetServiceMap(timeRange string) (map[string]*ServiceMapNode, []*ServiceMapEdge, error)
	// GetTraces is an alias for QueryTraces for backward compatibility
	GetTraces(filter types.TraceFilter) ([]*types.Trace, int, error)
	// GetConfig returns the current tracing configuration
	GetConfig() *config.TracingConfig
	// UpdateConfig updates the tracing configuration
	UpdateConfig(newConfig *config.TracingConfig) error
	// ExportTraces exports traces in JSON format
	ExportTraces(ctx context.Context) ([]byte, error)
}

// Ensure both implementations satisfy the interface
var _ TraceStoreInterface = (*TraceStore)(nil)
var _ TraceStoreInterface = (*DatabaseTraceStore)(nil)