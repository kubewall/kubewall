package routes

import (
	"embed"
	"github.com/kubewall/kubewall/backend/handlers/accesscontrol/clusterroles"
	clusterrolebindings "github.com/kubewall/kubewall/backend/handlers/accesscontrol/clusterrolesbindings"
	"github.com/kubewall/kubewall/backend/handlers/accesscontrol/roles"
	rolebindings "github.com/kubewall/kubewall/backend/handlers/accesscontrol/rolesbindings"
	"github.com/kubewall/kubewall/backend/handlers/accesscontrol/serviceaccounts"
	"github.com/kubewall/kubewall/backend/handlers/apply"
	"github.com/kubewall/kubewall/backend/handlers/base"
	horizontalpodautoscalers "github.com/kubewall/kubewall/backend/handlers/config/horizontalPodAutoscalers"
	"github.com/kubewall/kubewall/backend/handlers/config/leases"
	poddisruptionbudgets "github.com/kubewall/kubewall/backend/handlers/config/podDisruptionBudgets"
	priorityclasses "github.com/kubewall/kubewall/backend/handlers/config/priorityClasses"
	runtimeclasses "github.com/kubewall/kubewall/backend/handlers/config/runtimeClasses"
	"github.com/kubewall/kubewall/backend/handlers/config/secrets"
	"github.com/kubewall/kubewall/backend/handlers/crds/crds"
	"github.com/kubewall/kubewall/backend/handlers/crds/resources"
	"github.com/kubewall/kubewall/backend/handlers/network/endpoints"
	"github.com/kubewall/kubewall/backend/handlers/network/ingresses"
	"github.com/kubewall/kubewall/backend/handlers/network/services"
	"github.com/kubewall/kubewall/backend/handlers/nodes"
	"github.com/kubewall/kubewall/backend/handlers/storage/persistentvolumeclaims"
	"github.com/kubewall/kubewall/backend/handlers/storage/persistentvolumes"
	"github.com/kubewall/kubewall/backend/handlers/storage/storageclasses"
	cronjobs "github.com/kubewall/kubewall/backend/handlers/workloads/cronJobs"
	appmiddleware "github.com/kubewall/kubewall/backend/routes/middleware"
	"net/http"

	"github.com/kubewall/kubewall/backend/container"
	"github.com/kubewall/kubewall/backend/handlers/app"
	configmaps "github.com/kubewall/kubewall/backend/handlers/config/configMaps"
	limitranges "github.com/kubewall/kubewall/backend/handlers/config/limitRanges"
	resourcequotas "github.com/kubewall/kubewall/backend/handlers/config/resourceQuotas"
	"github.com/kubewall/kubewall/backend/handlers/namespaces"
	"github.com/kubewall/kubewall/backend/handlers/workloads/daemonsets"
	"github.com/kubewall/kubewall/backend/handlers/workloads/deployments"
	"github.com/kubewall/kubewall/backend/handlers/workloads/jobs"
	"github.com/kubewall/kubewall/backend/handlers/workloads/pods"
	"github.com/kubewall/kubewall/backend/handlers/workloads/replicaset"
	statefulset "github.com/kubewall/kubewall/backend/handlers/workloads/statefulsets"
	"github.com/labstack/echo/v4"
	"github.com/labstack/echo/v4/middleware"
)

//go:embed static/*
var embeddedFiles embed.FS

func ConfigureRoutes(e *echo.Echo, appContainer container.Container) {
	e.HideBanner = true
	setCORSConfig(e)

	e.Pre(middleware.RemoveTrailingSlash())
	e.Use(middleware.LoggerWithConfig(middleware.LoggerConfig{
		Format: "[${time_rfc3339}] ${status} ${method} ${uri} (${remote_ip}) ${error} ${latency_human}\n",
		Output: e.Logger.Output(),
	}))
	e.Use(middleware.Recover())
	e.Use(middleware.RequestID())
	e.Use(appmiddleware.ClusterQueryParamMiddleware(appContainer))
	e.Use(appmiddleware.CacheMiddleware(appContainer))
	e.Use(middleware.StaticWithConfig(middleware.StaticConfig{
		HTML5:      true,
		Root:       "static",
		Filesystem: http.FS(embeddedFiles),
	}))
	e.GET("/healthz", func(c echo.Context) error {
		return c.String(http.StatusOK, "OK")
	})

	e.POST("api/v1/app/apply", apply.NewApplyHandler(appContainer, apply.POSTApply))

	appConfig := app.NewAppConfigHandler(appContainer)
	e.GET("api/v1/app/config", appConfig.Get)
	e.POST("api/v1/app/config/kubeconfigs", appConfig.Post)
	e.POST("api/v1/app/config/kubeconfigs-bearer", appConfig.PostBearer)
	e.POST("api/v1/app/config/kubeconfigs-certificate", appConfig.PostCertificate)

	e.DELETE("api/v1/app/config/kubeconfigs/:uuid", appConfig.Delete)

	// Namespaces
	e.GET("api/v1/namespaces", namespaces.NewNamespacesRouteHandler(appContainer, base.GetList))
	e.GET("api/v1/namespaces/:name", namespaces.NewNamespacesRouteHandler(appContainer, base.GetDetails))
	e.GET("api/v1/namespaces/:name/yaml", namespaces.NewNamespacesRouteHandler(appContainer, base.GetYaml))
	e.GET("api/v1/namespaces/:name/events", namespaces.NewNamespacesRouteHandler(appContainer, base.GetEvents))
	e.DELETE("api/v1/namespaces", namespaces.NewNamespacesRouteHandler(appContainer, base.Delete))

	// Nodes
	e.GET("api/v1/nodes", nodes.NewNodeRouteHandler(appContainer, base.GetList))
	e.GET("api/v1/nodes/:name", nodes.NewNodeRouteHandler(appContainer, base.GetDetails))
	e.GET("api/v1/nodes/:name/yaml", nodes.NewNodeRouteHandler(appContainer, base.GetYaml))
	e.GET("api/v1/nodes/:name/events", nodes.NewNodeRouteHandler(appContainer, base.GetEvents))

	accessControlRoutes(e, appContainer)
	workloadRoutes(e, appContainer)
	configRoutes(e, appContainer)
	storageRoutes(e, appContainer)
	servicesRoutes(e, appContainer)
	customResources(e, appContainer)
}

func customResources(e *echo.Echo, appContainer container.Container) {
	e.GET("api/v1/customresourcedefinitions", crds.NewCRDHandler(appContainer, base.GetList))
	e.GET("api/v1/customresourcedefinitions/:name", crds.NewCRDHandler(appContainer, base.GetDetails))
	e.GET("api/v1/customresourcedefinitions/:name/yaml", crds.NewCRDHandler(appContainer, base.GetYaml))
	e.GET("api/v1/customresourcedefinitions/:name/events", crds.NewCRDHandler(appContainer, base.GetEvents))
	e.DELETE("api/v1/customresourcedefinitions", crds.NewCRDHandler(appContainer, base.Delete))

	e.GET("api/v1/customresources", resources.NewUnstructuredHandler(appContainer, base.GetList))
	e.DELETE("api/v1/customresources", resources.NewUnstructuredHandler(appContainer, base.Delete))

	// No namespace custom CRD's details and YAML
	e.GET("api/v1/customresources/:name", resources.NewUnstructuredHandler(appContainer, resources.GetDetails))
	e.GET("api/v1/customresources/:name/yaml", resources.NewUnstructuredHandler(appContainer, resources.GetYAML))

	// Namespace CRDS details and yaml
	e.GET("api/v1/customresources/:namespace/:name", resources.NewUnstructuredHandler(appContainer, resources.GetDetails))
	e.GET("api/v1/customresources/:namespace/:name/yaml", resources.NewUnstructuredHandler(appContainer, resources.GetYAML))
}

func servicesRoutes(e *echo.Echo, appContainer container.Container) {
	// Services
	e.GET("api/v1/services", services.NewServicesRouteHandler(appContainer, base.GetList))
	e.GET("api/v1/services/:name", services.NewServicesRouteHandler(appContainer, base.GetDetails))
	e.GET("api/v1/services/:name/yaml", services.NewServicesRouteHandler(appContainer, base.GetYaml))
	e.GET("api/v1/services/:name/events", services.NewServicesRouteHandler(appContainer, base.GetEvents))
	e.DELETE("api/v1/services", services.NewServicesRouteHandler(appContainer, base.Delete))

	// Endpoints
	e.GET("api/v1/endpoints", endpoints.NewEndpointsRouteHandler(appContainer, base.GetList))
	e.GET("api/v1/endpoints/:name", endpoints.NewEndpointsRouteHandler(appContainer, base.GetDetails))
	e.GET("api/v1/endpoints/:name/yaml", endpoints.NewEndpointsRouteHandler(appContainer, base.GetYaml))
	e.GET("api/v1/endpoints/:name/events", endpoints.NewEndpointsRouteHandler(appContainer, base.GetEvents))
	e.DELETE("api/v1/endpoints", endpoints.NewEndpointsRouteHandler(appContainer, base.Delete))

	// Ingresses
	e.GET("api/v1/ingresses", ingresses.NewIngressRouteHandler(appContainer, base.GetList))
	e.GET("api/v1/ingresses/:name", ingresses.NewIngressRouteHandler(appContainer, base.GetDetails))
	e.GET("api/v1/ingresses/:name/yaml", ingresses.NewIngressRouteHandler(appContainer, base.GetYaml))
	e.GET("api/v1/ingresses/:name/events", ingresses.NewIngressRouteHandler(appContainer, base.GetEvents))
	e.DELETE("api/v1/ingresses", ingresses.NewIngressRouteHandler(appContainer, base.Delete))
}

func storageRoutes(e *echo.Echo, appContainer container.Container) {
	// PV
	e.GET("api/v1/persistentvolumes", persistentvolumes.NewPersistentVolumeRouteHandler(appContainer, base.GetList))
	e.GET("api/v1/persistentvolumes/:name", persistentvolumes.NewPersistentVolumeRouteHandler(appContainer, base.GetDetails))
	e.GET("api/v1/persistentvolumes/:name/yaml", persistentvolumes.NewPersistentVolumeRouteHandler(appContainer, base.GetYaml))
	e.GET("api/v1/persistentvolumes/:name/events", persistentvolumes.NewPersistentVolumeRouteHandler(appContainer, base.GetEvents))
	e.DELETE("api/v1/persistentvolumes", persistentvolumes.NewPersistentVolumeRouteHandler(appContainer, base.Delete))

	// PVC
	e.GET("api/v1/persistentvolumeclaims", persistentvolumeclaims.NewPersistentVolumeClaimsRouteHandler(appContainer, base.GetList))
	e.GET("api/v1/persistentvolumeclaims/:name", persistentvolumeclaims.NewPersistentVolumeClaimsRouteHandler(appContainer, base.GetDetails))
	e.GET("api/v1/persistentvolumeclaims/:name/yaml", persistentvolumeclaims.NewPersistentVolumeClaimsRouteHandler(appContainer, base.GetYaml))
	e.GET("api/v1/persistentvolumeclaims/:name/events", persistentvolumeclaims.NewPersistentVolumeClaimsRouteHandler(appContainer, base.GetEvents))
	e.DELETE("api/v1/persistentvolumeclaims", persistentvolumeclaims.NewPersistentVolumeClaimsRouteHandler(appContainer, base.Delete))

	// Storage Class
	e.GET("api/v1/storageclasses", storageclasses.NewStorageClassRouteHandler(appContainer, base.GetList))
	e.GET("api/v1/storageclasses/:name", storageclasses.NewStorageClassRouteHandler(appContainer, base.GetDetails))
	e.GET("api/v1/storageclasses/:name/yaml", storageclasses.NewStorageClassRouteHandler(appContainer, base.GetYaml))
	e.GET("api/v1/storageclasses/:name/events", storageclasses.NewStorageClassRouteHandler(appContainer, base.GetEvents))
	e.DELETE("api/v1/storageclasses", storageclasses.NewStorageClassRouteHandler(appContainer, base.Delete))
}

func configRoutes(e *echo.Echo, appContainer container.Container) {
	// ConfigMaps
	e.GET("api/v1/configmaps", configmaps.NewConfigMapsRouteHandler(appContainer, base.GetList))
	e.GET("api/v1/configmaps/:name", configmaps.NewConfigMapsRouteHandler(appContainer, base.GetDetails))
	e.GET("api/v1/configmaps/:name/yaml", configmaps.NewConfigMapsRouteHandler(appContainer, base.GetYaml))
	e.GET("api/v1/configmaps/:name/events", configmaps.NewConfigMapsRouteHandler(appContainer, base.GetEvents))
	e.DELETE("api/v1/configmaps", configmaps.NewConfigMapsRouteHandler(appContainer, base.Delete))

	// Secrets
	e.GET("api/v1/secrets", secrets.NewSecretsRouteHandler(appContainer, base.GetList))
	e.GET("api/v1/secrets/:name", secrets.NewSecretsRouteHandler(appContainer, base.GetDetails))
	e.GET("api/v1/secrets/:name/yaml", secrets.NewSecretsRouteHandler(appContainer, base.GetYaml))
	e.GET("api/v1/secrets/:name/events", secrets.NewSecretsRouteHandler(appContainer, base.GetEvents))
	e.DELETE("api/v1/secrets", secrets.NewSecretsRouteHandler(appContainer, base.Delete))

	// ResourceQuotas
	e.GET("api/v1/resourcequotas", resourcequotas.NewResourceQuotaRouteHandler(appContainer, base.GetList))
	e.GET("api/v1/resourcequotas/:name", resourcequotas.NewResourceQuotaRouteHandler(appContainer, base.GetDetails))
	e.GET("api/v1/resourcequotas/:name/yaml", resourcequotas.NewResourceQuotaRouteHandler(appContainer, base.GetYaml))
	e.GET("api/v1/resourcequotas/:name/events", resourcequotas.NewResourceQuotaRouteHandler(appContainer, base.GetEvents))
	e.DELETE("api/v1/resourcequotas", resourcequotas.NewResourceQuotaRouteHandler(appContainer, base.Delete))

	// LimitRanges
	e.GET("api/v1/limitranges", limitranges.NewLimitRangesRouteHandler(appContainer, base.GetList))
	e.GET("api/v1/limitranges/:name", limitranges.NewLimitRangesRouteHandler(appContainer, base.GetDetails))
	e.GET("api/v1/limitranges/:name/yaml", limitranges.NewLimitRangesRouteHandler(appContainer, base.GetYaml))
	e.GET("api/v1/limitranges/:name/events", limitranges.NewLimitRangesRouteHandler(appContainer, base.GetEvents))
	e.DELETE("api/v1/limitranges", limitranges.NewLimitRangesRouteHandler(appContainer, base.Delete))

	// HAP
	e.GET("api/v1/horizontalpodautoscalers", horizontalpodautoscalers.NewHorizontalPodAutoscalersRouteHandler(appContainer, base.GetList))
	e.GET("api/v1/horizontalpodautoscalers/:name", horizontalpodautoscalers.NewHorizontalPodAutoscalersRouteHandler(appContainer, base.GetDetails))
	e.GET("api/v1/horizontalpodautoscalers/:name/yaml", horizontalpodautoscalers.NewHorizontalPodAutoscalersRouteHandler(appContainer, base.GetYaml))
	e.GET("api/v1/horizontalpodautoscalers/:name/events", horizontalpodautoscalers.NewHorizontalPodAutoscalersRouteHandler(appContainer, base.GetEvents))
	e.DELETE("api/v1/horizontalpodautoscalers", horizontalpodautoscalers.NewHorizontalPodAutoscalersRouteHandler(appContainer, base.Delete))

	// LimitRanges
	e.GET("api/v1/poddisruptionbudgets", poddisruptionbudgets.NewPodDisruptionBudgetRouteHandler(appContainer, base.GetList))
	e.GET("api/v1/poddisruptionbudgets/:name", poddisruptionbudgets.NewPodDisruptionBudgetRouteHandler(appContainer, base.GetDetails))
	e.GET("api/v1/poddisruptionbudgets/:name/yaml", poddisruptionbudgets.NewPodDisruptionBudgetRouteHandler(appContainer, base.GetYaml))
	e.GET("api/v1/poddisruptionbudgets/:name/events", poddisruptionbudgets.NewPodDisruptionBudgetRouteHandler(appContainer, base.GetEvents))
	e.DELETE("api/v1/poddisruptionbudgets", poddisruptionbudgets.NewPodDisruptionBudgetRouteHandler(appContainer, base.Delete))

	// priorityclasses
	e.GET("api/v1/priorityclasses", priorityclasses.NewPriorityClassRouteHandler(appContainer, base.GetList))
	e.GET("api/v1/priorityclasses/:name", priorityclasses.NewPriorityClassRouteHandler(appContainer, base.GetDetails))
	e.GET("api/v1/priorityclasses/:name/yaml", priorityclasses.NewPriorityClassRouteHandler(appContainer, base.GetYaml))
	e.GET("api/v1/priorityclasses/:name/events", priorityclasses.NewPriorityClassRouteHandler(appContainer, base.GetEvents))
	e.DELETE("api/v1/priorityclasses", priorityclasses.NewPriorityClassRouteHandler(appContainer, base.Delete))

	// runtimeclasses
	e.GET("api/v1/runtimeclasses", runtimeclasses.NewRunTimeClassRouteHandler(appContainer, base.GetList))
	e.GET("api/v1/runtimeclasses/:name", runtimeclasses.NewRunTimeClassRouteHandler(appContainer, base.GetDetails))
	e.GET("api/v1/runtimeclasses/:name/yaml", runtimeclasses.NewRunTimeClassRouteHandler(appContainer, base.GetYaml))
	e.GET("api/v1/runtimeclasses/:name/events", runtimeclasses.NewRunTimeClassRouteHandler(appContainer, base.GetEvents))
	e.DELETE("api/v1/runtimeclasses", runtimeclasses.NewRunTimeClassRouteHandler(appContainer, base.Delete))

	// leases
	e.GET("api/v1/leases", leases.NewLeaseRouteHandler(appContainer, base.GetList))
	e.GET("api/v1/leases/:name", leases.NewLeaseRouteHandler(appContainer, base.GetDetails))
	e.GET("api/v1/leases/:name/yaml", leases.NewLeaseRouteHandler(appContainer, base.GetYaml))
	e.GET("api/v1/leases/:name/events", leases.NewLeaseRouteHandler(appContainer, base.GetEvents))
	e.DELETE("api/v1/leases", leases.NewLeaseRouteHandler(appContainer, base.Delete))
}

func workloadRoutes(e *echo.Echo, appContainer container.Container) {
	// Pods
	e.GET("api/v1/pods", pods.NewPodsRouteHandler(appContainer, base.GetList))
	e.GET("api/v1/pods/:name", pods.NewPodsRouteHandler(appContainer, base.GetDetails))
	e.GET("api/v1/pods/:name/yaml", pods.NewPodsRouteHandler(appContainer, base.GetYaml))
	e.GET("api/v1/pods/:name/logs", pods.NewPodsRouteHandler(appContainer, base.GetLogs))
	e.GET("api/v1/pods/:name/logsWS", pods.NewPodsRouteHandler(appContainer, base.GetLogsWS))
	e.GET("api/v1/pods/:name/events", pods.NewPodsRouteHandler(appContainer, base.GetEvents))
	e.DELETE("api/v1/pods", pods.NewPodsRouteHandler(appContainer, base.Delete))

	// Deployments
	e.GET("api/v1/deployments", deployments.NewDeploymentRouteHandler(appContainer, base.GetList))
	e.GET("api/v1/deployments/:name", deployments.NewDeploymentRouteHandler(appContainer, base.GetDetails))
	e.GET("api/v1/deployments/:name/yaml", deployments.NewDeploymentRouteHandler(appContainer, base.GetYaml))
	e.GET("api/v1/deployments/:name/events", deployments.NewDeploymentRouteHandler(appContainer, base.GetEvents))
	e.GET("api/v1/deployments/:name/pods", deployments.NewDeploymentRouteHandler(appContainer, deployments.GetPods))
	e.DELETE("api/v1/deployments", deployments.NewDeploymentRouteHandler(appContainer, base.Delete))

	// Daemonsets
	e.GET("api/v1/daemonsets", daemonsets.NewDaemonSetsRouteHandler(appContainer, base.GetList))
	e.GET("api/v1/daemonsets/:name", daemonsets.NewDaemonSetsRouteHandler(appContainer, base.GetDetails))
	e.GET("api/v1/daemonsets/:name/yaml", daemonsets.NewDaemonSetsRouteHandler(appContainer, base.GetYaml))
	e.GET("api/v1/daemonsets/:name/events", daemonsets.NewDaemonSetsRouteHandler(appContainer, base.GetEvents))
	e.DELETE("api/v1/daemonsets", daemonsets.NewDaemonSetsRouteHandler(appContainer, base.Delete))

	// ReplicaSets
	e.GET("api/v1/replicasets", replicaset.NewReplicaSetRouteHandler(appContainer, base.GetList))
	e.GET("api/v1/replicasets/:name", replicaset.NewReplicaSetRouteHandler(appContainer, base.GetDetails))
	e.GET("api/v1/replicasets/:name/yaml", replicaset.NewReplicaSetRouteHandler(appContainer, base.GetYaml))
	e.GET("api/v1/replicasets/:name/events", replicaset.NewReplicaSetRouteHandler(appContainer, base.GetEvents))
	e.DELETE("api/v1/replicasets", replicaset.NewReplicaSetRouteHandler(appContainer, base.Delete))

	// StatefulSets
	e.GET("api/v1/statefulsets", statefulset.NewStatefulSetRouteHandler(appContainer, base.GetList))
	e.GET("api/v1/statefulsets/:name", statefulset.NewStatefulSetRouteHandler(appContainer, base.GetDetails))
	e.GET("api/v1/statefulsets/:name/yaml", statefulset.NewStatefulSetRouteHandler(appContainer, base.GetYaml))
	e.GET("api/v1/statefulsets/:name/events", statefulset.NewStatefulSetRouteHandler(appContainer, base.GetEvents))
	e.DELETE("api/v1/statefulsets", statefulset.NewStatefulSetRouteHandler(appContainer, base.Delete))

	// Jobs
	e.GET("api/v1/jobs", jobs.NewJobsRouteHandler(appContainer, base.GetList))
	e.GET("api/v1/jobs/:name", jobs.NewJobsRouteHandler(appContainer, base.GetDetails))
	e.GET("api/v1/jobs/:name/yaml", jobs.NewJobsRouteHandler(appContainer, base.GetYaml))
	e.GET("api/v1/jobs/:name/events", jobs.NewJobsRouteHandler(appContainer, base.GetEvents))
	e.DELETE("api/v1/jobs", jobs.NewJobsRouteHandler(appContainer, base.Delete))

	// CronJobs
	e.GET("api/v1/cronjobs", cronjobs.NewCronJobsRouteHandler(appContainer, base.GetList))
	e.GET("api/v1/cronjobs/:name", cronjobs.NewCronJobsRouteHandler(appContainer, base.GetDetails))
	e.GET("api/v1/cronjobs/:name/yaml", cronjobs.NewCronJobsRouteHandler(appContainer, base.GetYaml))
	e.GET("api/v1/cronjobs/:name/events", cronjobs.NewCronJobsRouteHandler(appContainer, base.GetEvents))
	e.DELETE("api/v1/cronjobs", cronjobs.NewCronJobsRouteHandler(appContainer, base.Delete))
}

func accessControlRoutes(e *echo.Echo, appContainer container.Container) {
	e.GET("api/v1/serviceaccounts", serviceaccounts.NewServiceAccountsRouteHandler(appContainer, base.GetList))
	e.GET("api/v1/serviceaccounts/:name", serviceaccounts.NewServiceAccountsRouteHandler(appContainer, base.GetDetails))
	e.GET("api/v1/serviceaccounts/:name/yaml", serviceaccounts.NewServiceAccountsRouteHandler(appContainer, base.GetYaml))
	e.GET("api/v1/serviceaccounts/:name/events", serviceaccounts.NewServiceAccountsRouteHandler(appContainer, base.GetEvents))
	e.DELETE("api/v1/serviceaccounts", serviceaccounts.NewServiceAccountsRouteHandler(appContainer, base.Delete))

	// Roles
	e.GET("api/v1/roles", roles.NewRoleRouteHandler(appContainer, base.GetList))
	e.GET("api/v1/roles/:name", roles.NewRoleRouteHandler(appContainer, base.GetDetails))
	e.GET("api/v1/roles/:name/yaml", roles.NewRoleRouteHandler(appContainer, base.GetYaml))
	e.GET("api/v1/roles/:name/events", roles.NewRoleRouteHandler(appContainer, base.GetEvents))
	e.DELETE("api/v1/roles", roles.NewRoleRouteHandler(appContainer, base.Delete))

	// Role Bindings
	e.GET("api/v1/rolebindings", rolebindings.NewRoleBindingsRouteHandler(appContainer, base.GetList))
	e.GET("api/v1/rolebindings/:name", rolebindings.NewRoleBindingsRouteHandler(appContainer, base.GetDetails))
	e.GET("api/v1/rolebindings/:name/yaml", rolebindings.NewRoleBindingsRouteHandler(appContainer, base.GetYaml))
	e.GET("api/v1/rolebindings/:name/events", rolebindings.NewRoleBindingsRouteHandler(appContainer, base.GetEvents))
	e.DELETE("api/v1/rolebindings", rolebindings.NewRoleBindingsRouteHandler(appContainer, base.Delete))

	// Cluster Roles
	e.GET("api/v1/clusterroles", clusterroles.NewClusterRoleRouteHandler(appContainer, base.GetList))
	e.GET("api/v1/clusterroles/:name", clusterroles.NewClusterRoleRouteHandler(appContainer, base.GetDetails))
	e.GET("api/v1/clusterroles/:name/yaml", clusterroles.NewClusterRoleRouteHandler(appContainer, base.GetYaml))
	e.GET("api/v1/clusterroles/:name/events", clusterroles.NewClusterRoleRouteHandler(appContainer, base.GetEvents))
	e.DELETE("api/v1/clusterroles", clusterroles.NewClusterRoleRouteHandler(appContainer, base.Delete))

	// Cluster Role Bindings
	e.GET("api/v1/clusterrolebindings", clusterrolebindings.NewClusterRoleBindingsRouteHandler(appContainer, base.GetList))
	e.GET("api/v1/clusterrolebindings/:name", clusterrolebindings.NewClusterRoleBindingsRouteHandler(appContainer, base.GetDetails))
	e.GET("api/v1/clusterrolebindings/:name/yaml", clusterrolebindings.NewClusterRoleBindingsRouteHandler(appContainer, base.GetYaml))
	e.GET("api/v1/clusterrolebindings/:name/events", clusterrolebindings.NewClusterRoleBindingsRouteHandler(appContainer, base.GetEvents))
	e.DELETE("api/v1/clusterrolebindings", clusterrolebindings.NewClusterRoleBindingsRouteHandler(appContainer, base.Delete))
}

func setCORSConfig(e *echo.Echo) {
	e.Use(middleware.CORSWithConfig(middleware.CORSConfig{
		AllowCredentials:                         true,
		UnsafeWildcardOriginWithAllowCredentials: true,
		AllowOrigins:                             []string{"*"},
		AllowHeaders:                             []string{echo.HeaderOrigin, echo.HeaderContentType, echo.HeaderAccept, echo.HeaderAuthorization, echo.HeaderUpgrade, echo.HeaderAcceptEncoding, echo.HeaderConnection},
		AllowMethods:                             []string{http.MethodGet, http.MethodHead, http.MethodPut, http.MethodPatch, http.MethodPost, http.MethodDelete},
		MaxAge:                                   86400,
	}))
}
