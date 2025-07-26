package main

import (
	"context"
	"os"
	"os/signal"
	"syscall"
	"time"

	"kubewall-backend/internal/config"
	"kubewall-backend/internal/server"
	"kubewall-backend/pkg/logger"
)

func main() {
	// Load configuration
	cfg := config.Load()

	// Create logger
	log := logger.New(cfg.Logging.Level)
	log.Info("Starting KubeWall Backend")

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

	// Attempt graceful shutdown
	if err := srv.Stop(ctx); err != nil {
		log.WithError(err).Fatal("Server forced to shutdown")
	}

	log.Info("Server exited")
}
