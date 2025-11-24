package routes

import (
	"embed"
	"net/http"

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
	"github.com/kubewall/kubewall/backend/handlers/events"
	"github.com/kubewall/kubewall/backend/handlers/mcp"
	"github.com/kubewall/kubewall/backend/handlers/network/endpoints"
	"github.com/kubewall/kubewall/backend/handlers/network/ingresses"
	"github.com/kubewall/kubewall/backend/handlers/network/services"
	"github.com/kubewall/kubewall/backend/handlers/nodes"
	"github.com/kubewall/kubewall/backend/handlers/portforward"
	"github.com/kubewall/kubewall/backend/handlers/storage/persistentvolumeclaims"
	"github.com/kubewall/kubewall/backend/handlers/storage/persistentvolumes"
	"github.com/kubewall/kubewall/backend/handlers/storage/storageclasses"
	cronjobs "github.com/kubewall/kubewall/backend/handlers/workloads/cronJobs"
	appmiddleware "github.com/kubewall/kubewall/backend/routes/middleware"

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
	e.Use(appmiddleware.ClusterConnectivityMiddleware(appContainer))
	e.Use(appmiddleware.ClusterCacheMiddleware(appContainer))
	e.Use(appmiddleware.DisableUnusedMethods(appContainer))
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
	e.GET("api/v1/app/config/reload", appConfig.Reload)

	e.DELETE("api/v1/app/config/kubeconfigs/:uuid", appConfig.Delete)

	// Namespaces
	e.GET("api/v1/namespaces", namespaces.NewNamespacesRouteHandler(appContainer, base.GetList)).Name = "namespacesList"
	e.GET("api/v1/namespaces/:name", namespaces.NewNamespacesRouteHandler(appContainer, base.GetDetails)).Name = "namespacesDetails"
	e.GET("api/v1/namespaces/:name/yaml", namespaces.NewNamespacesRouteHandler(appContainer, base.GetYaml)).Name = "namespacesYaml"
	e.GET("api/v1/namespaces/:name/events", namespaces.NewNamespacesRouteHandler(appContainer, base.GetEvents)).Name = "namespacesEvents"
	e.DELETE("api/v1/namespaces", namespaces.NewNamespacesRouteHandler(appContainer, base.Delete)).Name = "namespacesDelete"

	// Nodes
	e.GET("api/v1/nodes", nodes.NewNodeRouteHandler(appContainer, base.GetList)).Name = "nodesList"
	e.GET("api/v1/nodes/:name", nodes.NewNodeRouteHandler(appContainer, base.GetDetails)).Name = "nodesDetails"
	e.GET("api/v1/nodes/:name/yaml", nodes.NewNodeRouteHandler(appContainer, base.GetYaml)).Name = "nodesYaml"
	e.GET("api/v1/nodes/:name/events", nodes.NewNodeRouteHandler(appContainer, base.GetEvents)).Name = "nodesEvents"
	e.GET("api/v1/nodes/:name/pods", nodes.NewNodeRouteHandler(appContainer, deployments.GetPods)).Name = "nodePods"

	e.GET("api/v1/events", events.NewEventsRouteHandler(appContainer, base.GetList)).Name = "eventsList"
	e.DELETE("api/v1/events", events.NewEventsRouteHandler(appContainer, base.Delete)).Name = "eventsDelete"

	e.GET("api/v1/portforwards", portforward.NewPortForwardingHandler(appContainer, base.GetList))
	e.POST("api/v1/portforwards", portforward.NewPortForwardingHandler(appContainer, base.Create))
	e.DELETE("api/v1/portforwards", portforward.NewPortForwardingHandler(appContainer, base.Delete))

	accessControlRoutes(e, appContainer)
	workloadRoutes(e, appContainer)
	configRoutes(e, appContainer)
	storageRoutes(e, appContainer)
	servicesRoutes(e, appContainer)
	customResources(e, appContainer)
	mcp.Server(e, appContainer)
}

func customResources(e *echo.Echo, appContainer container.Container) {
	e.GET("api/v1/customresourcedefinitions", crds.NewCRDRouteHandler(appContainer, base.GetList))
	e.GET("api/v1/customresourcedefinitions/:name", crds.NewCRDRouteHandler(appContainer, base.GetDetails))
	e.GET("api/v1/customresourcedefinitions/:name/yaml", crds.NewCRDRouteHandler(appContainer, base.GetYaml))
	e.GET("api/v1/customresourcedefinitions/:name/events", crds.NewCRDRouteHandler(appContainer, base.GetEvents))
	e.DELETE("api/v1/customresourcedefinitions", crds.NewCRDRouteHandler(appContainer, base.Delete))

	e.GET("api/v1/customresources", resources.NewUnstructuredRouteHandler(appContainer, base.GetList))
	e.DELETE("api/v1/customresources", resources.NewUnstructuredRouteHandler(appContainer, base.Delete))

	// No namespace custom CRD's details and YAML
	e.GET("api/v1/customresources/:name", resources.NewUnstructuredRouteHandler(appContainer, resources.GetDetails))
	e.GET("api/v1/customresources/:name/yaml", resources.NewUnstructuredRouteHandler(appContainer, resources.GetYAML))

	// Namespace CRDS details and yaml
	e.GET("api/v1/customresources/:namespace/:name", resources.NewUnstructuredRouteHandler(appContainer, resources.GetDetails))
	e.GET("api/v1/customresources/:namespace/:name/yaml", resources.NewUnstructuredRouteHandler(appContainer, resources.GetYAML))
}

func servicesRoutes(e *echo.Echo, appContainer container.Container) {
	// Services
	e.GET("api/v1/services", services.NewServicesRouteHandler(appContainer, base.GetList)).Name = "servicesList"
	e.GET("api/v1/services/:name", services.NewServicesRouteHandler(appContainer, base.GetDetails)).Name = "servicesDetails"
	e.GET("api/v1/services/:name/yaml", services.NewServicesRouteHandler(appContainer, base.GetYaml)).Name = "servicesYaml"
	e.GET("api/v1/services/:name/events", services.NewServicesRouteHandler(appContainer, base.GetEvents)).Name = "servicesEvents"
	e.DELETE("api/v1/services", services.NewServicesRouteHandler(appContainer, base.Delete)).Name = "servicesDelete"

	// Endpoints
	e.GET("api/v1/endpoints", endpoints.NewEndpointsRouteHandler(appContainer, base.GetList)).Name = "endpointsList"
	e.GET("api/v1/endpoints/:name", endpoints.NewEndpointsRouteHandler(appContainer, base.GetDetails)).Name = "endpointsDetails"
	e.GET("api/v1/endpoints/:name/yaml", endpoints.NewEndpointsRouteHandler(appContainer, base.GetYaml)).Name = "endpointsYaml"
	e.GET("api/v1/endpoints/:name/events", endpoints.NewEndpointsRouteHandler(appContainer, base.GetEvents)).Name = "endpointsEvents"
	e.DELETE("api/v1/endpoints", endpoints.NewEndpointsRouteHandler(appContainer, base.Delete)).Name = "endpointsDelete"

	// Ingresses
	e.GET("api/v1/ingresses", ingresses.NewIngressRouteHandler(appContainer, base.GetList)).Name = "ingressesList"
	e.GET("api/v1/ingresses/:name", ingresses.NewIngressRouteHandler(appContainer, base.GetDetails)).Name = "ingressesDetails"
	e.GET("api/v1/ingresses/:name/yaml", ingresses.NewIngressRouteHandler(appContainer, base.GetYaml)).Name = "ingressesYaml"
	e.GET("api/v1/ingresses/:name/events", ingresses.NewIngressRouteHandler(appContainer, base.GetEvents)).Name = "ingressesEvents"
	e.DELETE("api/v1/ingresses", ingresses.NewIngressRouteHandler(appContainer, base.Delete)).Name = "ingressesDelete"
}

func storageRoutes(e *echo.Echo, appContainer container.Container) {
	// PersistentVolumes (PV)
	e.GET("api/v1/persistentvolumes", persistentvolumes.NewPersistentVolumeRouteHandler(appContainer, base.GetList)).Name = "persistentvolumesList"
	e.GET("api/v1/persistentvolumes/:name", persistentvolumes.NewPersistentVolumeRouteHandler(appContainer, base.GetDetails)).Name = "persistentvolumesDetails"
	e.GET("api/v1/persistentvolumes/:name/yaml", persistentvolumes.NewPersistentVolumeRouteHandler(appContainer, base.GetYaml)).Name = "persistentvolumesYaml"
	e.GET("api/v1/persistentvolumes/:name/events", persistentvolumes.NewPersistentVolumeRouteHandler(appContainer, base.GetEvents)).Name = "persistentvolumesEvents"
	e.DELETE("api/v1/persistentvolumes", persistentvolumes.NewPersistentVolumeRouteHandler(appContainer, base.Delete)).Name = "persistentvolumesDelete"

	// PersistentVolumeClaims (PVC)
	e.GET("api/v1/persistentvolumeclaims", persistentvolumeclaims.NewPersistentVolumeClaimsRouteHandler(appContainer, base.GetList)).Name = "persistentvolumeclaimsList"
	e.GET("api/v1/persistentvolumeclaims/:name", persistentvolumeclaims.NewPersistentVolumeClaimsRouteHandler(appContainer, base.GetDetails)).Name = "persistentvolumeclaimsDetails"
	e.GET("api/v1/persistentvolumeclaims/:name/yaml", persistentvolumeclaims.NewPersistentVolumeClaimsRouteHandler(appContainer, base.GetYaml)).Name = "persistentvolumeclaimsYaml"
	e.GET("api/v1/persistentvolumeclaims/:name/events", persistentvolumeclaims.NewPersistentVolumeClaimsRouteHandler(appContainer, base.GetEvents)).Name = "persistentvolumeclaimsEvents"
	e.DELETE("api/v1/persistentvolumeclaims", persistentvolumeclaims.NewPersistentVolumeClaimsRouteHandler(appContainer, base.Delete)).Name = "persistentvolumeclaimsDelete"

	// StorageClasses
	e.GET("api/v1/storageclasses", storageclasses.NewStorageClassRouteHandler(appContainer, base.GetList)).Name = "storageclassesList"
	e.GET("api/v1/storageclasses/:name", storageclasses.NewStorageClassRouteHandler(appContainer, base.GetDetails)).Name = "storageclassesDetails"
	e.GET("api/v1/storageclasses/:name/yaml", storageclasses.NewStorageClassRouteHandler(appContainer, base.GetYaml)).Name = "storageclassesYaml"
	e.GET("api/v1/storageclasses/:name/events", storageclasses.NewStorageClassRouteHandler(appContainer, base.GetEvents)).Name = "storageclassesEvents"
	e.DELETE("api/v1/storageclasses", storageclasses.NewStorageClassRouteHandler(appContainer, base.Delete)).Name = "storageclassesDelete"
}

func configRoutes(e *echo.Echo, appContainer container.Container) {
	// ConfigMaps
	e.GET("api/v1/configmaps", configmaps.NewConfigMapsRouteHandler(appContainer, base.GetList)).Name = "configmapsList"
	e.GET("api/v1/configmaps/:name", configmaps.NewConfigMapsRouteHandler(appContainer, base.GetDetails)).Name = "configmapsDetails"
	e.GET("api/v1/configmaps/:name/yaml", configmaps.NewConfigMapsRouteHandler(appContainer, base.GetYaml)).Name = "configmapsYaml"
	e.GET("api/v1/configmaps/:name/events", configmaps.NewConfigMapsRouteHandler(appContainer, base.GetEvents)).Name = "configmapsEvents"
	e.DELETE("api/v1/configmaps", configmaps.NewConfigMapsRouteHandler(appContainer, base.Delete)).Name = "configmapsDelete"

	// Secrets
	e.GET("api/v1/secrets", secrets.NewSecretsRouteHandler(appContainer, base.GetList)).Name = "secretsList"
	e.GET("api/v1/secrets/:name", secrets.NewSecretsRouteHandler(appContainer, base.GetDetails)).Name = "secretsDetails"
	e.GET("api/v1/secrets/:name/yaml", secrets.NewSecretsRouteHandler(appContainer, base.GetYaml)).Name = "secretsYaml"
	e.GET("api/v1/secrets/:name/events", secrets.NewSecretsRouteHandler(appContainer, base.GetEvents)).Name = "secretsEvents"
	e.DELETE("api/v1/secrets", secrets.NewSecretsRouteHandler(appContainer, base.Delete)).Name = "secretsDelete"

	// ResourceQuotas
	e.GET("api/v1/resourcequotas", resourcequotas.NewResourceQuotaRouteHandler(appContainer, base.GetList)).Name = "resourcequotasList"
	e.GET("api/v1/resourcequotas/:name", resourcequotas.NewResourceQuotaRouteHandler(appContainer, base.GetDetails)).Name = "resourcequotasDetails"
	e.GET("api/v1/resourcequotas/:name/yaml", resourcequotas.NewResourceQuotaRouteHandler(appContainer, base.GetYaml)).Name = "resourcequotasYaml"
	e.GET("api/v1/resourcequotas/:name/events", resourcequotas.NewResourceQuotaRouteHandler(appContainer, base.GetEvents)).Name = "resourcequotasEvents"
	e.DELETE("api/v1/resourcequotas", resourcequotas.NewResourceQuotaRouteHandler(appContainer, base.Delete)).Name = "resourcequotasDelete"

	// LimitRanges
	e.GET("api/v1/limitranges", limitranges.NewLimitRangesRouteHandler(appContainer, base.GetList)).Name = "limitrangesList"
	e.GET("api/v1/limitranges/:name", limitranges.NewLimitRangesRouteHandler(appContainer, base.GetDetails)).Name = "limitrangesDetails"
	e.GET("api/v1/limitranges/:name/yaml", limitranges.NewLimitRangesRouteHandler(appContainer, base.GetYaml)).Name = "limitrangesYaml"
	e.GET("api/v1/limitranges/:name/events", limitranges.NewLimitRangesRouteHandler(appContainer, base.GetEvents)).Name = "limitrangesEvents"
	e.DELETE("api/v1/limitranges", limitranges.NewLimitRangesRouteHandler(appContainer, base.Delete)).Name = "limitrangesDelete"

	// HorizontalPodAutoscalers (HPA)
	e.GET("api/v1/horizontalpodautoscalers", horizontalpodautoscalers.NewHorizontalPodAutoscalersRouteHandler(appContainer, base.GetList)).Name = "horizontalpodautoscalersList"
	e.GET("api/v1/horizontalpodautoscalers/:name", horizontalpodautoscalers.NewHorizontalPodAutoscalersRouteHandler(appContainer, base.GetDetails)).Name = "horizontalpodautoscalersDetails"
	e.GET("api/v1/horizontalpodautoscalers/:name/yaml", horizontalpodautoscalers.NewHorizontalPodAutoscalersRouteHandler(appContainer, base.GetYaml)).Name = "horizontalpodautoscalersYaml"
	e.GET("api/v1/horizontalpodautoscalers/:name/events", horizontalpodautoscalers.NewHorizontalPodAutoscalersRouteHandler(appContainer, base.GetEvents)).Name = "horizontalpodautoscalersEvents"
	e.DELETE("api/v1/horizontalpodautoscalers", horizontalpodautoscalers.NewHorizontalPodAutoscalersRouteHandler(appContainer, base.Delete)).Name = "horizontalpodautoscalersDelete"

	// PodDisruptionBudgets (PDB)
	e.GET("api/v1/poddisruptionbudgets", poddisruptionbudgets.NewPodDisruptionBudgetRouteHandler(appContainer, base.GetList)).Name = "poddisruptionbudgetsList"
	e.GET("api/v1/poddisruptionbudgets/:name", poddisruptionbudgets.NewPodDisruptionBudgetRouteHandler(appContainer, base.GetDetails)).Name = "poddisruptionbudgetsDetails"
	e.GET("api/v1/poddisruptionbudgets/:name/yaml", poddisruptionbudgets.NewPodDisruptionBudgetRouteHandler(appContainer, base.GetYaml)).Name = "poddisruptionbudgetsYaml"
	e.GET("api/v1/poddisruptionbudgets/:name/events", poddisruptionbudgets.NewPodDisruptionBudgetRouteHandler(appContainer, base.GetEvents)).Name = "poddisruptionbudgetsEvents"
	e.DELETE("api/v1/poddisruptionbudgets", poddisruptionbudgets.NewPodDisruptionBudgetRouteHandler(appContainer, base.Delete)).Name = "poddisruptionbudgetsDelete"

	// PriorityClasses
	e.GET("api/v1/priorityclasses", priorityclasses.NewPriorityClassRouteHandler(appContainer, base.GetList)).Name = "priorityclassesList"
	e.GET("api/v1/priorityclasses/:name", priorityclasses.NewPriorityClassRouteHandler(appContainer, base.GetDetails)).Name = "priorityclassesDetails"
	e.GET("api/v1/priorityclasses/:name/yaml", priorityclasses.NewPriorityClassRouteHandler(appContainer, base.GetYaml)).Name = "priorityclassesYaml"
	e.GET("api/v1/priorityclasses/:name/events", priorityclasses.NewPriorityClassRouteHandler(appContainer, base.GetEvents)).Name = "priorityclassesEvents"
	e.DELETE("api/v1/priorityclasses", priorityclasses.NewPriorityClassRouteHandler(appContainer, base.Delete)).Name = "priorityclassesDelete"

	// RuntimeClasses
	e.GET("api/v1/runtimeclasses", runtimeclasses.NewRunTimeClassRouteHandler(appContainer, base.GetList)).Name = "runtimeclassesList"
	e.GET("api/v1/runtimeclasses/:name", runtimeclasses.NewRunTimeClassRouteHandler(appContainer, base.GetDetails)).Name = "runtimeclassesDetails"
	e.GET("api/v1/runtimeclasses/:name/yaml", runtimeclasses.NewRunTimeClassRouteHandler(appContainer, base.GetYaml)).Name = "runtimeclassesYaml"
	e.GET("api/v1/runtimeclasses/:name/events", runtimeclasses.NewRunTimeClassRouteHandler(appContainer, base.GetEvents)).Name = "runtimeclassesEvents"
	e.DELETE("api/v1/runtimeclasses", runtimeclasses.NewRunTimeClassRouteHandler(appContainer, base.Delete)).Name = "runtimeclassesDelete"

	// Leases
	e.GET("api/v1/leases", leases.NewLeaseRouteHandler(appContainer, base.GetList)).Name = "leasesList"
	e.GET("api/v1/leases/:name", leases.NewLeaseRouteHandler(appContainer, base.GetDetails)).Name = "leasesDetails"
	e.GET("api/v1/leases/:name/yaml", leases.NewLeaseRouteHandler(appContainer, base.GetYaml)).Name = "leasesYaml"
	e.GET("api/v1/leases/:name/events", leases.NewLeaseRouteHandler(appContainer, base.GetEvents)).Name = "leasesEvents"
	e.DELETE("api/v1/leases", leases.NewLeaseRouteHandler(appContainer, base.Delete)).Name = "leasesDelete"
}

func workloadRoutes(e *echo.Echo, appContainer container.Container) {
	// Pods
	e.GET("api/v1/pods", pods.NewPodsRouteHandler(appContainer, base.GetList)).Name = "podsList"
	e.GET("api/v1/pods/:name", pods.NewPodsRouteHandler(appContainer, base.GetDetails)).Name = "podsDetails"
	e.GET("api/v1/pods/:name/yaml", pods.NewPodsRouteHandler(appContainer, base.GetYaml)).Name = "podsYaml"
	e.GET("api/v1/pods/:name/logs", pods.NewPodsRouteHandler(appContainer, base.GetLogs)).Name = "podsLogs"
	e.GET("api/v1/pods/:name/events", pods.NewPodsRouteHandler(appContainer, base.GetEvents)).Name = "podsEvents"
	e.DELETE("api/v1/pods", pods.NewPodsRouteHandler(appContainer, base.Delete)).Name = "podsDelete"

	// Deployments
	e.GET("api/v1/deployments", deployments.NewDeploymentRouteHandler(appContainer, base.GetList)).Name = "deploymentsList"
	e.GET("api/v1/deployments/:name", deployments.NewDeploymentRouteHandler(appContainer, base.GetDetails)).Name = "deploymentsDetails"
	e.GET("api/v1/deployments/:name/yaml", deployments.NewDeploymentRouteHandler(appContainer, base.GetYaml)).Name = "deploymentsYaml"
	e.GET("api/v1/deployments/:name/events", deployments.NewDeploymentRouteHandler(appContainer, base.GetEvents)).Name = "deploymentsEvents"
	e.GET("api/v1/deployments/:name/pods", deployments.NewDeploymentRouteHandler(appContainer, deployments.GetPods)).Name = "deploymentsPods"
	e.DELETE("api/v1/deployments", deployments.NewDeploymentRouteHandler(appContainer, base.Delete)).Name = "deploymentsDelete"
	e.POST("api/v1/deployments/:name/scale", deployments.NewDeploymentRouteHandler(appContainer, deployments.UpdateScale)).Name = "deploymentsScale"

	// DaemonSets
	e.GET("api/v1/daemonsets", daemonsets.NewDaemonSetsRouteHandler(appContainer, base.GetList)).Name = "daemonsetsList"
	e.GET("api/v1/daemonsets/:name", daemonsets.NewDaemonSetsRouteHandler(appContainer, base.GetDetails)).Name = "daemonsetsDetails"
	e.GET("api/v1/daemonsets/:name/yaml", daemonsets.NewDaemonSetsRouteHandler(appContainer, base.GetYaml)).Name = "daemonsetsYaml"
	e.GET("api/v1/daemonsets/:name/events", daemonsets.NewDaemonSetsRouteHandler(appContainer, base.GetEvents)).Name = "daemonsetsEvents"
	e.DELETE("api/v1/daemonsets", daemonsets.NewDaemonSetsRouteHandler(appContainer, base.Delete)).Name = "daemonsetsDelete"

	// ReplicaSets
	e.GET("api/v1/replicasets", replicaset.NewReplicaSetRouteHandler(appContainer, base.GetList)).Name = "replicasetsList"
	e.GET("api/v1/replicasets/:name", replicaset.NewReplicaSetRouteHandler(appContainer, base.GetDetails)).Name = "replicasetsDetails"
	e.GET("api/v1/replicasets/:name/yaml", replicaset.NewReplicaSetRouteHandler(appContainer, base.GetYaml)).Name = "replicasetsYaml"
	e.GET("api/v1/replicasets/:name/events", replicaset.NewReplicaSetRouteHandler(appContainer, base.GetEvents)).Name = "replicasetsEvents"
	e.DELETE("api/v1/replicasets", replicaset.NewReplicaSetRouteHandler(appContainer, base.Delete)).Name = "replicasetsDelete"

	// StatefulSets
	e.GET("api/v1/statefulsets", statefulset.NewStatefulSetRouteHandler(appContainer, base.GetList)).Name = "statefulsetsList"
	e.GET("api/v1/statefulsets/:name", statefulset.NewStatefulSetRouteHandler(appContainer, base.GetDetails)).Name = "statefulsetsDetails"
	e.GET("api/v1/statefulsets/:name/yaml", statefulset.NewStatefulSetRouteHandler(appContainer, base.GetYaml)).Name = "statefulsetsYaml"
	e.GET("api/v1/statefulsets/:name/events", statefulset.NewStatefulSetRouteHandler(appContainer, base.GetEvents)).Name = "statefulsetsEvents"
	e.DELETE("api/v1/statefulsets", statefulset.NewStatefulSetRouteHandler(appContainer, base.Delete)).Name = "statefulsetsDelete"

	// Jobs
	e.GET("api/v1/jobs", jobs.NewJobsRouteHandler(appContainer, base.GetList)).Name = "jobsList"
	e.GET("api/v1/jobs/:name", jobs.NewJobsRouteHandler(appContainer, base.GetDetails)).Name = "jobsDetails"
	e.GET("api/v1/jobs/:name/yaml", jobs.NewJobsRouteHandler(appContainer, base.GetYaml)).Name = "jobsYaml"
	e.GET("api/v1/jobs/:name/events", jobs.NewJobsRouteHandler(appContainer, base.GetEvents)).Name = "jobsEvents"
	e.DELETE("api/v1/jobs", jobs.NewJobsRouteHandler(appContainer, base.Delete)).Name = "jobsDelete"

	// CronJobs
	e.GET("api/v1/cronjobs", cronjobs.NewCronJobsRouteHandler(appContainer, base.GetList)).Name = "cronjobsList"
	e.GET("api/v1/cronjobs/:name", cronjobs.NewCronJobsRouteHandler(appContainer, base.GetDetails)).Name = "cronjobsDetails"
	e.GET("api/v1/cronjobs/:name/yaml", cronjobs.NewCronJobsRouteHandler(appContainer, base.GetYaml)).Name = "cronjobsYaml"
	e.GET("api/v1/cronjobs/:name/events", cronjobs.NewCronJobsRouteHandler(appContainer, base.GetEvents)).Name = "cronjobsEvents"
	e.DELETE("api/v1/cronjobs", cronjobs.NewCronJobsRouteHandler(appContainer, base.Delete)).Name = "cronjobsDelete"
}

func accessControlRoutes(e *echo.Echo, appContainer container.Container) {
	// ServiceAccounts
	e.GET("api/v1/serviceaccounts", serviceaccounts.NewServiceAccountsRouteHandler(appContainer, base.GetList)).Name = "serviceaccountsList"
	e.GET("api/v1/serviceaccounts/:name", serviceaccounts.NewServiceAccountsRouteHandler(appContainer, base.GetDetails)).Name = "serviceaccountsDetails"
	e.GET("api/v1/serviceaccounts/:name/yaml", serviceaccounts.NewServiceAccountsRouteHandler(appContainer, base.GetYaml)).Name = "serviceaccountsYaml"
	e.GET("api/v1/serviceaccounts/:name/events", serviceaccounts.NewServiceAccountsRouteHandler(appContainer, base.GetEvents)).Name = "serviceaccountsEvents"
	e.DELETE("api/v1/serviceaccounts", serviceaccounts.NewServiceAccountsRouteHandler(appContainer, base.Delete)).Name = "serviceaccountsDelete"

	// Roles
	e.GET("api/v1/roles", roles.NewRoleRouteHandler(appContainer, base.GetList)).Name = "rolesList"
	e.GET("api/v1/roles/:name", roles.NewRoleRouteHandler(appContainer, base.GetDetails)).Name = "rolesDetails"
	e.GET("api/v1/roles/:name/yaml", roles.NewRoleRouteHandler(appContainer, base.GetYaml)).Name = "rolesYaml"
	e.GET("api/v1/roles/:name/events", roles.NewRoleRouteHandler(appContainer, base.GetEvents)).Name = "rolesEvents"
	e.DELETE("api/v1/roles", roles.NewRoleRouteHandler(appContainer, base.Delete)).Name = "rolesDelete"

	// Role Bindings
	e.GET("api/v1/rolebindings", rolebindings.NewRoleBindingsRouteHandler(appContainer, base.GetList)).Name = "rolebindingsList"
	e.GET("api/v1/rolebindings/:name", rolebindings.NewRoleBindingsRouteHandler(appContainer, base.GetDetails)).Name = "rolebindingsDetails"
	e.GET("api/v1/rolebindings/:name/yaml", rolebindings.NewRoleBindingsRouteHandler(appContainer, base.GetYaml)).Name = "rolebindingsYaml"
	e.GET("api/v1/rolebindings/:name/events", rolebindings.NewRoleBindingsRouteHandler(appContainer, base.GetEvents)).Name = "rolebindingsEvents"
	e.DELETE("api/v1/rolebindings", rolebindings.NewRoleBindingsRouteHandler(appContainer, base.Delete)).Name = "rolebindingsDelete"

	// Cluster Roles
	e.GET("api/v1/clusterroles", clusterroles.NewClusterRoleRouteHandler(appContainer, base.GetList)).Name = "clusterrolesList"
	e.GET("api/v1/clusterroles/:name", clusterroles.NewClusterRoleRouteHandler(appContainer, base.GetDetails)).Name = "clusterrolesDetails"
	e.GET("api/v1/clusterroles/:name/yaml", clusterroles.NewClusterRoleRouteHandler(appContainer, base.GetYaml)).Name = "clusterrolesYaml"
	e.GET("api/v1/clusterroles/:name/events", clusterroles.NewClusterRoleRouteHandler(appContainer, base.GetEvents)).Name = "clusterrolesEvents"
	e.DELETE("api/v1/clusterroles", clusterroles.NewClusterRoleRouteHandler(appContainer, base.Delete)).Name = "clusterrolesDelete"

	// Cluster Role Bindings
	e.GET("api/v1/clusterrolebindings", clusterrolebindings.NewClusterRoleBindingsRouteHandler(appContainer, base.GetList)).Name = "clusterrolebindingsList"
	e.GET("api/v1/clusterrolebindings/:name", clusterrolebindings.NewClusterRoleBindingsRouteHandler(appContainer, base.GetDetails)).Name = "clusterrolebindingsDetails"
	e.GET("api/v1/clusterrolebindings/:name/yaml", clusterrolebindings.NewClusterRoleBindingsRouteHandler(appContainer, base.GetYaml)).Name = "clusterrolebindingsYaml"
	e.GET("api/v1/clusterrolebindings/:name/events", clusterrolebindings.NewClusterRoleBindingsRouteHandler(appContainer, base.GetEvents)).Name = "clusterrolebindingsEvents"
	e.DELETE("api/v1/clusterrolebindings", clusterrolebindings.NewClusterRoleBindingsRouteHandler(appContainer, base.Delete)).Name = "clusterrolebindingsDelete"
}

func setCORSConfig(e *echo.Echo) {
	e.Use(middleware.CORSWithConfig(middleware.CORSConfig{
		AllowCredentials:                         true,
		UnsafeWildcardOriginWithAllowCredentials: true,
		AllowOrigins:                             []string{"*"},
		AllowHeaders: []string{
			echo.HeaderConnection,
			echo.HeaderContentType,
			echo.HeaderContentLength,
			echo.HeaderAcceptEncoding,
			echo.HeaderXCSRFToken,
			echo.HeaderAuthorization,
			echo.HeaderXRequestID,
			echo.HeaderUpgrade,
			echo.HeaderAccept,
			echo.HeaderOrigin,
			echo.HeaderCacheControl,
			echo.HeaderXRequestedWith,
		},
		AllowMethods: []string{
			http.MethodGet,
			http.MethodHead,
			http.MethodPost,
			http.MethodPut,
			http.MethodPatch,
			http.MethodDelete,
			http.MethodConnect,
			http.MethodOptions,
			http.MethodTrace},
		MaxAge: 86400,
	}))
}
