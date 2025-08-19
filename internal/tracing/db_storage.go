package tracing

import (
	"context"
	"encoding/json"
	"fmt"
	"sync"
	"time"

	"github.com/Facets-cloud/kube-dash/internal/config"
	"github.com/Facets-cloud/kube-dash/internal/storage"
	"github.com/Facets-cloud/kube-dash/internal/types"
)

// DatabaseTraceStore manages trace storage using a database backend
type DatabaseTraceStore struct {
	db        storage.DatabaseStorage
	services  map[string]*ServiceMapNode
	config    *config.TracingConfig
	mutex     sync.RWMutex
	retention time.Duration
}

// NewDatabaseTraceStore creates a new database-backed trace store
func NewDatabaseTraceStore(db storage.DatabaseStorage, config *config.TracingConfig) *DatabaseTraceStore {
	return &DatabaseTraceStore{
		db:        db,
		services:  make(map[string]*ServiceMapNode),
		config:    config,
		retention: time.Duration(config.RetentionHours) * time.Hour,
	}
}

// StoreTrace stores a trace in the database
func (dts *DatabaseTraceStore) StoreTrace(trace *types.Trace) error {
	dts.mutex.Lock()
	defer dts.mutex.Unlock()

	// Store trace in database
	if err := dts.db.StoreTrace(trace); err != nil {
		return fmt.Errorf("failed to store trace in database: %w", err)
	}

	// Update in-memory service map for performance
	dts.updateServiceMap(trace)

	// Clean up expired traces periodically
	go dts.cleanupExpiredTraces()

	return nil
}

// GetTrace retrieves a trace by ID from the database
func (dts *DatabaseTraceStore) GetTrace(traceID string) (*types.Trace, error) {
	return dts.db.GetTrace(traceID)
}

// QueryTraces retrieves traces based on filters from the database
func (dts *DatabaseTraceStore) QueryTraces(filter types.TraceFilter) ([]*types.Trace, int, error) {
	// Set default limit if not specified
	if filter.Limit <= 0 {
		filter.Limit = 100
	}

	return dts.db.QueryTraces(filter)
}

// GetServiceMap returns the current service map
func (dts *DatabaseTraceStore) GetServiceMap(timeRange string) (map[string]*ServiceMapNode, []*ServiceMapEdge, error) {
	dts.mutex.RLock()
	defer dts.mutex.RUnlock()

	// Calculate edges from database traces
	edges, err := dts.calculateServiceEdgesFromDB(timeRange)
	if err != nil {
		return nil, nil, fmt.Errorf("failed to calculate service edges: %w", err)
	}

	return dts.services, edges, nil
}

// GetTraces is an alias for QueryTraces for backward compatibility
func (dts *DatabaseTraceStore) GetTraces(filter types.TraceFilter) ([]*types.Trace, int, error) {
	return dts.QueryTraces(filter)
}

// GetConfig returns the current tracing configuration
func (dts *DatabaseTraceStore) GetConfig() *config.TracingConfig {
	dts.mutex.RLock()
	defer dts.mutex.RUnlock()
	return dts.config
}

// UpdateConfig updates the tracing configuration
func (dts *DatabaseTraceStore) UpdateConfig(newConfig *config.TracingConfig) error {
	dts.mutex.Lock()
	defer dts.mutex.Unlock()
	dts.config = newConfig
	dts.retention = time.Duration(newConfig.RetentionHours) * time.Hour
	return nil
}

// ExportTraces exports traces in JSON format from the database
func (dts *DatabaseTraceStore) ExportTraces(ctx context.Context) ([]byte, error) {
	// Query all traces without filters
	filter := TraceFilter{
		Limit:  10000, // Large limit to get all traces
		Offset: 0,
	}

	traces, _, err := dts.db.QueryTraces(filter)
	if err != nil {
		return nil, fmt.Errorf("failed to query traces for export: %w", err)
	}

	return json.Marshal(traces)
}

// updateServiceMap updates service statistics in memory
func (dts *DatabaseTraceStore) updateServiceMap(trace *types.Trace) {
	for _, service := range trace.Services {
		node, exists := dts.services[service]
		if !exists {
			node = &ServiceMapNode{
				Name:         service,
				RequestCount: 0,
				ErrorCount:   0,
				AvgLatency:   0,
				P95Latency:   0,
				Health:       "healthy",
			}
			dts.services[service] = node
		}

		node.RequestCount++
		if trace.Status == "error" {
			node.ErrorCount++
		}

		// Update latency (simplified calculation)
		latencyMs := float64(trace.Duration.Nanoseconds()) / 1e6
		node.AvgLatency = (node.AvgLatency*float64(node.RequestCount-1) + latencyMs) / float64(node.RequestCount)

		// Update health status
		errorRate := float64(node.ErrorCount) / float64(node.RequestCount)
		if errorRate > 0.1 {
			node.Health = "unhealthy"
		} else if errorRate > 0.05 {
			node.Health = "warning"
		} else {
			node.Health = "healthy"
		}
	}
}

// calculateServiceEdgesFromDB calculates connections between services from database traces
func (dts *DatabaseTraceStore) calculateServiceEdgesFromDB(timeRange string) ([]*ServiceMapEdge, error) {
	// Parse time range
	var startTime time.Time
	switch timeRange {
	case "1h":
		startTime = time.Now().Add(-1 * time.Hour)
	case "6h":
		startTime = time.Now().Add(-6 * time.Hour)
	case "24h":
		startTime = time.Now().Add(-24 * time.Hour)
	default:
		startTime = time.Now().Add(-1 * time.Hour)
	}

	// Query traces within the time range
	filter := types.TraceFilter{
		StartTime: &startTime,
		Limit:     1000, // Reasonable limit for service map calculation
		Offset:    0,
	}

	traces, _, err := dts.db.QueryTraces(filter)
	if err != nil {
		return nil, fmt.Errorf("failed to query traces for service map: %w", err)
	}

	edgeMap := make(map[string]*ServiceMapEdge)

	for _, trace := range traces {
		// Build service call graph from spans
		for _, span := range trace.Spans {
			if span.ParentSpanID != "" {
				// Find parent span
				for _, parentSpan := range trace.Spans {
					if parentSpan.SpanID == span.ParentSpanID && parentSpan.ServiceName != span.ServiceName {
						edgeKey := fmt.Sprintf("%s->%s", parentSpan.ServiceName, span.ServiceName)
						edge, exists := edgeMap[edgeKey]
						if !exists {
							edge = &ServiceMapEdge{
								Source:       parentSpan.ServiceName,
								Target:       span.ServiceName,
								RequestCount: 0,
								ErrorCount:   0,
								AvgLatency:   0,
							}
							edgeMap[edgeKey] = edge
						}

						edge.RequestCount++
						if span.Status == "error" {
							edge.ErrorCount++
						}

						latencyMs := float64(span.Duration.Nanoseconds()) / 1e6
						edge.AvgLatency = (edge.AvgLatency*float64(edge.RequestCount-1) + latencyMs) / float64(edge.RequestCount)
						break
					}
				}
			}
		}
	}

	// Convert map to slice
	var edges []*ServiceMapEdge
	for _, edge := range edgeMap {
		edges = append(edges, edge)
	}

	return edges, nil
}

// cleanupExpiredTraces removes old traces from the database
func (dts *DatabaseTraceStore) cleanupExpiredTraces() {
	cutoff := time.Now().Add(-dts.retention)
	if err := dts.db.DeleteExpiredTraces(cutoff); err != nil {
		// Log error but don't fail the operation
		// In a real implementation, you would use a proper logger
		fmt.Printf("Warning: failed to cleanup expired traces: %v\n", err)
	}
}