package server

import (
	"context"
	"fmt"
	"net/http"
	"time"

	"kubewall-backend/internal/api"
	"kubewall-backend/internal/config"
	"kubewall-backend/internal/k8s"
	"kubewall-backend/internal/storage"
	"kubewall-backend/pkg/logger"
	"kubewall-backend/pkg/middleware"

	"github.com/gin-gonic/gin"
)

// Server represents the HTTP server
type Server struct {
	config           *config.Config
	logger           *logger.Logger
	router           *gin.Engine
	server           *http.Server
	store            *storage.KubeConfigStore
	clientFactory    *k8s.ClientFactory
	kubeHandler      *api.KubeConfigHandler
	resourcesHandler *api.ResourcesHandler
}

// New creates a new server instance
func New(cfg *config.Config) *Server {
	// Set Gin mode
	if cfg.Logging.Level == "debug" {
		gin.SetMode(gin.DebugMode)
	} else {
		gin.SetMode(gin.ReleaseMode)
	}

	// Create logger
	log := logger.New(cfg.Logging.Level)

	// Create router
	router := gin.New()

	// Create storage and client factory
	store := storage.NewKubeConfigStore()
	clientFactory := k8s.NewClientFactory()
	kubeHandler := api.NewKubeConfigHandler(store, clientFactory, log)
	resourcesHandler := api.NewResourcesHandler(store, clientFactory, log)

	// Create server
	srv := &Server{
		config:           cfg,
		logger:           log,
		router:           router,
		store:            store,
		clientFactory:    clientFactory,
		kubeHandler:      kubeHandler,
		resourcesHandler: resourcesHandler,
	}

	// Setup middleware
	srv.setupMiddleware()

	// Setup routes
	srv.setupRoutes()

	// Create HTTP server
	srv.server = &http.Server{
		Addr:         fmt.Sprintf("%s:%s", cfg.Server.Host, cfg.Server.Port),
		Handler:      router,
		ReadTimeout:  15 * time.Second,
		WriteTimeout: 15 * time.Second,
		IdleTimeout:  60 * time.Second,
	}

	return srv
}

// setupMiddleware configures all middleware
func (s *Server) setupMiddleware() {
	// Recovery middleware
	s.router.Use(middleware.Recovery(s.logger.Logger))

	// CORS middleware
	s.router.Use(middleware.CORS())

	// Logging middleware
	s.router.Use(middleware.Logger(s.logger.Logger))
}

// setupRoutes configures all routes
func (s *Server) setupRoutes() {
	// Health check endpoint
	s.router.GET("/health", s.healthCheck)

	// API routes
	api := s.router.Group("/api/v1")
	{
		// API info
		api.GET("/", s.apiInfo)

		// Kubeconfig management
		api.GET("/app/config", s.kubeHandler.GetConfigs)
		api.POST("/app/config/kubeconfigs", s.kubeHandler.AddKubeconfig)
		api.POST("/app/config/kubeconfigs-bearer", s.kubeHandler.AddBearerKubeconfig)
		api.POST("/app/config/kubeconfigs-certificate", s.kubeHandler.AddCertificateKubeconfig)
		api.DELETE("/app/config/kubeconfigs/:id", s.kubeHandler.DeleteKubeconfig)

		// Kubernetes Resources - Cluster-scoped resources (SSE)
		api.GET("/namespaces", s.resourcesHandler.GetNamespacesSSE)
		api.GET("/namespaces/:name", s.resourcesHandler.GetNamespace)
		api.GET("/namespaces/:name/yaml", s.resourcesHandler.GetNamespaceYAML)
		api.GET("/namespaces/:name/events", s.resourcesHandler.GetNamespaceEvents)
		api.GET("/nodes", s.resourcesHandler.GetNodesSSE)
		api.GET("/nodes/:name", s.resourcesHandler.GetNode)
		api.GET("/nodes/:name/yaml", s.resourcesHandler.GetNodeYAML)
		api.GET("/nodes/:name/events", s.resourcesHandler.GetNodeEvents)
		api.GET("/customresourcedefinitions", s.resourcesHandler.GetCustomResourceDefinitionsSSE)
		api.GET("/customresourcedefinitions/:name", s.resourcesHandler.GetCustomResourceDefinition)
		api.GET("/customresources", s.resourcesHandler.GetCustomResourcesSSE)
		api.GET("/customresources/:namespace/:name", s.resourcesHandler.GetCustomResource)

		// Kubernetes Resources - Namespace-scoped resources (SSE)
		api.GET("/pods", s.resourcesHandler.GetPodsSSE)
		api.GET("/pods/:namespace/:name", s.resourcesHandler.GetPod)
		api.GET("/pods/:namespace/:name/yaml", s.resourcesHandler.GetPodYAML)
		api.GET("/pods/:namespace/:name/events", s.resourcesHandler.GetPodEvents)
		api.GET("/pods/:namespace/:name/logs", s.resourcesHandler.GetPodLogs)
		api.GET("/pods/:namespace/:name/exec", s.resourcesHandler.GetPodExec)
		api.GET("/pods/:namespace/:name/exec/ws", s.resourcesHandler.GetPodExecWebSocket)
		api.GET("/pod/:name", s.resourcesHandler.GetPodByName)
		api.GET("/pod/:name/yaml", s.resourcesHandler.GetPodYAMLByName)
		api.GET("/pod/:name/events", s.resourcesHandler.GetPodEventsByName)
		api.GET("/deployments", s.resourcesHandler.GetDeploymentsSSE)
		api.GET("/deployments/:namespace/:name", s.resourcesHandler.GetDeployment)
		api.GET("/deployments/:namespace/:name/yaml", s.resourcesHandler.GetDeploymentYAML)
		api.GET("/deployments/:namespace/:name/events", s.resourcesHandler.GetDeploymentEvents)
		api.GET("/deployments/:namespace/:name/pods", s.resourcesHandler.GetDeploymentPods)
		api.GET("/deployment/:name", s.resourcesHandler.GetDeploymentByName)
		api.GET("/deployment/:name/yaml", s.resourcesHandler.GetDeploymentYAMLByName)
		api.GET("/deployment/:name/events", s.resourcesHandler.GetDeploymentEventsByName)
		api.GET("/deployment/:name/pods", s.resourcesHandler.GetDeploymentPodsByName)
		api.GET("/services", s.resourcesHandler.GetServicesSSE)
		api.GET("/services/:namespace/:name", s.resourcesHandler.GetService)
		api.GET("/services/:namespace/:name/yaml", s.resourcesHandler.GetServiceYAML)
		api.GET("/services/:namespace/:name/events", s.resourcesHandler.GetServiceEvents)
		api.GET("/service/:name", s.resourcesHandler.GetServiceByName)
		api.GET("/service/:name/yaml", s.resourcesHandler.GetServiceYAMLByName)
		api.GET("/service/:name/events", s.resourcesHandler.GetServiceEventsByName)
		api.GET("/configmaps", s.resourcesHandler.GetConfigMapsSSE)
		api.GET("/configmaps/:namespace/:name", s.resourcesHandler.GetConfigMap)
		api.GET("/configmaps/:namespace/:name/yaml", s.resourcesHandler.GetConfigMapYAML)
		api.GET("/configmaps/:namespace/:name/events", s.resourcesHandler.GetConfigMapEvents)
		api.GET("/configmap/:name", s.resourcesHandler.GetConfigMapByName)
		api.GET("/configmap/:name/yaml", s.resourcesHandler.GetConfigMapYAMLByName)
		api.GET("/configmap/:name/events", s.resourcesHandler.GetConfigMapEventsByName)
		api.GET("/secrets", s.resourcesHandler.GetSecretsSSE)
		api.GET("/secrets/:namespace/:name", s.resourcesHandler.GetSecret)
		api.GET("/secrets/:namespace/:name/yaml", s.resourcesHandler.GetSecretYAML)
		api.GET("/secrets/:namespace/:name/events", s.resourcesHandler.GetSecretEvents)
		api.GET("/secret/:name", s.resourcesHandler.GetSecretByName)
		api.GET("/secret/:name/yaml", s.resourcesHandler.GetSecretYAMLByName)
		api.GET("/secret/:name/events", s.resourcesHandler.GetSecretEventsByName)

		// Generic resource handlers for other Kubernetes resources (SSE)
		api.GET("/:resource", s.resourcesHandler.GetGenericResourceSSE)
		api.GET("/:resource/:namespace/:name", s.resourcesHandler.GetGenericResourceDetails)
		api.GET("/:resource/:namespace/:name/events", s.resourcesHandler.GetGenericResourceEvents)
	}

	// Serve static files from the dist folder
	s.router.Static("/assets", s.config.StaticFiles.Path+"/assets")

	// Serve the main index.html for all other routes (SPA routing)
	s.router.NoRoute(s.serveSPA)
}

// healthCheck handles health check requests
func (s *Server) healthCheck(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{
		"status":    "healthy",
		"timestamp": time.Now().UTC().Format(time.RFC3339),
		"version":   "1.0.0",
	})
}

// apiInfo returns API information
func (s *Server) apiInfo(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{
		"name":        "KubeWall API",
		"version":     "1.0.0",
		"description": "Kubernetes Dashboard API",
		"endpoints":   []string{"/health", "/api/v1/"},
	})
}

// serveSPA serves the main index.html file for SPA routing
func (s *Server) serveSPA(c *gin.Context) {
	// Check if the request is for the root path or a path that should serve the SPA
	path := c.Request.URL.Path

	// Skip API routes
	if len(path) >= 4 && path[:4] == "/api" {
		c.Status(http.StatusNotFound)
		return
	}

	// Skip health check
	if path == "/health" {
		c.Status(http.StatusNotFound)
		return
	}

	// Log the SPA request for debugging
	s.logger.WithField("path", path).Debug("Serving SPA for path")

	// Serve the index.html file for all other routes
	c.File(s.config.StaticFiles.Path + "/index.html")
}

// Start starts the server
func (s *Server) Start() error {
	s.logger.WithField("address", s.server.Addr).Info("Starting server")
	s.logger.WithField("static_files_path", s.config.StaticFiles.Path).Info("Static files configuration")
	return s.server.ListenAndServe()
}

// Stop gracefully stops the server
func (s *Server) Stop(ctx context.Context) error {
	s.logger.Info("Stopping server")
	return s.server.Shutdown(ctx)
}

// GetRouter returns the router for testing purposes
func (s *Server) GetRouter() *gin.Engine {
	return s.router
}
