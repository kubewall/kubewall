package tracing

import (
	"context"
	"fmt"
	"log"

	"github.com/Facets-cloud/kube-dash/internal/config"
	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/exporters/jaeger"
	"go.opentelemetry.io/otel/propagation"
	"go.opentelemetry.io/otel/sdk/resource"
	"go.opentelemetry.io/otel/sdk/trace"
	oteltrace "go.opentelemetry.io/otel/trace"
	semconv "go.opentelemetry.io/otel/semconv/v1.24.0"
)

// TracerProvider holds the global tracer provider
var TracerProvider *trace.TracerProvider

// InitTracing initializes OpenTelemetry tracing
func InitTracing(cfg *config.TracingConfig) error {
	if !cfg.Enabled {
		log.Println("Tracing is disabled")
		return nil
	}

	// Create resource
	res, err := resource.New(context.Background(),
		resource.WithAttributes(
			semconv.ServiceName(cfg.ServiceName),
			semconv.ServiceVersion(cfg.ServiceVersion),
		),
	)
	if err != nil {
		return fmt.Errorf("failed to create resource: %w", err)
	}

	// Create Jaeger exporter if export is enabled
	var exporter trace.SpanExporter
	if cfg.ExportEnabled {
		exporter, err = jaeger.New(jaeger.WithCollectorEndpoint(jaeger.WithEndpoint(cfg.JaegerEndpoint)))
		if err != nil {
			return fmt.Errorf("failed to create Jaeger exporter: %w", err)
		}
	}

	// Create tracer provider
	var opts []trace.TracerProviderOption
	opts = append(opts, trace.WithResource(res))
	opts = append(opts, trace.WithSampler(trace.TraceIDRatioBased(cfg.SamplingRate)))

	if exporter != nil {
		opts = append(opts, trace.WithBatcher(exporter))
	}

	TracerProvider = trace.NewTracerProvider(opts...)

	// Set global tracer provider
	otel.SetTracerProvider(TracerProvider)

	// Set global propagator
	otel.SetTextMapPropagator(propagation.TraceContext{})

	log.Printf("Tracing initialized for service %s with sampling rate %.2f", cfg.ServiceName, cfg.SamplingRate)
	return nil
}

// Shutdown gracefully shuts down the tracer provider
func Shutdown(ctx context.Context) error {
	if TracerProvider != nil {
		return TracerProvider.Shutdown(ctx)
	}
	return nil
}

// GetTracer returns a tracer for the given name
func GetTracer(name string) oteltrace.Tracer {
	return otel.Tracer(name)
}