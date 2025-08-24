package server

import (
	"context"
	"fmt"
	"net/http"
	"time"

	"github.com/Facets-cloud/kube-dash/internal/api"
	handlers "github.com/Facets-cloud/kube-dash/internal/api/handlers"
	access_control "github.com/Facets-cloud/kube-dash/internal/api/handlers/access-control"
	"github.com/Facets-cloud/kube-dash/internal/api/handlers/cloudshell"
	"github.com/Facets-cloud/kube-dash/internal/api/handlers/cluster"
	"github.com/Facets-cloud/kube-dash/internal/api/handlers/configurations"
	custom_resources "github.com/Facets-cloud/kube-dash/internal/api/handlers/custom-resources"
	"github.com/Facets-cloud/kube-dash/internal/api/handlers/helm"
	metrics_handlers "github.com/Facets-cloud/kube-dash/internal/api/handlers/metrics"
	"github.com/Facets-cloud/kube-dash/internal/api/handlers/networking"
	"github.com/Facets-cloud/kube-dash/internal/api/handlers/portforward"
	storage_handlers "github.com/Facets-cloud/kube-dash/internal/api/handlers/storage"
	tracing_handlers "github.com/Facets-cloud/kube-dash/internal/api/handlers/tracing"
	"github.com/Facets-cloud/kube-dash/internal/api/handlers/websocket"
	"github.com/Facets-cloud/kube-dash/internal/api/handlers/websockets"
	"github.com/Facets-cloud/kube-dash/internal/api/handlers/workloads"
	"github.com/Facets-cloud/kube-dash/internal/config"
	"github.com/Facets-cloud/kube-dash/internal/k8s"
	"github.com/Facets-cloud/kube-dash/internal/storage"
	"github.com/Facets-cloud/kube-dash/internal/tracing"
	"github.com/Facets-cloud/kube-dash/pkg/logger"
	"github.com/Facets-cloud/kube-dash/pkg/middleware"
	pkg_tracing "github.com/Facets-cloud/kube-dash/pkg/tracing"

	"github.com/gin-gonic/gin"
	ginSwagger "github.com/swaggo/gin-swagger"
	swaggerFiles "github.com/swaggo/files"
)

// Server represents the HTTP server
type Server struct {
	config        *config.Config
	logger        *logger.Logger
	router        *gin.Engine
	server        *http.Server
	store         *storage.KubeConfigStore
	clientFactory *k8s.ClientFactory
	kubeHandler   *api.KubeConfigHandler
	// Base resources handler for generic operations (delete, permission checks)
	baseResourcesHandler *handlers.ResourcesHandler

	// Configuration handlers
	configMapsHandler           *configurations.ConfigMapsHandler
	secretsHandler              *configurations.SecretsHandler
	hpasHandler                 *configurations.HPAsHandler
	limitRangesHandler          *configurations.LimitRangesHandler
	resourceQuotasHandler       *configurations.ResourceQuotasHandler
	podDisruptionBudgetsHandler *configurations.PodDisruptionBudgetsHandler
	priorityClassesHandler      *configurations.PriorityClassesHandler
	runtimeClassesHandler       *configurations.RuntimeClassesHandler

	// Cluster handlers
	nodesHandler      *cluster.NodesHandler
	namespacesHandler *cluster.NamespacesHandler
	eventsHandler     *cluster.EventsHandler
	leasesHandler     *cluster.LeasesHandler

	// Custom Resource handlers
	customResourceDefinitionsHandler *custom_resources.CustomResourceDefinitionsHandler
	customResourcesHandler           *custom_resources.CustomResourcesHandler

	// Workload handlers
	podsHandler               *workloads.PodsHandler
	deploymentsHandler        *workloads.DeploymentsHandler
	daemonSetsHandler         *workloads.DaemonSetsHandler
	statefulSetsHandler       *workloads.StatefulSetsHandler
	replicaSetsHandler        *workloads.ReplicaSetsHandler
	jobsHandler               *workloads.JobsHandler
	cronJobsHandler           *workloads.CronJobsHandler
	resourceReferencesHandler *workloads.ResourceReferencesHandler

	// Access Control handlers
	serviceAccountsHandler     *access_control.ServiceAccountsHandler
	rolesHandler               *access_control.RolesHandler
	roleBindingsHandler        *access_control.RoleBindingsHandler
	clusterRolesHandler        *access_control.ClusterRolesHandler
	clusterRoleBindingsHandler *access_control.ClusterRoleBindingsHandler

	// Networking handlers
	servicesHandler  *networking.ServicesHandler
	ingressesHandler *networking.IngressesHandler
	endpointsHandler *networking.EndpointsHandler

	// Metrics handlers
	prometheusHandler *metrics_handlers.PrometheusHandler

	// Storage handlers
	persistentVolumesHandler      *storage_handlers.PersistentVolumesHandler
	persistentVolumeClaimsHandler *storage_handlers.PersistentVolumeClaimsHandler
	storageClassesHandler         *storage_handlers.StorageClassesHandler

	// WebSocket handlers
	podExecHandler     *websocket.PodExecHandler
	podLogsHandler     *websockets.PodLogsHandler
	portForwardHandler *portforward.PortForwardHandler

	// Helm handlers
	helmHandler *helm.HelmHandler

	// Cloud Shell handlers
	cloudShellHandler *cloudshell.CloudShellHandler

	// Tracing handlers
	tracingHandler *tracing_handlers.TracingHandler
	traceStore     tracing.TraceStoreInterface

	// Feature flags handler
	featureFlagsHandler *handlers.FeatureFlagsHandler
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
	// Try to create store with database backend, fallback to in-memory if it fails
	var store *storage.KubeConfigStore
	if storeWithDB, err := storage.NewKubeConfigStoreWithDB(&cfg.Database); err != nil {
		log.WithError(err).Warn("Failed to initialize database storage, falling back to in-memory storage")
		store = storage.NewKubeConfigStore()
	} else {
		log.Info("Successfully initialized database storage backend")
		store = storeWithDB
	}
	clientFactory := k8s.NewClientFactory()
	kubeHandler := api.NewKubeConfigHandler(store, clientFactory, log)

	// Create configuration handlers
	configMapsHandler := configurations.NewConfigMapsHandler(store, clientFactory, log)
	secretsHandler := configurations.NewSecretsHandler(store, clientFactory, log)
	hpasHandler := configurations.NewHPAsHandler(store, clientFactory, log)
	limitRangesHandler := configurations.NewLimitRangesHandler(store, clientFactory, log)
	resourceQuotasHandler := configurations.NewResourceQuotasHandler(store, clientFactory, log)
	podDisruptionBudgetsHandler := configurations.NewPodDisruptionBudgetsHandler(store, clientFactory, log)
	priorityClassesHandler := configurations.NewPriorityClassesHandler(store, clientFactory, log)
	runtimeClassesHandler := configurations.NewRuntimeClassesHandler(store, clientFactory, log)

	// Create cluster handlers
	nodesHandler := cluster.NewNodesHandler(store, clientFactory, log)
	namespacesHandler := cluster.NewNamespacesHandler(store, clientFactory, log)
	eventsHandler := cluster.NewEventsHandler(store, clientFactory, log)
	leasesHandler := cluster.NewLeasesHandler(store, clientFactory, log)

	// Create custom resource handlers
	customResourceDefinitionsHandler := custom_resources.NewCustomResourceDefinitionsHandler(store, clientFactory, log)
	customResourcesHandler := custom_resources.NewCustomResourcesHandler(store, clientFactory, log)

	// Create workload handlers
	podsHandler := workloads.NewPodsHandler(store, clientFactory, log)
	deploymentsHandler := workloads.NewDeploymentsHandler(store, clientFactory, log)
	daemonSetsHandler := workloads.NewDaemonSetsHandler(store, clientFactory, log)
	statefulSetsHandler := workloads.NewStatefulSetsHandler(store, clientFactory, log)
	replicaSetsHandler := workloads.NewReplicaSetsHandler(store, clientFactory, log)
	jobsHandler := workloads.NewJobsHandler(store, clientFactory, log)
	cronJobsHandler := workloads.NewCronJobsHandler(store, clientFactory, log)
	resourceReferencesHandler := workloads.NewResourceReferencesHandler(store, clientFactory, log)

	// Create access control handlers
	serviceAccountsHandler := access_control.NewServiceAccountsHandler(store, clientFactory, log)
	rolesHandler := access_control.NewRolesHandler(store, clientFactory, log)
	roleBindingsHandler := access_control.NewRoleBindingsHandler(store, clientFactory, log)
	clusterRolesHandler := access_control.NewClusterRolesHandler(store, clientFactory, log)
	clusterRoleBindingsHandler := access_control.NewClusterRoleBindingsHandler(store, clientFactory, log)

	// Create networking handlers
	servicesHandler := networking.NewServicesHandler(store, clientFactory, log)
	ingressesHandler := networking.NewIngressesHandler(store, clientFactory, log)
	endpointsHandler := networking.NewEndpointsHandler(store, clientFactory, log)

	// Metrics handlers
	prometheusHandler := metrics_handlers.NewPrometheusHandler(store, clientFactory, log)

	// Create storage handlers
	persistentVolumesHandler := storage_handlers.NewPersistentVolumesHandler(store, clientFactory, log)
	persistentVolumeClaimsHandler := storage_handlers.NewPersistentVolumeClaimsHandler(store, clientFactory, log)
	storageClassesHandler := storage_handlers.NewStorageClassesHandler(store, clientFactory, log)

	// Create WebSocket handlers
	podExecHandler := websocket.NewPodExecHandler(store, clientFactory, log)
	podLogsHandler := websockets.NewPodLogsHandler(store, clientFactory, log)
	portForwardHandler := portforward.NewPortForwardHandler(store, clientFactory, log)

	// Create Helm handlers
	helmFactory := k8s.NewHelmClientFactory()
	helmHandler := helm.NewHelmHandler(store, clientFactory, helmFactory, log)

	// Create base resources handler with helm handler dependency
	baseResourcesHandler := handlers.NewResourcesHandler(store, clientFactory, log, helmHandler)

	// Create Cloud Shell handlers
	cloudShellHandler := cloudshell.NewCloudShellHandler(store, clientFactory, helmFactory, log)

	// Initialize OpenTelemetry tracing service
	var tracingService *tracing.TracingService
	var traceStore tracing.TraceStoreInterface
	if cfg.Tracing.Enabled {
		var err error
		tracingService, err = tracing.NewTracingService(&cfg.Tracing, log)
		if err != nil {
			log.WithError(err).Fatal("Failed to initialize tracing service")
		}
		traceStore = tracingService.GetStore()
	} else {
		// Try to use database-backed trace store if database is available
		if store.HasDatabase() {
			log.Info("Using database-backed trace storage")
			traceStore = tracing.NewDatabaseTraceStore(store.GetDatabase(), &cfg.Tracing)
		} else {
			log.Info("Using in-memory trace storage")
			traceStore = tracing.NewTraceStore(&cfg.Tracing)
		}
	}

	// Create tracing handlers
	tracingHandler := tracing_handlers.NewTracingHandler(store, traceStore, log, &cfg.Tracing)

	// Create feature flags handler
	featureFlagsHandler := handlers.NewFeatureFlagsHandler(log)

	// Create server
	srv := &Server{
		config:               cfg,
		logger:               log,
		router:               router,
		store:                store,
		clientFactory:        clientFactory,
		kubeHandler:          kubeHandler,
		baseResourcesHandler: baseResourcesHandler,

		// Configuration handlers
		configMapsHandler:           configMapsHandler,
		secretsHandler:              secretsHandler,
		hpasHandler:                 hpasHandler,
		limitRangesHandler:          limitRangesHandler,
		resourceQuotasHandler:       resourceQuotasHandler,
		podDisruptionBudgetsHandler: podDisruptionBudgetsHandler,
		priorityClassesHandler:      priorityClassesHandler,
		runtimeClassesHandler:       runtimeClassesHandler,

		// Cluster handlers
		nodesHandler:      nodesHandler,
		namespacesHandler: namespacesHandler,
		eventsHandler:     eventsHandler,
		leasesHandler:     leasesHandler,

		// Custom Resource handlers
		customResourceDefinitionsHandler: customResourceDefinitionsHandler,
		customResourcesHandler:           customResourcesHandler,

		// Workload handlers
		podsHandler:               podsHandler,
		deploymentsHandler:        deploymentsHandler,
		daemonSetsHandler:         daemonSetsHandler,
		statefulSetsHandler:       statefulSetsHandler,
		replicaSetsHandler:        replicaSetsHandler,
		jobsHandler:               jobsHandler,
		cronJobsHandler:           cronJobsHandler,
		resourceReferencesHandler: resourceReferencesHandler,

		// Access Control handlers
		serviceAccountsHandler:     serviceAccountsHandler,
		rolesHandler:               rolesHandler,
		roleBindingsHandler:        roleBindingsHandler,
		clusterRolesHandler:        clusterRolesHandler,
		clusterRoleBindingsHandler: clusterRoleBindingsHandler,

		// Networking handlers
		servicesHandler:  servicesHandler,
		ingressesHandler: ingressesHandler,
		endpointsHandler: endpointsHandler,

		// Metrics handlers
		prometheusHandler: prometheusHandler,

		// Storage handlers
		persistentVolumesHandler:      persistentVolumesHandler,
		persistentVolumeClaimsHandler: persistentVolumeClaimsHandler,
		storageClassesHandler:         storageClassesHandler,

		// WebSocket handlers
		podExecHandler:     podExecHandler,
		podLogsHandler:     podLogsHandler,
		portForwardHandler: portForwardHandler,

		// Helm handlers
		helmHandler: helmHandler,

		// Cloud Shell handlers
		cloudShellHandler: cloudShellHandler,

		// Tracing handlers
		tracingHandler: tracingHandler,
		traceStore:     traceStore,

		// Feature flags handler
		featureFlagsHandler: featureFlagsHandler,
	}

	// Setup middleware
	srv.setupMiddleware()

	// Setup routes
	srv.setupRoutes()

	// Create HTTP server
	srv.server = &http.Server{
		Addr:         fmt.Sprintf("%s:%s", cfg.Server.Host, cfg.Server.Port),
		Handler:      router,
		ReadTimeout:  time.Duration(cfg.Server.ReadTimeout) * time.Second,
		WriteTimeout: time.Duration(cfg.Server.WriteTimeout) * time.Second,
		IdleTimeout:  time.Duration(cfg.Server.IdleTimeout) * time.Second,
	}

	// Start cloud shell cleanup routine
	srv.cloudShellHandler.StartCleanupRoutine()

	return srv
}

// setupMiddleware configures all middleware
func (s *Server) setupMiddleware() {
	// Recovery middleware
	s.router.Use(middleware.Recovery(s.logger.Logger))

	// CORS middleware
	s.router.Use(middleware.CORS())

	// OpenTelemetry tracing middleware
	if s.config.Tracing.Enabled {
		s.router.Use(tracing.TracingMiddleware(s.config.Tracing.ServiceName))
	}

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
		// Metrics (Prometheus) endpoints
		api.GET("/metrics/prometheus/availability", s.prometheusHandler.GetAvailability)
		api.GET("/metrics/pods/:namespace/:name/prometheus", s.prometheusHandler.GetPodEnhancedMetricsSSE)
		api.GET("/metrics/nodes/:name/prometheus", s.prometheusHandler.GetNodeMetricsSSE)
		api.GET("/metrics/overview/prometheus", s.prometheusHandler.GetClusterOverviewSSE)
		// API info
		api.GET("/", s.apiInfo)

		// Feature flags endpoint
		api.GET("/feature-flags", s.featureFlagsHandler.GetFeatureFlags)



		// Kubeconfig management
		api.GET("/app/config", s.kubeHandler.GetConfigs)
		api.POST("/app/config/kubeconfigs", s.kubeHandler.AddKubeconfig)
		api.POST("/app/config/kubeconfigs-bearer", s.kubeHandler.AddBearerKubeconfig)
		api.POST("/app/config/kubeconfigs-certificate", s.kubeHandler.AddCertificateKubeconfig)
		api.POST("/app/config/validate", s.kubeHandler.ValidateKubeconfig)
		api.POST("/app/config/validate-bearer", s.kubeHandler.ValidateBearerToken)
		api.POST("/app/config/validate-certificate", s.kubeHandler.ValidateCertificate)
		api.GET("/app/config/validate-all", s.kubeHandler.ValidateAllKubeconfigs)
		api.DELETE("/app/config/kubeconfigs/:id", s.kubeHandler.DeleteKubeconfig)

		// Apply Kubernetes resources from YAML
		api.POST("/app/apply", s.baseResourcesHandler.ApplyResources)

		// Kubernetes Resources - Cluster-scoped resources (SSE)
		api.GET("/namespaces", s.namespacesHandler.GetNamespacesSSE)
		api.GET("/namespaces/:name", s.namespacesHandler.GetNamespace)
		api.GET("/namespaces/:name/yaml", s.namespacesHandler.GetNamespaceYAML)
		api.GET("/namespaces/:name/events", s.namespacesHandler.GetNamespaceEvents)
		api.GET("/namespaces/:name/pods", s.namespacesHandler.GetNamespacePods)
		api.GET("/nodes", s.nodesHandler.GetNodesSSE)
		api.GET("/nodes/:name", s.nodesHandler.GetNode)
		api.GET("/nodes/:name/yaml", s.nodesHandler.GetNodeYAML)
		api.GET("/nodes/:name/events", s.nodesHandler.GetNodeEvents)
		api.GET("/nodes/:name/pods", s.nodesHandler.GetNodePods)
		// Node actions
		api.POST("/nodes/:name/cordon", s.nodesHandler.CordonNode)
		api.POST("/nodes/:name/uncordon", s.nodesHandler.UncordonNode)
		api.POST("/nodes/:name/drain", s.nodesHandler.DrainNode)
		api.GET("/nodes/actions/permissions", s.nodesHandler.CheckNodeActionPermission)
		api.GET("/customresourcedefinitions", s.customResourceDefinitionsHandler.GetCustomResourceDefinitionsSSE)
		api.GET("/customresourcedefinitions/:name", s.customResourceDefinitionsHandler.GetCustomResourceDefinition)
		api.GET("/customresources", s.customResourcesHandler.GetCustomResourcesSSE)
		api.GET("/customresources/:namespace/:name", s.customResourcesHandler.GetCustomResource)
		api.GET("/customresources/:namespace/:name/yaml", s.customResourcesHandler.GetCustomResourceYAML)
		api.GET("/customresources/:namespace/:name/events", s.customResourcesHandler.GetCustomResourceEvents)
		// Cluster-scoped CR routes use singular base to avoid conflict with namespaced routes
		api.GET("/customresource/:name", s.customResourcesHandler.GetCustomResource)
		api.GET("/customresource/:name/yaml", s.customResourcesHandler.GetCustomResourceYAMLByName)
		api.GET("/customresource/:name/events", s.customResourcesHandler.GetCustomResourceEventsByName)

		// Generic delete endpoint (bulk)
		api.DELETE("/:resourcekind", s.baseResourcesHandler.DeleteResources)
		// Optimized bulk delete endpoint for 5+ items
		api.DELETE("/bulk/:resourcekind", s.baseResourcesHandler.BulkDeleteResources)
		// Permission check endpoint for actions like delete
		api.GET("/permissions/check", s.baseResourcesHandler.CheckPermission)
		// Permission check endpoint for YAML editing
		api.GET("/permissions/yaml-edit", s.baseResourcesHandler.CheckYamlEditPermission)

		// ConfigMaps endpoints
		api.GET("/configmaps", s.configMapsHandler.GetConfigMapsSSE)
		api.GET("/configmaps/:namespace/:name", s.configMapsHandler.GetConfigMap)
		api.GET("/configmaps/:namespace/:name/yaml", s.configMapsHandler.GetConfigMapYAML)
		api.GET("/configmaps/:namespace/:name/events", s.configMapsHandler.GetConfigMapEvents)
		api.GET("/configmap/:name", s.configMapsHandler.GetConfigMapByName)
		api.GET("/configmap/:name/yaml", s.configMapsHandler.GetConfigMapYAMLByName)
		api.GET("/configmap/:name/events", s.configMapsHandler.GetConfigMapEventsByName)
		api.GET("/configmap/:name/dependencies", s.resourceReferencesHandler.GetConfigMapDependencies)

		// Secrets endpoints
		api.GET("/secrets", s.secretsHandler.GetSecretsSSE)
		api.GET("/secrets/:namespace/:name", s.secretsHandler.GetSecret)
		api.GET("/secrets/:namespace/:name/yaml", s.secretsHandler.GetSecretYAML)
		api.GET("/secrets/:namespace/:name/events", s.secretsHandler.GetSecretEvents)
		api.GET("/secret/:name", s.secretsHandler.GetSecretByName)
		api.GET("/secret/:name/yaml", s.secretsHandler.GetSecretYAMLByName)
		api.GET("/secret/:name/events", s.secretsHandler.GetSecretEventsByName)
		api.GET("/secret/:name/dependencies", s.resourceReferencesHandler.GetSecretDependencies)

		// HPA endpoints
		api.GET("/horizontalpodautoscalers", s.hpasHandler.GetHPAsSSE)
		api.GET("/horizontalpodautoscalers/:namespace/:name", s.hpasHandler.GetHPA)
		api.GET("/horizontalpodautoscalers/:namespace/:name/yaml", s.hpasHandler.GetHPAYAML)
		api.GET("/horizontalpodautoscalers/:namespace/:name/events", s.hpasHandler.GetHPAEvents)
		api.GET("/horizontalpodautoscaler/:name", s.hpasHandler.GetHPAByName)
		api.GET("/horizontalpodautoscaler/:name/yaml", s.hpasHandler.GetHPAYAMLByName)
		api.GET("/horizontalpodautoscaler/:name/events", s.hpasHandler.GetHPAEventsByName)

		// Configuration SSE endpoints
		api.GET("/limitranges", s.limitRangesHandler.GetLimitRangesSSE)
		api.GET("/resourcequotas", s.resourceQuotasHandler.GetResourceQuotasSSE)
		api.GET("/poddisruptionbudgets", s.podDisruptionBudgetsHandler.GetPodDisruptionBudgetsSSE)
		api.GET("/priorityclasses", s.priorityClassesHandler.GetPriorityClassesSSE)
		api.GET("/runtimeclasses", s.runtimeClassesHandler.GetRuntimeClassesSSE)

		// Cluster SSE endpoints
		api.GET("/events", s.eventsHandler.GetEventsSSE)
		api.GET("/leases", s.leasesHandler.GetLeasesSSE)

		// Configuration detail endpoints
		api.GET("/limitranges/:namespace/:name", s.limitRangesHandler.GetLimitRange)
		api.GET("/limitranges/:namespace/:name/yaml", s.limitRangesHandler.GetLimitRangeYAML)
		api.GET("/limitranges/:namespace/:name/events", s.limitRangesHandler.GetLimitRangeEvents)
		api.GET("/limitrange/:name", s.limitRangesHandler.GetLimitRangeByName)
		api.GET("/limitrange/:name/yaml", s.limitRangesHandler.GetLimitRangeYAMLByName)
		api.GET("/limitrange/:name/events", s.limitRangesHandler.GetLimitRangeEventsByName)

		api.GET("/resourcequotas/:namespace/:name", s.resourceQuotasHandler.GetResourceQuota)
		api.GET("/resourcequotas/:namespace/:name/yaml", s.resourceQuotasHandler.GetResourceQuotaYAML)
		api.GET("/resourcequotas/:namespace/:name/events", s.resourceQuotasHandler.GetResourceQuotaEvents)
		api.GET("/resourcequota/:name", s.resourceQuotasHandler.GetResourceQuotaByName)
		api.GET("/resourcequota/:name/yaml", s.resourceQuotasHandler.GetResourceQuotaYAMLByName)
		api.GET("/resourcequota/:name/events", s.resourceQuotasHandler.GetResourceQuotaEventsByName)

		api.GET("/poddisruptionbudgets/:namespace/:name", s.podDisruptionBudgetsHandler.GetPodDisruptionBudget)
		api.GET("/poddisruptionbudgets/:namespace/:name/yaml", s.podDisruptionBudgetsHandler.GetPodDisruptionBudgetYAML)
		api.GET("/poddisruptionbudgets/:namespace/:name/events", s.podDisruptionBudgetsHandler.GetPodDisruptionBudgetEvents)
		api.GET("/poddisruptionbudget/:name", s.podDisruptionBudgetsHandler.GetPodDisruptionBudgetByName)
		api.GET("/poddisruptionbudget/:name/yaml", s.podDisruptionBudgetsHandler.GetPodDisruptionBudgetYAMLByName)
		api.GET("/poddisruptionbudget/:name/events", s.podDisruptionBudgetsHandler.GetPodDisruptionBudgetEventsByName)

		api.GET("/priorityclasses/:name", s.priorityClassesHandler.GetPriorityClass)
		api.GET("/priorityclasses/:name/yaml", s.priorityClassesHandler.GetPriorityClassYAML)
		api.GET("/priorityclasses/:name/events", s.priorityClassesHandler.GetPriorityClassEvents)
		api.GET("/priorityclass/:name", s.priorityClassesHandler.GetPriorityClassByName)
		api.GET("/priorityclass/:name/yaml", s.priorityClassesHandler.GetPriorityClassYAMLByName)
		api.GET("/priorityclass/:name/events", s.priorityClassesHandler.GetPriorityClassEventsByName)

		api.GET("/runtimeclasses/:name", s.runtimeClassesHandler.GetRuntimeClass)
		api.GET("/runtimeclasses/:name/yaml", s.runtimeClassesHandler.GetRuntimeClassYAML)
		api.GET("/runtimeclasses/:name/events", s.runtimeClassesHandler.GetRuntimeClassEvents)
		api.GET("/runtimeclass/:name", s.runtimeClassesHandler.GetRuntimeClassByName)
		api.GET("/runtimeclass/:name/yaml", s.runtimeClassesHandler.GetRuntimeClassYAMLByName)
		api.GET("/runtimeclass/:name/events", s.runtimeClassesHandler.GetRuntimeClassEventsByName)

		// Cluster detail endpoints
		api.GET("/events/:namespace/:name", s.eventsHandler.GetEvents)
		api.GET("/leases/:namespace/:name", s.leasesHandler.GetLease)
		api.GET("/leases/:namespace/:name/yaml", s.leasesHandler.GetLeaseYAML)
		api.GET("/leases/:namespace/:name/events", s.leasesHandler.GetLeaseEvents)

		// Workload SSE endpoints
		api.GET("/pods", s.podsHandler.GetPodsSSE)
		api.GET("/deployments", s.deploymentsHandler.GetDeploymentsSSE)
		api.POST("/deployments/:name/scale", s.deploymentsHandler.ScaleDeployment)
		api.POST("/deployments/:name/restart", s.deploymentsHandler.RestartDeployment)
		api.POST("/statefulsets/:name/scale", s.statefulSetsHandler.ScaleStatefulSet)
		api.POST("/statefulsets/:name/restart", s.statefulSetsHandler.RestartStatefulSet)
		api.POST("/daemonsets/:name/restart", s.daemonSetsHandler.RestartDaemonSet)
		api.GET("/daemonsets", s.daemonSetsHandler.GetDaemonSetsSSE)
		api.GET("/statefulsets", s.statefulSetsHandler.GetStatefulSetsSSE)
		api.GET("/replicasets", s.replicaSetsHandler.GetReplicaSetsSSE)
		api.GET("/jobs", s.jobsHandler.GetJobsSSE)
		api.GET("/cronjobs", s.cronJobsHandler.GetCronJobsSSE)

		// Workload detail endpoints
		api.GET("/pods/:namespace/:name", s.podsHandler.GetPod)
		api.GET("/pods/:namespace/:name/yaml", s.podsHandler.GetPodYAML)
		api.GET("/pods/:namespace/:name/events", s.podsHandler.GetPodEvents)

		api.GET("/pods/:namespace/:name/logs/ws", s.podLogsHandler.HandlePodLogs)
		api.GET("/pods/:namespace/:name/metrics", s.podsHandler.GetPodMetricsHistory)
		api.GET("/pod/:name", s.podsHandler.GetPodByName)
		api.GET("/pod/:name/yaml", s.podsHandler.GetPodYAMLByName)
		api.GET("/pod/:name/events", s.podsHandler.GetPodEventsByName)

		api.GET("/pod/:name/logs/ws", s.podLogsHandler.HandlePodLogs)

		// WebSocket routes for pod exec
		api.GET("/pods/:namespace/:name/exec/ws", s.podExecHandler.HandlePodExec)
		api.GET("/pod/:name/exec/ws", s.podExecHandler.HandlePodExecByName)

		// Port Forward routes
		api.GET("/portforward/ws", s.portForwardHandler.HandlePortForward)
		api.GET("/portforward/sessions", s.portForwardHandler.GetActiveSessions)
		api.DELETE("/portforward/sessions/:id", s.portForwardHandler.StopSession)

		api.GET("/deployments/:namespace/:name", s.deploymentsHandler.GetDeployment)
		api.GET("/deployments/:namespace/:name/yaml", s.deploymentsHandler.GetDeploymentYAML)
		api.GET("/deployments/:namespace/:name/events", s.deploymentsHandler.GetDeploymentEvents)
		api.GET("/deployments/:namespace/:name/pods", s.resourceReferencesHandler.GetDeploymentPods)
		api.GET("/deployment/:name", s.deploymentsHandler.GetDeploymentByName)
		api.GET("/deployment/:name/yaml", s.deploymentsHandler.GetDeploymentYAMLByName)
		api.GET("/deployment/:name/events", s.deploymentsHandler.GetDeploymentEventsByName)
		api.GET("/deployment/:name/pods", s.resourceReferencesHandler.GetDeploymentPodsByName)

		api.GET("/daemonsets/:namespace/:name", s.daemonSetsHandler.GetDaemonSet)
		api.GET("/daemonsets/:namespace/:name/yaml", s.daemonSetsHandler.GetDaemonSetYAML)
		api.GET("/daemonsets/:namespace/:name/events", s.daemonSetsHandler.GetDaemonSetEvents)
		api.GET("/daemonsets/:namespace/:name/pods", s.resourceReferencesHandler.GetDaemonSetPods)
		api.GET("/daemonset/:name", s.daemonSetsHandler.GetDaemonSetByName)
		api.GET("/daemonset/:name/yaml", s.daemonSetsHandler.GetDaemonSetYAMLByName)
		api.GET("/daemonset/:name/events", s.daemonSetsHandler.GetDaemonSetEventsByName)
		api.GET("/daemonset/:name/pods", s.resourceReferencesHandler.GetDaemonSetPodsByName)

		api.GET("/statefulsets/:namespace/:name", s.statefulSetsHandler.GetStatefulSet)
		api.GET("/statefulsets/:namespace/:name/yaml", s.statefulSetsHandler.GetStatefulSetYAML)
		api.GET("/statefulsets/:namespace/:name/events", s.statefulSetsHandler.GetStatefulSetEvents)
		api.GET("/statefulsets/:namespace/:name/pods", s.resourceReferencesHandler.GetStatefulSetPods)
		api.GET("/statefulset/:name", s.statefulSetsHandler.GetStatefulSetByName)
		api.GET("/statefulset/:name/yaml", s.statefulSetsHandler.GetStatefulSetYAMLByName)
		api.GET("/statefulset/:name/events", s.statefulSetsHandler.GetStatefulSetEventsByName)
		api.GET("/statefulset/:name/pods", s.resourceReferencesHandler.GetStatefulSetPodsByName)

		api.GET("/replicasets/:namespace/:name", s.replicaSetsHandler.GetReplicaSet)
		api.GET("/replicasets/:namespace/:name/yaml", s.replicaSetsHandler.GetReplicaSetYAML)
		api.GET("/replicasets/:namespace/:name/events", s.replicaSetsHandler.GetReplicaSetEvents)
		api.GET("/replicasets/:namespace/:name/pods", s.resourceReferencesHandler.GetReplicaSetPods)
		api.GET("/replicaset/:name", s.replicaSetsHandler.GetReplicaSetByName)
		api.GET("/replicaset/:name/yaml", s.replicaSetsHandler.GetReplicaSetYAMLByName)
		api.GET("/replicaset/:name/events", s.replicaSetsHandler.GetReplicaSetEventsByName)
		api.GET("/replicaset/:name/pods", s.resourceReferencesHandler.GetReplicaSetPodsByName)

		api.GET("/jobs/:namespace/:name", s.jobsHandler.GetJob)
		api.GET("/jobs/:namespace/:name/yaml", s.jobsHandler.GetJobYAML)
		api.GET("/jobs/:namespace/:name/events", s.jobsHandler.GetJobEvents)
		api.GET("/jobs/:namespace/:name/pods", s.resourceReferencesHandler.GetJobPods)
		api.GET("/job/:name", s.jobsHandler.GetJobByName)
		api.GET("/job/:name/yaml", s.jobsHandler.GetJobYAMLByName)
		api.GET("/job/:name/events", s.jobsHandler.GetJobEventsByName)
		api.GET("/job/:name/pods", s.resourceReferencesHandler.GetJobPodsByName)

		api.GET("/cronjobs/:namespace/:name", s.cronJobsHandler.GetCronJob)
		api.GET("/cronjobs/:namespace/:name/yaml", s.cronJobsHandler.GetCronJobYAML)
		api.GET("/cronjobs/:namespace/:name/events", s.cronJobsHandler.GetCronJobEvents)
		api.GET("/cronjobs/:namespace/:name/jobs", s.resourceReferencesHandler.GetCronJobJobs)
		api.POST("/cronjobs/:namespace/:name/trigger", s.cronJobsHandler.TriggerCronJob)
		api.PATCH("/cronjobs/:namespace/:name/suspend", s.cronJobsHandler.SuspendCronJob)
		api.GET("/cronjob/:name", s.cronJobsHandler.GetCronJobByName)
		api.GET("/cronjob/:name/yaml", s.cronJobsHandler.GetCronJobYAMLByName)
		api.GET("/cronjob/:name/events", s.cronJobsHandler.GetCronJobEventsByName)
		api.GET("/cronjob/:name/jobs", s.cronJobsHandler.GetCronJobJobsByName)

		// Access Control SSE endpoints
		api.GET("/serviceaccounts", s.serviceAccountsHandler.GetServiceAccountsSSE)
		api.GET("/roles", s.rolesHandler.GetRolesSSE)
		api.GET("/rolebindings", s.roleBindingsHandler.GetRoleBindingsSSE)
		api.GET("/clusterroles", s.clusterRolesHandler.GetClusterRolesSSE)
		api.GET("/clusterrolebindings", s.clusterRoleBindingsHandler.GetClusterRoleBindingsSSE)

		// Access Control detail endpoints
		api.GET("/serviceaccounts/:namespace/:name", s.serviceAccountsHandler.GetServiceAccount)
		api.GET("/serviceaccounts/:namespace/:name/yaml", s.serviceAccountsHandler.GetServiceAccountYAML)
		api.GET("/serviceaccounts/:namespace/:name/events", s.serviceAccountsHandler.GetServiceAccountEvents)
		api.GET("/serviceaccount/:name", s.serviceAccountsHandler.GetServiceAccountByName)
		api.GET("/serviceaccount/:name/yaml", s.serviceAccountsHandler.GetServiceAccountYAMLByName)
		api.GET("/serviceaccount/:name/events", s.serviceAccountsHandler.GetServiceAccountEventsByName)

		api.GET("/roles/:namespace/:name", s.rolesHandler.GetRole)
		api.GET("/roles/:namespace/:name/yaml", s.rolesHandler.GetRoleYAML)
		api.GET("/roles/:namespace/:name/events", s.rolesHandler.GetRoleEvents)
		api.GET("/role/:name", s.rolesHandler.GetRoleByName)
		api.GET("/role/:name/yaml", s.rolesHandler.GetRoleYAMLByName)
		api.GET("/role/:name/events", s.rolesHandler.GetRoleEventsByName)

		api.GET("/rolebindings/:namespace/:name", s.roleBindingsHandler.GetRoleBinding)
		api.GET("/rolebindings/:namespace/:name/yaml", s.roleBindingsHandler.GetRoleBindingYAML)
		api.GET("/rolebindings/:namespace/:name/events", s.roleBindingsHandler.GetRoleBindingEvents)
		api.GET("/rolebinding/:name", s.roleBindingsHandler.GetRoleBindingByName)
		api.GET("/rolebinding/:name/yaml", s.roleBindingsHandler.GetRoleBindingYAMLByName)
		api.GET("/rolebinding/:name/events", s.roleBindingsHandler.GetRoleBindingEventsByName)

		api.GET("/clusterroles/:name", s.clusterRolesHandler.GetClusterRole)
		api.GET("/clusterroles/:name/yaml", s.clusterRolesHandler.GetClusterRoleYAML)
		api.GET("/clusterroles/:name/events", s.clusterRolesHandler.GetClusterRoleEvents)
		api.GET("/clusterrole/:name", s.clusterRolesHandler.GetClusterRoleByName)
		api.GET("/clusterrole/:name/yaml", s.clusterRolesHandler.GetClusterRoleYAMLByName)
		api.GET("/clusterrole/:name/events", s.clusterRolesHandler.GetClusterRoleEventsByName)

		api.GET("/clusterrolebindings/:name", s.clusterRoleBindingsHandler.GetClusterRoleBinding)
		api.GET("/clusterrolebindings/:name/yaml", s.clusterRoleBindingsHandler.GetClusterRoleBindingYAML)
		api.GET("/clusterrolebindings/:name/events", s.clusterRoleBindingsHandler.GetClusterRoleBindingEvents)
		api.GET("/clusterrolebinding/:name", s.clusterRoleBindingsHandler.GetClusterRoleBindingByName)
		api.GET("/clusterrolebinding/:name/yaml", s.clusterRoleBindingsHandler.GetClusterRoleBindingYAMLByName)
		api.GET("/clusterrolebinding/:name/events", s.clusterRoleBindingsHandler.GetClusterRoleBindingEventsByName)

		// Networking SSE endpoints
		api.GET("/services", s.servicesHandler.GetServicesSSE)
		api.GET("/ingresses", s.ingressesHandler.GetIngressesSSE)
		api.GET("/endpoints", s.endpointsHandler.GetEndpointsSSE)

		// Networking detail endpoints
		api.GET("/services/:namespace/:name", s.servicesHandler.GetService)
		api.GET("/services/:namespace/:name/yaml", s.servicesHandler.GetServiceYAML)
		api.GET("/services/:namespace/:name/events", s.servicesHandler.GetServiceEvents)
		api.GET("/service/:name", s.servicesHandler.GetServiceByName)
		api.GET("/service/:name/yaml", s.servicesHandler.GetServiceYAMLByName)
		api.GET("/service/:name/events", s.servicesHandler.GetServiceEventsByName)

		api.GET("/ingresses/:namespace/:name", s.ingressesHandler.GetIngress)
		api.GET("/ingresses/:namespace/:name/yaml", s.ingressesHandler.GetIngressYAML)
		api.GET("/ingresses/:namespace/:name/events", s.ingressesHandler.GetIngressEvents)
		api.GET("/ingress/:name", s.ingressesHandler.GetIngressByName)
		api.GET("/ingress/:name/yaml", s.ingressesHandler.GetIngressYAMLByName)
		api.GET("/ingress/:name/events", s.ingressesHandler.GetIngressEventsByName)

		api.GET("/endpoints/:namespace/:name", s.endpointsHandler.GetEndpoint)
		api.GET("/endpoints/:namespace/:name/yaml", s.endpointsHandler.GetEndpointYAML)
		api.GET("/endpoints/:namespace/:name/events", s.endpointsHandler.GetEndpointEvents)
		api.GET("/endpoint/:name", s.endpointsHandler.GetEndpointByName)
		api.GET("/endpoint/:name/yaml", s.endpointsHandler.GetEndpointYAMLByName)
		api.GET("/endpoint/:name/events", s.endpointsHandler.GetEndpointEventsByName)

		// Storage SSE endpoints
		api.GET("/persistentvolumes", s.persistentVolumesHandler.GetPersistentVolumesSSE)
		api.GET("/persistentvolumeclaims", s.persistentVolumeClaimsHandler.GetPersistentVolumeClaimsSSE)
		api.GET("/storageclasses", s.storageClassesHandler.GetStorageClassesSSE)

		// Storage detail endpoints
		api.GET("/persistentvolumes/:name", s.persistentVolumesHandler.GetPersistentVolume)
		api.GET("/persistentvolumes/:name/yaml", s.persistentVolumesHandler.GetPersistentVolumeYAML)
		api.GET("/persistentvolumes/:name/events", s.persistentVolumesHandler.GetPersistentVolumeEvents)
		api.GET("/persistentvolume/:name", s.persistentVolumesHandler.GetPersistentVolumeByName)
		api.GET("/persistentvolume/:name/yaml", s.persistentVolumesHandler.GetPersistentVolumeYAMLByName)
		api.GET("/persistentvolume/:name/events", s.persistentVolumesHandler.GetPersistentVolumeEventsByName)

		api.GET("/persistentvolumeclaims/:namespace/:name", s.persistentVolumeClaimsHandler.GetPVC)
		api.GET("/persistentvolumeclaims/:namespace/:name/yaml", s.persistentVolumeClaimsHandler.GetPVCYAML)
		api.GET("/persistentvolumeclaims/:namespace/:name/events", s.persistentVolumeClaimsHandler.GetPVCEvents)
		api.GET("/persistentvolumeclaims/:namespace/:name/pods", s.persistentVolumeClaimsHandler.GetPVCPods)
		api.PATCH("/persistentvolumeclaims/:namespace/:name/scale", s.persistentVolumeClaimsHandler.ScalePVC)
		api.GET("/persistentvolumeclaim/:name", s.persistentVolumeClaimsHandler.GetPVCByName)
		api.GET("/persistentvolumeclaim/:name/yaml", s.persistentVolumeClaimsHandler.GetPVCYAMLByName)
		api.GET("/persistentvolumeclaim/:name/events", s.persistentVolumeClaimsHandler.GetPVCEventsByName)
		api.GET("/persistentvolumeclaim/:name/pods", s.persistentVolumeClaimsHandler.GetPVCPodsByName)

		api.GET("/storageclasses/:name", s.storageClassesHandler.GetStorageClass)
		api.GET("/storageclasses/:name/yaml", s.storageClassesHandler.GetStorageClassYAML)
		api.GET("/storageclasses/:name/events", s.storageClassesHandler.GetStorageClassEvents)
		api.GET("/storageclass/:name", s.storageClassesHandler.GetStorageClassByName)
		api.GET("/storageclass/:name/yaml", s.storageClassesHandler.GetStorageClassYAMLByName)
		api.GET("/storageclass/:name/events", s.storageClassesHandler.GetStorageClassEventsByName)

		// Helm endpoints
		api.GET("/helmreleases", s.helmHandler.GetHelmReleasesSSE)
		api.GET("/helmreleases/:name", s.helmHandler.GetHelmReleaseDetails)
		api.GET("/helmreleases/:name/history", s.helmHandler.GetHelmReleaseHistory)
		api.GET("/helmreleases/:name/resources", s.helmHandler.GetHelmReleaseResources)
		api.POST("/helmreleases/:name/rollback", s.helmHandler.RollbackHelmRelease)

		// Helm Charts endpoints
		api.GET("/helmcharts", s.helmHandler.SearchHelmCharts)
		api.GET("/helmcharts/:packageId", s.helmHandler.GetHelmChartDetails)
		api.GET("/helmcharts/:packageId/versions", s.helmHandler.GetHelmChartVersions)
		api.GET("/helmcharts/:packageId/:version/templates", s.helmHandler.GetHelmChartTemplates)
		api.POST("/helmcharts/install", s.helmHandler.InstallHelmChart)
		api.POST("/helmcharts/upgrade", s.helmHandler.UpgradeHelmChart)

		// Cloud Shell endpoints
		api.POST("/cloudshell", s.cloudShellHandler.CreateCloudShell)
		api.GET("/cloudshell", s.cloudShellHandler.ListCloudShellSessions)
		api.GET("/cloudshell/ws", s.cloudShellHandler.HandleCloudShellWebSocket)
		api.DELETE("/cloudshell/:name", s.cloudShellHandler.DeleteCloudShell)
		api.POST("/cloudshell/cleanup", s.cloudShellHandler.ManualCleanup)

		// Tracing endpoints
		if s.config.Tracing.Enabled {
			api.GET("/traces", s.tracingHandler.GetTraces)
			api.GET("/traces/:traceId", s.tracingHandler.GetTrace)
			api.GET("/traces/service-map", s.tracingHandler.GetServiceMap)
			api.GET("/traces/export", s.tracingHandler.ExportTraces)
			api.GET("/tracing/config", s.tracingHandler.GetTracingConfig)
			api.PUT("/tracing/config", s.tracingHandler.UpdateTracingConfig)
			api.GET("/tracing/stats", s.tracingHandler.GetTracingStats)
		}
	}

	// Swagger documentation endpoint
	s.router.GET("/swagger/*any", ginSwagger.WrapHandler(swaggerFiles.Handler))

	// Serve static files from the dist folder
	s.router.Static("/assets", s.config.StaticFiles.Path+"/assets")

	// Serve the main index.html for all other routes (SPA routing)
	s.router.NoRoute(s.serveSPA)
}

// healthCheck handles health check requests
// @Summary Health Check
// @Description Get the health status of the API
// @Tags System
// @Accept json
// @Produce json
// @Success 200 {object} map[string]interface{} "Health status"
// @Router /health [get]
func (s *Server) healthCheck(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{
		"status":    "healthy",
		"timestamp": time.Now().UTC().Format(time.RFC3339),
		"version":   "1.0.0",
	})
}

// apiInfo returns API information
// @Summary API Information
// @Description Get general information about the KubeDash API
// @Tags System
// @Accept json
// @Produce json
// @Success 200 {object} map[string]interface{} "API information"
// @Router /api/v1/ [get]
func (s *Server) apiInfo(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{
		"name":        "kube-dash API",
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

	// Skip Swagger documentation
	if len(path) >= 8 && path[:8] == "/swagger" {
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
	
	// Close database connection if using persistent storage
	if err := s.store.Close(); err != nil {
		s.logger.WithError(err).Warn("Failed to close database connection")
	}
	
	// Shutdown tracing service
	if s.config.Tracing.Enabled {
		if err := pkg_tracing.Shutdown(ctx); err != nil {
			s.logger.WithError(err).Warn("Failed to shutdown tracing service")
		}
	}
	
	return s.server.Shutdown(ctx)
}

// GetRouter returns the router for testing purposes
func (s *Server) GetRouter() *gin.Engine {
	return s.router
}
