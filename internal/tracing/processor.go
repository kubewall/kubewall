package tracing

import (
	"context"

	"go.opentelemetry.io/otel/codes"
	"go.opentelemetry.io/otel/sdk/trace"
)

// CustomSpanProcessor implements the OpenTelemetry SpanProcessor interface
// to capture completed spans and store them in our TraceStore
type CustomSpanProcessor struct {
	store *TraceStore
}

// NewCustomSpanProcessor creates a new custom span processor
func NewCustomSpanProcessor(store *TraceStore) *CustomSpanProcessor {
	return &CustomSpanProcessor{
		store: store,
	}
}

// OnStart is called when a span starts
func (p *CustomSpanProcessor) OnStart(parent context.Context, s trace.ReadWriteSpan) {
	// Nothing to do on start
}

// OnEnd is called when a span ends - this is where we capture the span
func (p *CustomSpanProcessor) OnEnd(s trace.ReadOnlySpan) {
	if p.store == nil {
		return
	}

	// Convert OpenTelemetry span to our internal format
	span := p.convertSpan(s)
	traceID := span.TraceID

	// Get or create trace
	p.store.mutex.Lock()
	defer p.store.mutex.Unlock()

	trace, exists := p.store.traces[traceID]
	if !exists {
		// Create new trace
		trace = &Trace{
			TraceID:       traceID,
			OperationName: span.OperationName,
			StartTime:     span.StartTime,
			Duration:      span.Duration,
			Status:        span.Status,
			Services:      []string{span.ServiceName},
			SpanCount:     1,
			Spans:         []Span{span},
			Tags:          span.Tags,
		}
		p.store.traces[traceID] = trace
	} else {
		// Update existing trace
		trace.Spans = append(trace.Spans, span)
		trace.SpanCount++
		
		// Update trace duration if this span extends it
		spanEndTime := span.StartTime.Add(span.Duration)
		traceEndTime := trace.StartTime.Add(trace.Duration)
		if spanEndTime.After(traceEndTime) {
			trace.Duration = spanEndTime.Sub(trace.StartTime)
		}
		
		// Update trace start time if this span starts earlier
		if span.StartTime.Before(trace.StartTime) {
			trace.StartTime = span.StartTime
			trace.Duration = traceEndTime.Sub(span.StartTime)
		}
		
		// Add service if not already present
		serviceExists := false
		for _, service := range trace.Services {
			if service == span.ServiceName {
				serviceExists = true
				break
			}
		}
		if !serviceExists {
			trace.Services = append(trace.Services, span.ServiceName)
		}
		
		// Update trace status if any span has error
		if span.Status == "error" {
			trace.Status = "error"
		}
		
		// Merge tags
		for key, value := range span.Tags {
			trace.Tags[key] = value
		}
	}

	// Update service map
	p.store.updateServiceMap(trace)
}

// Shutdown is called when the processor is being shut down
func (p *CustomSpanProcessor) Shutdown(ctx context.Context) error {
	return nil
}

// ForceFlush forces the processor to flush any buffered spans
func (p *CustomSpanProcessor) ForceFlush(ctx context.Context) error {
	return nil
}

// convertSpan converts an OpenTelemetry ReadOnlySpan to our internal Span format
func (p *CustomSpanProcessor) convertSpan(s trace.ReadOnlySpan) Span {
	spanContext := s.SpanContext()
	parent := s.Parent()
	
	// Convert attributes to tags
	tags := make(map[string]string)
	for _, attr := range s.Attributes() {
		tags[string(attr.Key)] = attr.Value.AsString()
	}
	
	// Convert events to logs
	var logs []SpanLog
	for _, event := range s.Events() {
		fields := make(map[string]interface{})
		for _, attr := range event.Attributes {
			fields[string(attr.Key)] = attr.Value.AsInterface()
		}
		
		logs = append(logs, SpanLog{
			Timestamp: event.Time,
			Level:     "info", // Default level
			Message:   event.Name,
			Fields:    fields,
		})
	}
	
	// Determine status
	status := "success"
	if s.Status().Code == codes.Error {
		status = "error"
	}
	
	// Get service name from resource attributes
	serviceName := "unknown"
	if resource := s.Resource(); resource != nil {
		for _, attr := range resource.Attributes() {
			if attr.Key == "service.name" {
				serviceName = attr.Value.AsString()
				break
			}
		}
	}
	
	return Span{
		SpanID:        spanContext.SpanID().String(),
		TraceID:       spanContext.TraceID().String(),
		ParentSpanID:  parent.SpanID().String(),
		OperationName: s.Name(),
		ServiceName:   serviceName,
		StartTime:     s.StartTime(),
		Duration:      s.EndTime().Sub(s.StartTime()),
		Status:        status,
		Tags:          tags,
		Logs:          logs,
	}
}