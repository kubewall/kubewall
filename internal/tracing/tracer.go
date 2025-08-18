package tracing

import (
	"context"
	"fmt"
	"time"

	"github.com/Facets-cloud/kube-dash/internal/config"
	"github.com/Facets-cloud/kube-dash/pkg/logger"

	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/codes"
	"go.opentelemetry.io/otel/exporters/jaeger"
	"go.opentelemetry.io/otel/propagation"
	"go.opentelemetry.io/otel/sdk/resource"
	"go.opentelemetry.io/otel/sdk/trace"
	"go.opentelemetry.io/otel/semconv/v1.26.0"
	oteltrace "go.opentelemetry.io/otel/trace"
)

// TracingService manages OpenTelemetry tracing
type TracingService struct {
	config    *config.TracingConfig
	logger    *logger.Logger
	store     *TraceStore
	tracer    oteltrace.Tracer
	provider  *trace.TracerProvider
	shutdown  func(context.Context) error
}

// NewTracingService creates a new tracing service
func NewTracingService(cfg *config.TracingConfig, log *logger.Logger) (*TracingService, error) {
	if !cfg.Enabled {
		return &TracingService{
			config: cfg,
			logger: log,
			store:  NewTraceStore(cfg),
		}, nil
	}

	// Create resource
	res, err := resource.Merge(
		resource.Default(),
		resource.NewWithAttributes(
			semconv.SchemaURL,
			semconv.ServiceName(cfg.ServiceName),
			semconv.ServiceVersion(cfg.ServiceVersion),
		),
	)
	if err != nil {
		return nil, fmt.Errorf("failed to create resource: %w", err)
	}

	// Create store
	store := NewTraceStore(cfg)

	// Create custom span processor for capturing traces
	customProcessor := NewCustomSpanProcessor(store)

	// Create exporter
	var exporter trace.SpanExporter
	if cfg.ExportEnabled {
		exporter, err = jaeger.New(jaeger.WithCollectorEndpoint(jaeger.WithEndpoint(cfg.JaegerEndpoint)))
		if err != nil {
			log.WithError(err).Warn("Failed to create Jaeger exporter, traces will only be stored in memory")
			exporter = nil
		}
	}

	// Create tracer provider
	var opts []trace.TracerProviderOption
	opts = append(opts, trace.WithResource(res))
	opts = append(opts, trace.WithSampler(trace.TraceIDRatioBased(cfg.SamplingRate)))
	
	// Register our custom span processor
	opts = append(opts, trace.WithSpanProcessor(customProcessor))

	if exporter != nil {
		opts = append(opts, trace.WithBatcher(exporter))
	}

	provider := trace.NewTracerProvider(opts...)

	// Set global tracer provider
	otel.SetTracerProvider(provider)
	otel.SetTextMapPropagator(propagation.NewCompositeTextMapPropagator(
		propagation.TraceContext{},
		propagation.Baggage{},
	))

	// Create tracer
	tracer := provider.Tracer(cfg.ServiceName)

	service := &TracingService{
		config:   cfg,
		logger:   log,
		store:    store,
		tracer:   tracer,
		provider: provider,
		shutdown: provider.Shutdown,
	}

	// Start background trace collection
	go service.startTraceCollection()

	// Log successful initialization
	log.Infof("Tracing initialized for service %s with sampling rate %.2f", cfg.ServiceName, cfg.SamplingRate)

	return service, nil
}

// GetTracer returns the OpenTelemetry tracer
func (ts *TracingService) GetTracer() oteltrace.Tracer {
	return ts.tracer
}

// GetStore returns the trace store
func (ts *TracingService) GetStore() *TraceStore {
	return ts.store
}

// Shutdown gracefully shuts down the tracing service
func (ts *TracingService) Shutdown(ctx context.Context) error {
	if ts.shutdown != nil {
		return ts.shutdown(ctx)
	}
	return nil
}

// StartSpan starts a new span with the given name and options
func (ts *TracingService) StartSpan(ctx context.Context, name string, opts ...oteltrace.SpanStartOption) (context.Context, oteltrace.Span) {
	if ts.tracer == nil {
		return ctx, oteltrace.SpanFromContext(ctx)
	}
	return ts.tracer.Start(ctx, name, opts...)
}

// RecordError records an error on the span
func (ts *TracingService) RecordError(span oteltrace.Span, err error) {
	if span != nil && err != nil {
		span.RecordError(err)
		span.SetStatus(codes.Error, err.Error())
	}
}

// SetSpanAttributes sets attributes on the span
func (ts *TracingService) SetSpanAttributes(span oteltrace.Span, attrs ...attribute.KeyValue) {
	if span != nil {
		span.SetAttributes(attrs...)
	}
}

// startTraceCollection starts collecting traces from the OpenTelemetry provider
// This is a simplified implementation - in a real system, you'd use a proper span processor
func (ts *TracingService) startTraceCollection() {
	// This is a placeholder for trace collection
	// In a real implementation, you would implement a custom span processor
	// that captures completed spans and stores them in the trace store
	ticker := time.NewTicker(30 * time.Second)
	defer ticker.Stop()

	for range ticker.C {
		// Cleanup old traces periodically
		ts.store.mutex.Lock()
		ts.store.cleanupOldTraces()
		ts.store.mutex.Unlock()
	}
}

// CreateTraceFromSpan creates a trace object from span data
// This would typically be called by a custom span processor
func (ts *TracingService) CreateTraceFromSpan(spanData SpanData) {
	if !ts.config.Enabled {
		return
	}

	// Convert span data to our internal format
	span := Span{
		SpanID:        spanData.SpanID,
		TraceID:       spanData.TraceID,
		ParentSpanID:  spanData.ParentSpanID,
		OperationName: spanData.Name,
		ServiceName:   spanData.ServiceName,
		StartTime:     spanData.StartTime,
		Duration:      spanData.EndTime.Sub(spanData.StartTime),
		Status:        spanData.Status,
		Tags:          spanData.Attributes,
		Logs:          spanData.Events,
	}

	// Check if trace already exists
	trace, err := ts.store.GetTrace(spanData.TraceID)
	if err != nil {
		// Create new trace
		services := []string{spanData.ServiceName}
		trace = &Trace{
			TraceID:       spanData.TraceID,
			OperationName: spanData.Name,
			StartTime:     spanData.StartTime,
			Duration:      spanData.EndTime.Sub(spanData.StartTime),
			Status:        spanData.Status,
			Services:      services,
			SpanCount:     1,
			Spans:         []Span{span},
			Tags:          spanData.Attributes,
		}
	} else {
		// Update existing trace
		trace.Spans = append(trace.Spans, span)
		trace.SpanCount = len(trace.Spans)

		// Update services list
		found := false
		for _, service := range trace.Services {
			if service == spanData.ServiceName {
				found = true
				break
			}
		}
		if !found {
			trace.Services = append(trace.Services, spanData.ServiceName)
		}

		// Update trace duration and status
		if spanData.StartTime.Before(trace.StartTime) {
			trace.StartTime = spanData.StartTime
		}
		if spanData.Status == "error" {
			trace.Status = "error"
		}
	}

	// Store the updated trace
	ts.store.StoreTrace(trace)
}

// SpanData represents span data for trace creation
type SpanData struct {
	SpanID       string
	TraceID      string
	ParentSpanID string
	Name         string
	ServiceName  string
	StartTime    time.Time
	EndTime      time.Time
	Status       string
	Attributes   map[string]string
	Events       []SpanLog
}