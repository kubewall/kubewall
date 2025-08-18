package tracing

import (
	"context"
	"encoding/json"
	"fmt"
	"sort"
	"strings"
	"sync"
	"time"

	"github.com/Facets-cloud/kube-dash/internal/config"
	"go.opentelemetry.io/otel/trace"
)

// Trace represents a complete distributed trace
type Trace struct {
	TraceID       string            `json:"traceId"`
	OperationName string            `json:"operationName"`
	StartTime     time.Time         `json:"startTime"`
	Duration      time.Duration     `json:"duration"`
	Status        string            `json:"status"`
	Services      []string          `json:"services"`
	SpanCount     int               `json:"spanCount"`
	Spans         []Span            `json:"spans"`
	Tags          map[string]string `json:"tags"`
}

// Span represents an individual operation within a trace
type Span struct {
	SpanID        string            `json:"spanId"`
	TraceID       string            `json:"traceId"`
	ParentSpanID  string            `json:"parentSpanId,omitempty"`
	OperationName string            `json:"operationName"`
	ServiceName   string            `json:"serviceName"`
	StartTime     time.Time         `json:"startTime"`
	Duration      time.Duration     `json:"duration"`
	Status        string            `json:"status"`
	Tags          map[string]string `json:"tags"`
	Logs          []SpanLog         `json:"logs"`
}

// SpanLog represents a log entry within a span
type SpanLog struct {
	Timestamp time.Time              `json:"timestamp"`
	Level     string                 `json:"level"`
	Message   string                 `json:"message"`
	Fields    map[string]interface{} `json:"fields"`
}

// ServiceMapNode represents a service in the service map
type ServiceMapNode struct {
	Name         string  `json:"name"`
	RequestCount int64   `json:"requestCount"`
	ErrorCount   int64   `json:"errorCount"`
	AvgLatency   float64 `json:"avgLatency"`
	P95Latency   float64 `json:"p95Latency"`
	Health       string  `json:"health"`
}

// ServiceMapEdge represents a connection between services
type ServiceMapEdge struct {
	Source       string  `json:"source"`
	Target       string  `json:"target"`
	RequestCount int64   `json:"requestCount"`
	ErrorCount   int64   `json:"errorCount"`
	AvgLatency   float64 `json:"avgLatency"`
}

// TraceFilter represents filters for trace queries
type TraceFilter struct {
	Service     string
	Operation   string
	StartTime   *time.Time
	EndTime     *time.Time
	MinDuration *time.Duration
	MaxDuration *time.Duration
	Status      string
	Limit       int
	Offset      int
}

// TraceStore manages in-memory trace storage
type TraceStore struct {
	traces    map[string]*Trace
	services  map[string]*ServiceMapNode
	config    *config.TracingConfig
	mutex     sync.RWMutex
	retention time.Duration
}

// NewTraceStore creates a new trace store
func NewTraceStore(config *config.TracingConfig) *TraceStore {
	return &TraceStore{
		traces:    make(map[string]*Trace),
		services:  make(map[string]*ServiceMapNode),
		config:    config,
		retention: time.Duration(config.RetentionHours) * time.Hour,
	}
}

// StoreTrace stores a trace in memory
func (ts *TraceStore) StoreTrace(trace *Trace) error {
	ts.mutex.Lock()
	defer ts.mutex.Unlock()

	// Check if we've exceeded max traces
	if len(ts.traces) >= ts.config.MaxTraces {
		ts.cleanupOldTraces()
	}

	ts.traces[trace.TraceID] = trace
	ts.updateServiceMap(trace)

	return nil
}

// GetTrace retrieves a trace by ID
func (ts *TraceStore) GetTrace(traceID string) (*Trace, error) {
	ts.mutex.RLock()
	defer ts.mutex.RUnlock()

	trace, exists := ts.traces[traceID]
	if !exists {
		return nil, fmt.Errorf("trace not found: %s", traceID)
	}

	return trace, nil
}

// QueryTraces retrieves traces based on filters
func (ts *TraceStore) QueryTraces(filter TraceFilter) ([]*Trace, int, error) {
	ts.mutex.RLock()
	defer ts.mutex.RUnlock()

	var filtered []*Trace

	for _, trace := range ts.traces {
		if ts.matchesFilter(trace, filter) {
			filtered = append(filtered, trace)
		}
	}

	// Sort by start time (newest first)
	sort.Slice(filtered, func(i, j int) bool {
		return filtered[i].StartTime.After(filtered[j].StartTime)
	})

	total := len(filtered)

	// Apply pagination
	start := filter.Offset
	if start > len(filtered) {
		start = len(filtered)
	}

	end := start + filter.Limit
	if end > len(filtered) {
		end = len(filtered)
	}

	if start < end {
		filtered = filtered[start:end]
	} else {
		filtered = []*Trace{}
	}

	return filtered, total, nil
}

// GetServiceMap returns the current service map
func (ts *TraceStore) GetServiceMap(timeRange string) (map[string]*ServiceMapNode, []*ServiceMapEdge, error) {
	ts.mutex.RLock()
	defer ts.mutex.RUnlock()

	// For now, return all services and calculate edges
	edges := ts.calculateServiceEdges(timeRange)

	return ts.services, edges, nil
}

// matchesFilter checks if a trace matches the given filter
func (ts *TraceStore) matchesFilter(trace *Trace, filter TraceFilter) bool {
	if filter.Service != "" {
		found := false
		for _, service := range trace.Services {
			if strings.Contains(strings.ToLower(service), strings.ToLower(filter.Service)) {
				found = true
				break
			}
		}
		if !found {
			return false
		}
	}

	if filter.Operation != "" && !strings.Contains(strings.ToLower(trace.OperationName), strings.ToLower(filter.Operation)) {
		return false
	}

	if filter.Status != "" && trace.Status != filter.Status {
		return false
	}

	if filter.StartTime != nil && trace.StartTime.Before(*filter.StartTime) {
		return false
	}

	if filter.EndTime != nil && trace.StartTime.After(*filter.EndTime) {
		return false
	}

	if filter.MinDuration != nil && trace.Duration < *filter.MinDuration {
		return false
	}

	if filter.MaxDuration != nil && trace.Duration > *filter.MaxDuration {
		return false
	}

	return true
}

// updateServiceMap updates service statistics
func (ts *TraceStore) updateServiceMap(trace *Trace) {
	for _, service := range trace.Services {
		node, exists := ts.services[service]
		if !exists {
			node = &ServiceMapNode{
				Name:         service,
				RequestCount: 0,
				ErrorCount:   0,
				AvgLatency:   0,
				P95Latency:   0,
				Health:       "healthy",
			}
			ts.services[service] = node
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

// calculateServiceEdges calculates connections between services
func (ts *TraceStore) calculateServiceEdges(timeRange string) []*ServiceMapEdge {
	edgeMap := make(map[string]*ServiceMapEdge)

	// Parse time range
	var cutoff time.Time
	switch timeRange {
	case "1h":
		cutoff = time.Now().Add(-1 * time.Hour)
	case "6h":
		cutoff = time.Now().Add(-6 * time.Hour)
	case "24h":
		cutoff = time.Now().Add(-24 * time.Hour)
	default:
		cutoff = time.Now().Add(-1 * time.Hour)
	}

	for _, trace := range ts.traces {
		if trace.StartTime.Before(cutoff) {
			continue
		}

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

	return edges
}

// cleanupOldTraces removes old traces to maintain memory limits
func (ts *TraceStore) cleanupOldTraces() {
	cutoff := time.Now().Add(-ts.retention)
	var toDelete []string

	for traceID, trace := range ts.traces {
		if trace.StartTime.Before(cutoff) {
			toDelete = append(toDelete, traceID)
		}
	}

	// Remove oldest traces if we still have too many
	if len(toDelete) == 0 && len(ts.traces) >= ts.config.MaxTraces {
		type traceWithTime struct {
			id   string
			time time.Time
		}

		var traces []traceWithTime
		for id, trace := range ts.traces {
			traces = append(traces, traceWithTime{id: id, time: trace.StartTime})
		}

		sort.Slice(traces, func(i, j int) bool {
			return traces[i].time.Before(traces[j].time)
		})

		// Remove oldest 20% of traces
		removeCount := len(traces) / 5
		for i := 0; i < removeCount; i++ {
			toDelete = append(toDelete, traces[i].id)
		}
	}

	for _, traceID := range toDelete {
		delete(ts.traces, traceID)
	}
}

// ConvertOTelSpan converts an OpenTelemetry span to our internal format
func ConvertOTelSpan(span trace.Span) *Span {
	// This is a simplified conversion - in a real implementation,
	// you would extract more detailed information from the OTel span
	return &Span{
		SpanID:        span.SpanContext().SpanID().String(),
		TraceID:       span.SpanContext().TraceID().String(),
		OperationName: "unknown", // Would need to be extracted from span
		ServiceName:   "kube-dash",
		StartTime:     time.Now(),
		Duration:      0,
		Status:        "success",
		Tags:          make(map[string]string),
		Logs:          []SpanLog{},
	}
}

// GetTraces is an alias for QueryTraces for backward compatibility
func (ts *TraceStore) GetTraces(filter TraceFilter) ([]*Trace, int, error) {
	return ts.QueryTraces(filter)
}

// GetConfig returns the current tracing configuration
func (ts *TraceStore) GetConfig() *config.TracingConfig {
	ts.mutex.RLock()
	defer ts.mutex.RUnlock()
	return ts.config
}

// UpdateConfig updates the tracing configuration
func (ts *TraceStore) UpdateConfig(newConfig *config.TracingConfig) error {
	ts.mutex.Lock()
	defer ts.mutex.Unlock()
	ts.config = newConfig
	ts.retention = time.Duration(newConfig.RetentionHours) * time.Hour
	return nil
}

// ExportTraces exports traces in JSON format
func (ts *TraceStore) ExportTraces(ctx context.Context) ([]byte, error) {
	ts.mutex.RLock()
	defer ts.mutex.RUnlock()

	var traces []*Trace
	for _, trace := range ts.traces {
		traces = append(traces, trace)
	}

	return json.Marshal(traces)
}