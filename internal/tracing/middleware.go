package tracing

import (
	"fmt"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"
	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/codes"
	"go.opentelemetry.io/otel/propagation"
	"go.opentelemetry.io/otel/trace"
)

// TracingMiddleware returns a Gin middleware that adds OpenTelemetry tracing
func TracingMiddleware(serviceName string) gin.HandlerFunc {
	return gin.HandlerFunc(func(c *gin.Context) {
		if !shouldTrace(c) {
			c.Next()
			return
		}

		// Extract trace context from headers
		ctx := otel.GetTextMapPropagator().Extract(c.Request.Context(), propagation.HeaderCarrier(c.Request.Header))

		// Start span with HTTP method and path
		tracer := otel.Tracer(serviceName)
		// Ensure we always use the actual path, not the route template
		spanName := fmt.Sprintf("%s %s", c.Request.Method, c.Request.URL.Path)
		ctx, span := tracer.Start(ctx, spanName,
			trace.WithAttributes(
				attribute.String("http.method", c.Request.Method),
				attribute.String("http.route", c.FullPath()),
				attribute.String("http.scheme", c.Request.URL.Scheme),
				attribute.String("http.host", c.Request.Host),
				attribute.String("http.target", c.Request.URL.Path),
				attribute.String("http.user_agent", c.Request.UserAgent()),
				attribute.Int64("http.request_content_length", c.Request.ContentLength),
				attribute.String("http.remote_addr", c.ClientIP()),
			),
			trace.WithSpanKind(trace.SpanKindServer),
		)
		defer span.End()

		// Add trace context to Gin context
		c.Request = c.Request.WithContext(ctx)
		c.Set("trace_id", span.SpanContext().TraceID().String())
		c.Set("span_id", span.SpanContext().SpanID().String())

		// Record start time
		start := time.Now()

		// Process request
		c.Next()

		// Record response attributes
		span.SetAttributes(
			attribute.Int("http.status_code", c.Writer.Status()),
			attribute.Int("http.response_content_length", c.Writer.Size()),
			attribute.String("http.duration", time.Since(start).String()),
		)

		// Set span status based on HTTP status code
		if c.Writer.Status() >= 400 {
			span.SetStatus(codes.Error, "HTTP "+strconv.Itoa(c.Writer.Status()))
		} else {
			span.SetStatus(codes.Ok, "")
		}

		// Record any errors
		if len(c.Errors) > 0 {
			for _, err := range c.Errors {
				span.RecordError(err.Err)
			}
			span.SetStatus(codes.Error, c.Errors.String())
		}

		// Inject trace context into response headers for downstream services
		otel.GetTextMapPropagator().Inject(ctx, propagation.HeaderCarrier(c.Writer.Header()))
	})
}

// shouldTrace determines if a request should be traced
func shouldTrace(c *gin.Context) bool {
	// Skip tracing for health checks and static assets
	path := c.Request.URL.Path
	if path == "/health" || path == "/metrics" || path == "/favicon.ico" {
		return false
	}

	// Skip static file requests
	if len(path) > 4 {
		ext := path[len(path)-4:]
		if ext == ".css" || ext == ".js" || ext == ".png" || ext == ".jpg" || ext == ".gif" || ext == ".ico" {
			return false
		}
	}

	return true
}

// GetTraceID extracts the trace ID from the Gin context
func GetTraceID(c *gin.Context) string {
	if traceID, exists := c.Get("trace_id"); exists {
		if id, ok := traceID.(string); ok {
			return id
		}
	}
	return ""
}

// GetSpanID extracts the span ID from the Gin context
func GetSpanID(c *gin.Context) string {
	if spanID, exists := c.Get("span_id"); exists {
		if id, ok := spanID.(string); ok {
			return id
		}
	}
	return ""
}

// AddSpanAttributes adds attributes to the current span
func AddSpanAttributes(c *gin.Context, attrs ...attribute.KeyValue) {
	span := trace.SpanFromContext(c.Request.Context())
	if span != nil {
		span.SetAttributes(attrs...)
	}
}

// RecordSpanError records an error on the current span
func RecordSpanError(c *gin.Context, err error) {
	span := trace.SpanFromContext(c.Request.Context())
	if span != nil && err != nil {
		span.RecordError(err)
		span.SetStatus(codes.Error, err.Error())
	}
}

// StartChildSpan starts a child span with the given name
func StartChildSpan(c *gin.Context, name string, opts ...trace.SpanStartOption) (gin.Context, trace.Span) {
	tracer := otel.Tracer("kube-dash")
	ctx, span := tracer.Start(c.Request.Context(), name, opts...)

	// Create new context with the child span
	newContext := *c
	newContext.Request = c.Request.WithContext(ctx)

	return newContext, span
}