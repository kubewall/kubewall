// Package main KubeDash API Server
//
// Modern Kubernetes Dashboard API with real-time monitoring and management capabilities.
// Provides comprehensive access to Kubernetes resources including workloads, networking,
// storage, and configuration management.
//
// Terms Of Service: https://github.com/Facets-cloud/kube-dash
// Schemes: http, https
// Host: localhost:7080
// BasePath: /api/v1
// Version: 1.0.0
// License: MIT https://github.com/Facets-cloud/kube-dash/blob/main/LICENSE
// Contact: KubeDash API Support <support@facets.cloud> https://github.com/Facets-cloud/kube-dash
//
// Consumes:
// - application/json
// - text/event-stream
//
// Produces:
// - application/json
// - text/event-stream
// - application/yaml
//
// SecurityDefinitions:
// BearerAuth:
//   type: apiKey
//   name: Authorization
//   in: header
//   description: Enter the token with the 'Bearer ' prefix, e.g. 'Bearer abcde12345'
// KubeConfig:
//   type: apiKey
//   name: X-Kube-Config
//   in: header
//   description: Kubernetes configuration identifier
//
// swagger:meta
package main

import (
	"context"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/Facets-cloud/kube-dash/internal/config"
	"github.com/Facets-cloud/kube-dash/internal/server"
	"github.com/Facets-cloud/kube-dash/pkg/logger"
	"github.com/Facets-cloud/kube-dash/pkg/tracing"
	_ "github.com/Facets-cloud/kube-dash/docs" // Import generated docs
)

// Version information - set by ldflags during build
var (
	Version   = "dev"
	Commit    = "unknown"
	BuildDate = "unknown"
)

func main() {
	// Load configuration
	cfg := config.Load()

	// Create logger
	log := logger.New(cfg.Logging.Level)
	log.Info("Starting kube-dash Backend")

	// Create and start server
	srv := server.New(cfg)

	// Start server in a goroutine
	go func() {
		if err := srv.Start(); err != nil {
			log.WithError(err).Fatal("Failed to start server")
		}
	}()

	// Wait for interrupt signal to gracefully shutdown the server
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	log.Info("Shutting down server...")

	// Create a deadline for server shutdown
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	// Shutdown tracing
	if err := tracing.Shutdown(ctx); err != nil {
		log.WithError(err).Error("Failed to shutdown tracing")
	}

	// Attempt graceful shutdown
	if err := srv.Stop(ctx); err != nil {
		log.WithError(err).Fatal("Server forced to shutdown")
	}

	log.Info("Server exited")
}
