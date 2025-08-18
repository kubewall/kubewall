package tracing

import (
	"context"
	"fmt"
	"time"

	"github.com/gin-gonic/gin"
	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/codes"
	oteltrace "go.opentelemetry.io/otel/trace"
)



// TracingHelper provides convenient methods for creating child spans in API handlers
type TracingHelper struct {
	tracer oteltrace.Tracer
}

// NewTracingHelper creates a new tracing helper
func NewTracingHelper() *TracingHelper {
	return &TracingHelper{
		tracer: otel.Tracer("kube-dash"),
	}
}

// StartKubernetesAPISpan starts a child span for Kubernetes API operations
func (th *TracingHelper) StartKubernetesAPISpan(ctx context.Context, operation, resource, namespace string) (context.Context, oteltrace.Span) {
	spanName := fmt.Sprintf("k8s.%s.%s", operation, resource)
	
	attrs := []attribute.KeyValue{
		attribute.String("k8s.operation", operation),
		attribute.String("k8s.resource", resource),
		attribute.String("component", "kubernetes-client"),
	}
	
	if namespace != "" {
		attrs = append(attrs, attribute.String("k8s.namespace", namespace))
	}
	
	return th.tracer.Start(ctx, spanName, oteltrace.WithAttributes(attrs...))
}

// StartDataProcessingSpan starts a child span for data processing operations
func (th *TracingHelper) StartDataProcessingSpan(ctx context.Context, operation string) (context.Context, oteltrace.Span) {
	spanName := fmt.Sprintf("data.%s", operation)
	
	attrs := []attribute.KeyValue{
		attribute.String("operation", operation),
		attribute.String("component", "data-processing"),
	}
	
	return th.tracer.Start(ctx, spanName, oteltrace.WithAttributes(attrs...))
}

// StartDataProcessingSpanWithHTTP starts a child span for data processing operations with HTTP context
func (th *TracingHelper) StartDataProcessingSpanWithHTTP(ginCtx *gin.Context, operation string) (context.Context, oteltrace.Span) {
	// Use HTTP method and path for the span name
	spanName := fmt.Sprintf("%s %s", ginCtx.Request.Method, ginCtx.FullPath())
	
	attrs := []attribute.KeyValue{
		attribute.String("operation", operation),
		attribute.String("component", "data-processing"),
		attribute.String("http.method", ginCtx.Request.Method),
		attribute.String("http.path", ginCtx.FullPath()),
	}
	
	return th.tracer.Start(ginCtx.Request.Context(), spanName, oteltrace.WithAttributes(attrs...))
}

// StartAuthSpan starts a child span for authentication/authorization operations
func (th *TracingHelper) StartAuthSpan(ctx context.Context, operation string) (context.Context, oteltrace.Span) {
	spanName := fmt.Sprintf("auth.%s", operation)
	
	attrs := []attribute.KeyValue{
		attribute.String("operation", operation),
		attribute.String("component", "authentication"),
	}
	
	return th.tracer.Start(ctx, spanName, oteltrace.WithAttributes(attrs...))
}

// StartAuthSpanWithHTTP starts a child span for authentication/authorization operations with HTTP context
func (th *TracingHelper) StartAuthSpanWithHTTP(ginCtx *gin.Context, operation string) (context.Context, oteltrace.Span) {
	// Use HTTP method and path for the span name
	spanName := fmt.Sprintf("%s %s", ginCtx.Request.Method, ginCtx.FullPath())
	
	attrs := []attribute.KeyValue{
		attribute.String("operation", operation),
		attribute.String("component", "authentication"),
		attribute.String("http.method", ginCtx.Request.Method),
		attribute.String("http.path", ginCtx.FullPath()),
	}
	
	return th.tracer.Start(ginCtx.Request.Context(), spanName, oteltrace.WithAttributes(attrs...))
}

// StartMetricsSpan starts a child span for metrics collection operations
func (th *TracingHelper) StartMetricsSpan(ctx context.Context, operation string) (context.Context, oteltrace.Span) {
	spanName := fmt.Sprintf("metrics.%s", operation)
	
	attrs := []attribute.KeyValue{
		attribute.String("operation", operation),
		attribute.String("component", "metrics-collection"),
	}
	
	return th.tracer.Start(ctx, spanName, oteltrace.WithAttributes(attrs...))
}

// RecordError records an error on the span and sets error status
func (th *TracingHelper) RecordError(span oteltrace.Span, err error, message string) {
	if span != nil && err != nil {
		span.RecordError(err)
		span.SetStatus(codes.Error, message)
		span.SetAttributes(attribute.String("error.message", err.Error()))
	}
}

// RecordSuccess records successful completion of an operation
func (th *TracingHelper) RecordSuccess(span oteltrace.Span, message string) {
	if span != nil {
		span.SetStatus(codes.Ok, message)
		span.SetAttributes(attribute.String("result", "success"))
	}
}

// AddResourceAttributes adds resource-specific attributes to a span
func (th *TracingHelper) AddResourceAttributes(span oteltrace.Span, resourceName, resourceType string, count int) {
	if span != nil {
		span.SetAttributes(
			attribute.String("resource.name", resourceName),
			attribute.String("resource.type", resourceType),
			attribute.Int("resource.count", count),
		)
	}
}

// AddTimingAttributes adds timing information to a span
func (th *TracingHelper) AddTimingAttributes(span oteltrace.Span, startTime time.Time) {
	if span != nil {
		duration := time.Since(startTime)
		span.SetAttributes(
			attribute.Int64("duration.ms", duration.Milliseconds()),
			attribute.String("timing.start", startTime.Format(time.RFC3339Nano)),
		)
	}
}

// InstrumentGinHandler wraps a gin handler with tracing
func (th *TracingHelper) InstrumentGinHandler(handlerName string, handler gin.HandlerFunc) gin.HandlerFunc {
	return func(c *gin.Context) {
		ctx, span := th.tracer.Start(c.Request.Context(), handlerName)
		defer span.End()
		
		// Update the request context
		c.Request = c.Request.WithContext(ctx)
		
		// Add handler attributes
		span.SetAttributes(
			attribute.String("handler.name", handlerName),
			attribute.String("http.method", c.Request.Method),
			attribute.String("http.path", c.Request.URL.Path),
		)
		
		// Call the original handler
		handler(c)
		
		// Record response status
		span.SetAttributes(attribute.Int("http.status_code", c.Writer.Status()))
		
		if c.Writer.Status() >= 400 {
			span.SetStatus(codes.Error, fmt.Sprintf("HTTP %d", c.Writer.Status()))
		} else {
			span.SetStatus(codes.Ok, "Request completed successfully")
		}
	}
}

// GetTracingHelper returns a global tracing helper instance
var globalTracingHelper *TracingHelper

func GetTracingHelper() *TracingHelper {
	if globalTracingHelper == nil {
		globalTracingHelper = NewTracingHelper()
	}
	return globalTracingHelper
}