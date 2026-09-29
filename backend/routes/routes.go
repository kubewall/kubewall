package routes

import (
	"embed"
	"net/http"
	"strings"

	"github.com/charmbracelet/log"
	"github.com/kubewall/kubewall/backend/addons"
	"github.com/kubewall/kubewall/backend/container"
	"github.com/kubewall/kubewall/backend/handlers/accesscontrol/clusterroles"
	clusterrolebindings "github.com/kubewall/kubewall/backend/handlers/accesscontrol/clusterrolesbindings"
	"github.com/kubewall/kubewall/backend/handlers/accesscontrol/roles"
	rolebindings "github.com/kubewall/kubewall/backend/handlers/accesscontrol/rolesbindings"
	"github.com/kubewall/kubewall/backend/handlers/accesscontrol/serviceaccounts"
	"github.com/kubewall/kubewall/backend/handlers/app"
	"github.com/kubewall/kubewall/backend/handlers/apply"
	"github.com/kubewall/kubewall/backend/handlers/base"
	configmaps "github.com/kubewall/kubewall/backend/handlers/config/configMaps"
	horizontalpodautoscalers "github.com/kubewall/kubewall/backend/handlers/config/horizontalPodAutoscalers"
	"github.com/kubewall/kubewall/backend/handlers/config/leases"
	limitranges "github.com/kubewall/kubewall/backend/handlers/config/limitRanges"
	poddisruptionbudgets "github.com/kubewall/kubewall/backend/handlers/config/podDisruptionBudgets"
	priorityclasses "github.com/kubewall/kubewall/backend/handlers/config/priorityClasses"
	resourcequotas "github.com/kubewall/kubewall/backend/handlers/config/resourceQuotas"
	runtimeclasses "github.com/kubewall/kubewall/backend/handlers/config/runtimeClasses"
	"github.com/kubewall/kubewall/backend/handlers/config/secrets"
	"github.com/kubewall/kubewall/backend/handlers/crds/crds"
	"github.com/kubewall/kubewall/backend/handlers/crds/resources"
	"github.com/kubewall/kubewall/backend/handlers/events"
	"github.com/kubewall/kubewall/backend/handlers/mcp"
	"github.com/kubewall/kubewall/backend/handlers/namespaces"
	"github.com/kubewall/kubewall/backend/handlers/network/endpoints"
	"github.com/kubewall/kubewall/backend/handlers/network/ingresses"
	"github.com/kubewall/kubewall/backend/handlers/network/networkpolicies"
	"github.com/kubewall/kubewall/backend/handlers/network/services"
	"github.com/kubewall/kubewall/backend/handlers/nodes"
	"github.com/kubewall/kubewall/backend/handlers/portforward"
	"github.com/kubewall/kubewall/backend/handlers/storage/csidrivers"
	"github.com/kubewall/kubewall/backend/handlers/storage/csinodes"
	"github.com/kubewall/kubewall/backend/handlers/storage/persistentvolumeclaims"
	"github.com/kubewall/kubewall/backend/handlers/storage/persistentvolumes"
	"github.com/kubewall/kubewall/backend/handlers/storage/storageclasses"
	"github.com/kubewall/kubewall/backend/handlers/storage/volumeattributesclasses"
	cronjobs "github.com/kubewall/kubewall/backend/handlers/workloads/cronJobs"
	"github.com/kubewall/kubewall/backend/handlers/workloads/daemonsets"
	"github.com/kubewall/kubewall/backend/handlers/workloads/deployments"
	"github.com/kubewall/kubewall/backend/handlers/workloads/jobs"
	"github.com/kubewall/kubewall/backend/handlers/workloads/pods"
	"github.com/kubewall/kubewall/backend/handlers/workloads/replicaset"
	statefulset "github.com/kubewall/kubewall/backend/handlers/workloads/statefulsets"
	appmiddleware "github.com/kubewall/kubewall/backend/routes/middleware"
	"github.com/labstack/echo/v5"
	"github.com/labstack/echo/v5/middleware"
)

//go:embed static/*
var embeddedFiles embed.FS

func ConfigureRoutes(e *echo.Echo, appContainer container.Container) {
	e.IPExtractor = echo.ExtractIPFromXFFHeader()
	setCORSConfig(e)

	e.Pre(middleware.RemoveTrailingSlash())
	e.Use(middleware.RequestLoggerWithConfig(middleware.RequestLoggerConfig{
		LogStatus:     true,
		LogMethod:     true,
		LogURI:        true,
		LogRemoteIP:   true,
		LogLatency:    true,
		HandleError:   true,
		LogValuesFunc: logRequest,
	}))
	e.Use(middleware.Recover())
	e.Use(middleware.RequestID())
	addons.RegisterMiddleware(e, appContainer)
	e.Use(appmiddleware.ClusterQueryParamMiddleware(appContainer))
	e.Use(appmiddleware.ClusterConnectivityMiddleware(appContainer))
	e.Use(appmiddleware.ClusterCacheMiddleware(appContainer))
	e.Use(appmiddleware.PrecompressedStaticMiddleware(embeddedFiles, "static"))
	e.Use(middleware.StaticWithConfig(middleware.StaticConfig{
		Skipper: func(c *echo.Context) bool {
			return strings.HasPrefix(c.Request().URL.Path, "/api/")
		},
		HTML5:      true,
		Root:       "static",
		Filesystem: embeddedFiles,
	}))
	e.GET("/healthz", func(c *echo.Context) error {
		return c.String(http.StatusOK, "OK")
	})

	e.POST("api/v1/app/apply", apply.NewApplyHandler(appContainer, apply.POSTApply))

	appConfig := app.NewAppConfigHandler(appContainer)
	e.GET("api/v1/app/config", appConfig.Get)
	e.POST("api/v1/app/config/kubeconfigs", appConfig.Post)
	e.POST("api/v1/app/config/kubeconfigs-bearer", appConfig.PostBearer)
	e.POST("api/v1/app/config/kubeconfigs-certificate", appConfig.PostCertificate)
	// GET is kept because the bundled UI triggers the reset by navigating to it.
	// POST is the verb API clients should use for a state-changing call.
	e.GET("api/v1/app/config/reload", appConfig.Reload)
	e.POST("api/v1/app/config/reload", appConfig.Reload)

	e.DELETE("api/v1/app/config/kubeconfigs/:configId", appConfig.Delete)

	// Namespaces
	addNamedRoute(e, http.MethodGet, "api/v1/namespaces", "namespacesList", namespaces.NewNamespacesRouteHandler(appContainer, base.GetList))
	addNamedRoute(e, http.MethodGet, "api/v1/namespaces/:name", "namespacesDetails", namespaces.NewNamespacesRouteHandler(appContainer, base.GetDetails))
	addNamedRoute(e, http.MethodGet, "api/v1/namespaces/:name/yaml", "namespacesYaml", namespaces.NewNamespacesRouteHandler(appContainer, base.GetYaml))
	addNamedRoute(e, http.MethodGet, "api/v1/namespaces/:name/events", "namespacesEvents", namespaces.NewNamespacesRouteHandler(appContainer, base.GetEvents))
	addNamedRoute(e, http.MethodDelete, "api/v1/namespaces", "namespacesDelete", namespaces.NewNamespacesRouteHandler(appContainer, base.Delete))

	// Nodes
	addNamedRoute(e, http.MethodGet, "api/v1/nodes", "nodesList", nodes.NewNodeRouteHandler(appContainer, base.GetList))
	addNamedRoute(e, http.MethodGet, "api/v1/nodes/:name", "nodesDetails", nodes.NewNodeRouteHandler(appContainer, base.GetDetails))
	addNamedRoute(e, http.MethodGet, "api/v1/nodes/:name/yaml", "nodesYaml", nodes.NewNodeRouteHandler(appContainer, base.GetYaml))
	addNamedRoute(e, http.MethodGet, "api/v1/nodes/:name/events", "nodesEvents", nodes.NewNodeRouteHandler(appContainer, base.GetEvents))
	addNamedRoute(e, http.MethodGet, "api/v1/nodes/:name/pods", "nodePods", nodes.NewNodeRouteHandler(appContainer, deployments.GetPods))

	addNamedRoute(e, http.MethodGet, "api/v1/events", "eventsList", events.NewEventsRouteHandler(appContainer, base.GetList))
	addNamedRoute(e, http.MethodDelete, "api/v1/events", "eventsDelete", events.NewEventsRouteHandler(appContainer, base.Delete))

	e.GET("api/v1/portforwards", portforward.NewPortForwardingHandler(appContainer, base.GetList))
	e.POST("api/v1/portforwards", portforward.NewPortForwardingHandler(appContainer, base.Create))
	e.DELETE("api/v1/portforwards", portforward.NewPortForwardingHandler(appContainer, base.Delete))

	accessControlRoutes(e, appContainer)
	workloadRoutes(e, appContainer)
	configRoutes(e, appContainer)
	storageRoutes(e, appContainer)
	servicesRoutes(e, appContainer)
	customResources(e, appContainer)
	addons.RegisterRoutes(e, appContainer)
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
	addNamedRoute(e, http.MethodGet, "api/v1/services", "servicesList", services.NewServicesRouteHandler(appContainer, base.GetList))
	addNamedRoute(e, http.MethodGet, "api/v1/services/:name", "servicesDetails", services.NewServicesRouteHandler(appContainer, base.GetDetails))
	addNamedRoute(e, http.MethodGet, "api/v1/services/:name/yaml", "servicesYaml", services.NewServicesRouteHandler(appContainer, base.GetYaml))
	addNamedRoute(e, http.MethodGet, "api/v1/services/:name/events", "servicesEvents", services.NewServicesRouteHandler(appContainer, base.GetEvents))
	addNamedRoute(e, http.MethodDelete, "api/v1/services", "servicesDelete", services.NewServicesRouteHandler(appContainer, base.Delete))

	// Endpoints
	addNamedRoute(e, http.MethodGet, "api/v1/endpoints", "endpointsList", endpoints.NewEndpointsRouteHandler(appContainer, base.GetList))
	addNamedRoute(e, http.MethodGet, "api/v1/endpoints/:name", "endpointsDetails", endpoints.NewEndpointsRouteHandler(appContainer, base.GetDetails))
	addNamedRoute(e, http.MethodGet, "api/v1/endpoints/:name/yaml", "endpointsYaml", endpoints.NewEndpointsRouteHandler(appContainer, base.GetYaml))
	addNamedRoute(e, http.MethodGet, "api/v1/endpoints/:name/events", "endpointsEvents", endpoints.NewEndpointsRouteHandler(appContainer, base.GetEvents))
	addNamedRoute(e, http.MethodDelete, "api/v1/endpoints", "endpointsDelete", endpoints.NewEndpointsRouteHandler(appContainer, base.Delete))

	// Ingresses
	addNamedRoute(e, http.MethodGet, "api/v1/ingresses", "ingressesList", ingresses.NewIngressRouteHandler(appContainer, base.GetList))
	addNamedRoute(e, http.MethodGet, "api/v1/ingresses/:name", "ingressesDetails", ingresses.NewIngressRouteHandler(appContainer, base.GetDetails))
	addNamedRoute(e, http.MethodGet, "api/v1/ingresses/:name/yaml", "ingressesYaml", ingresses.NewIngressRouteHandler(appContainer, base.GetYaml))
	addNamedRoute(e, http.MethodGet, "api/v1/ingresses/:name/events", "ingressesEvents", ingresses.NewIngressRouteHandler(appContainer, base.GetEvents))
	addNamedRoute(e, http.MethodDelete, "api/v1/ingresses", "ingressesDelete", ingresses.NewIngressRouteHandler(appContainer, base.Delete))

	// NetworkPolicies
	addNamedRoute(e, http.MethodGet, "api/v1/networkpolicies", "networkpoliciesList", networkpolicies.NewNetworkPolicyRouteHandler(appContainer, base.GetList))
	addNamedRoute(e, http.MethodGet, "api/v1/networkpolicies/:name", "networkpoliciesDetails", networkpolicies.NewNetworkPolicyRouteHandler(appContainer, base.GetDetails))
	addNamedRoute(e, http.MethodGet, "api/v1/networkpolicies/:name/yaml", "networkpoliciesYaml", networkpolicies.NewNetworkPolicyRouteHandler(appContainer, base.GetYaml))
	addNamedRoute(e, http.MethodGet, "api/v1/networkpolicies/:name/events", "networkpoliciesEvents", networkpolicies.NewNetworkPolicyRouteHandler(appContainer, base.GetEvents))
	addNamedRoute(e, http.MethodDelete, "api/v1/networkpolicies", "networkpoliciesDelete", networkpolicies.NewNetworkPolicyRouteHandler(appContainer, base.Delete))
}

func storageRoutes(e *echo.Echo, appContainer container.Container) {
	// PersistentVolumes (PV)
	addNamedRoute(e, http.MethodGet, "api/v1/persistentvolumes", "persistentvolumesList", persistentvolumes.NewPersistentVolumeRouteHandler(appContainer, base.GetList))
	addNamedRoute(e, http.MethodGet, "api/v1/persistentvolumes/:name", "persistentvolumesDetails", persistentvolumes.NewPersistentVolumeRouteHandler(appContainer, base.GetDetails))
	addNamedRoute(e, http.MethodGet, "api/v1/persistentvolumes/:name/yaml", "persistentvolumesYaml", persistentvolumes.NewPersistentVolumeRouteHandler(appContainer, base.GetYaml))
	addNamedRoute(e, http.MethodGet, "api/v1/persistentvolumes/:name/events", "persistentvolumesEvents", persistentvolumes.NewPersistentVolumeRouteHandler(appContainer, base.GetEvents))
	addNamedRoute(e, http.MethodDelete, "api/v1/persistentvolumes", "persistentvolumesDelete", persistentvolumes.NewPersistentVolumeRouteHandler(appContainer, base.Delete))

	// PersistentVolumeClaims (PVC)
	addNamedRoute(e, http.MethodGet, "api/v1/persistentvolumeclaims", "persistentvolumeclaimsList", persistentvolumeclaims.NewPersistentVolumeClaimsRouteHandler(appContainer, base.GetList))
	addNamedRoute(e, http.MethodGet, "api/v1/persistentvolumeclaims/:name", "persistentvolumeclaimsDetails", persistentvolumeclaims.NewPersistentVolumeClaimsRouteHandler(appContainer, base.GetDetails))
	addNamedRoute(e, http.MethodGet, "api/v1/persistentvolumeclaims/:name/yaml", "persistentvolumeclaimsYaml", persistentvolumeclaims.NewPersistentVolumeClaimsRouteHandler(appContainer, base.GetYaml))
	addNamedRoute(e, http.MethodGet, "api/v1/persistentvolumeclaims/:name/events", "persistentvolumeclaimsEvents", persistentvolumeclaims.NewPersistentVolumeClaimsRouteHandler(appContainer, base.GetEvents))
	addNamedRoute(e, http.MethodDelete, "api/v1/persistentvolumeclaims", "persistentvolumeclaimsDelete", persistentvolumeclaims.NewPersistentVolumeClaimsRouteHandler(appContainer, base.Delete))

	// StorageClasses
	addNamedRoute(e, http.MethodGet, "api/v1/storageclasses", "storageclassesList", storageclasses.NewStorageClassRouteHandler(appContainer, base.GetList))
	addNamedRoute(e, http.MethodGet, "api/v1/storageclasses/:name", "storageclassesDetails", storageclasses.NewStorageClassRouteHandler(appContainer, base.GetDetails))
	addNamedRoute(e, http.MethodGet, "api/v1/storageclasses/:name/yaml", "storageclassesYaml", storageclasses.NewStorageClassRouteHandler(appContainer, base.GetYaml))
	addNamedRoute(e, http.MethodGet, "api/v1/storageclasses/:name/events", "storageclassesEvents", storageclasses.NewStorageClassRouteHandler(appContainer, base.GetEvents))
	addNamedRoute(e, http.MethodDelete, "api/v1/storageclasses", "storageclassesDelete", storageclasses.NewStorageClassRouteHandler(appContainer, base.Delete))

	// CSI Drivers
	addNamedRoute(e, http.MethodGet, "api/v1/csidrivers", "csidriversList", csidrivers.NewCSIDriverRouteHandler(appContainer, base.GetList))
	addNamedRoute(e, http.MethodGet, "api/v1/csidrivers/:name", "csidriversDetails", csidrivers.NewCSIDriverRouteHandler(appContainer, base.GetDetails))
	addNamedRoute(e, http.MethodGet, "api/v1/csidrivers/:name/yaml", "csidriversYaml", csidrivers.NewCSIDriverRouteHandler(appContainer, base.GetYaml))
	addNamedRoute(e, http.MethodGet, "api/v1/csidrivers/:name/events", "csidriversEvents", csidrivers.NewCSIDriverRouteHandler(appContainer, base.GetEvents))
	addNamedRoute(e, http.MethodDelete, "api/v1/csidrivers", "csidriversDelete", csidrivers.NewCSIDriverRouteHandler(appContainer, base.Delete))

	// CSI Nodes
	addNamedRoute(e, http.MethodGet, "api/v1/csinodes", "csinodesList", csinodes.NewCSINodeRouteHandler(appContainer, base.GetList))
	addNamedRoute(e, http.MethodGet, "api/v1/csinodes/:name", "csinodesDetails", csinodes.NewCSINodeRouteHandler(appContainer, base.GetDetails))
	addNamedRoute(e, http.MethodGet, "api/v1/csinodes/:name/yaml", "csinodesYaml", csinodes.NewCSINodeRouteHandler(appContainer, base.GetYaml))
	addNamedRoute(e, http.MethodGet, "api/v1/csinodes/:name/events", "csinodesEvents", csinodes.NewCSINodeRouteHandler(appContainer, base.GetEvents))
	addNamedRoute(e, http.MethodDelete, "api/v1/csinodes", "csinodesDelete", csinodes.NewCSINodeRouteHandler(appContainer, base.Delete))

	// VolumeAttributesClasses
	addNamedRoute(e, http.MethodGet, "api/v1/volumeattributesclasses", "volumeattributesclassesList", volumeattributesclasses.NewVolumeAttributesClassRouteHandler(appContainer, base.GetList))
	addNamedRoute(e, http.MethodGet, "api/v1/volumeattributesclasses/:name", "volumeattributesclassesDetails", volumeattributesclasses.NewVolumeAttributesClassRouteHandler(appContainer, base.GetDetails))
	addNamedRoute(e, http.MethodGet, "api/v1/volumeattributesclasses/:name/yaml", "volumeattributesclassesYaml", volumeattributesclasses.NewVolumeAttributesClassRouteHandler(appContainer, base.GetYaml))
	addNamedRoute(e, http.MethodGet, "api/v1/volumeattributesclasses/:name/events", "volumeattributesclassesEvents", volumeattributesclasses.NewVolumeAttributesClassRouteHandler(appContainer, base.GetEvents))
	addNamedRoute(e, http.MethodDelete, "api/v1/volumeattributesclasses", "volumeattributesclassesDelete", volumeattributesclasses.NewVolumeAttributesClassRouteHandler(appContainer, base.Delete))
}

func configRoutes(e *echo.Echo, appContainer container.Container) {
	// ConfigMaps
	addNamedRoute(e, http.MethodGet, "api/v1/configmaps", "configmapsList", configmaps.NewConfigMapsRouteHandler(appContainer, base.GetList))
	addNamedRoute(e, http.MethodGet, "api/v1/configmaps/:name", "configmapsDetails", configmaps.NewConfigMapsRouteHandler(appContainer, base.GetDetails))
	addNamedRoute(e, http.MethodGet, "api/v1/configmaps/:name/yaml", "configmapsYaml", configmaps.NewConfigMapsRouteHandler(appContainer, base.GetYaml))
	addNamedRoute(e, http.MethodGet, "api/v1/configmaps/:name/events", "configmapsEvents", configmaps.NewConfigMapsRouteHandler(appContainer, base.GetEvents))
	addNamedRoute(e, http.MethodDelete, "api/v1/configmaps", "configmapsDelete", configmaps.NewConfigMapsRouteHandler(appContainer, base.Delete))

	// Secrets
	addNamedRoute(e, http.MethodGet, "api/v1/secrets", "secretsList", secrets.NewSecretsRouteHandler(appContainer, base.GetList))
	addNamedRoute(e, http.MethodGet, "api/v1/secrets/:name", "secretsDetails", secrets.NewSecretsRouteHandler(appContainer, base.GetDetails))
	addNamedRoute(e, http.MethodGet, "api/v1/secrets/:name/yaml", "secretsYaml", secrets.NewSecretsRouteHandler(appContainer, base.GetYaml))
	addNamedRoute(e, http.MethodGet, "api/v1/secrets/:name/events", "secretsEvents", secrets.NewSecretsRouteHandler(appContainer, base.GetEvents))
	addNamedRoute(e, http.MethodDelete, "api/v1/secrets", "secretsDelete", secrets.NewSecretsRouteHandler(appContainer, base.Delete))

	// ResourceQuotas
	addNamedRoute(e, http.MethodGet, "api/v1/resourcequotas", "resourcequotasList", resourcequotas.NewResourceQuotaRouteHandler(appContainer, base.GetList))
	addNamedRoute(e, http.MethodGet, "api/v1/resourcequotas/:name", "resourcequotasDetails", resourcequotas.NewResourceQuotaRouteHandler(appContainer, base.GetDetails))
	addNamedRoute(e, http.MethodGet, "api/v1/resourcequotas/:name/yaml", "resourcequotasYaml", resourcequotas.NewResourceQuotaRouteHandler(appContainer, base.GetYaml))
	addNamedRoute(e, http.MethodGet, "api/v1/resourcequotas/:name/events", "resourcequotasEvents", resourcequotas.NewResourceQuotaRouteHandler(appContainer, base.GetEvents))
	addNamedRoute(e, http.MethodDelete, "api/v1/resourcequotas", "resourcequotasDelete", resourcequotas.NewResourceQuotaRouteHandler(appContainer, base.Delete))

	// LimitRanges
	addNamedRoute(e, http.MethodGet, "api/v1/limitranges", "limitrangesList", limitranges.NewLimitRangesRouteHandler(appContainer, base.GetList))
	addNamedRoute(e, http.MethodGet, "api/v1/limitranges/:name", "limitrangesDetails", limitranges.NewLimitRangesRouteHandler(appContainer, base.GetDetails))
	addNamedRoute(e, http.MethodGet, "api/v1/limitranges/:name/yaml", "limitrangesYaml", limitranges.NewLimitRangesRouteHandler(appContainer, base.GetYaml))
	addNamedRoute(e, http.MethodGet, "api/v1/limitranges/:name/events", "limitrangesEvents", limitranges.NewLimitRangesRouteHandler(appContainer, base.GetEvents))
	addNamedRoute(e, http.MethodDelete, "api/v1/limitranges", "limitrangesDelete", limitranges.NewLimitRangesRouteHandler(appContainer, base.Delete))

	// HorizontalPodAutoscalers (HPA)
	addNamedRoute(e, http.MethodGet, "api/v1/horizontalpodautoscalers", "horizontalpodautoscalersList", horizontalpodautoscalers.NewHorizontalPodAutoscalersRouteHandler(appContainer, base.GetList))
	addNamedRoute(e, http.MethodGet, "api/v1/horizontalpodautoscalers/:name", "horizontalpodautoscalersDetails", horizontalpodautoscalers.NewHorizontalPodAutoscalersRouteHandler(appContainer, base.GetDetails))
	addNamedRoute(e, http.MethodGet, "api/v1/horizontalpodautoscalers/:name/yaml", "horizontalpodautoscalersYaml", horizontalpodautoscalers.NewHorizontalPodAutoscalersRouteHandler(appContainer, base.GetYaml))
	addNamedRoute(e, http.MethodGet, "api/v1/horizontalpodautoscalers/:name/events", "horizontalpodautoscalersEvents", horizontalpodautoscalers.NewHorizontalPodAutoscalersRouteHandler(appContainer, base.GetEvents))
	addNamedRoute(e, http.MethodDelete, "api/v1/horizontalpodautoscalers", "horizontalpodautoscalersDelete", horizontalpodautoscalers.NewHorizontalPodAutoscalersRouteHandler(appContainer, base.Delete))

	// PodDisruptionBudgets (PDB)
	addNamedRoute(e, http.MethodGet, "api/v1/poddisruptionbudgets", "poddisruptionbudgetsList", poddisruptionbudgets.NewPodDisruptionBudgetRouteHandler(appContainer, base.GetList))
	addNamedRoute(e, http.MethodGet, "api/v1/poddisruptionbudgets/:name", "poddisruptionbudgetsDetails", poddisruptionbudgets.NewPodDisruptionBudgetRouteHandler(appContainer, base.GetDetails))
	addNamedRoute(e, http.MethodGet, "api/v1/poddisruptionbudgets/:name/yaml", "poddisruptionbudgetsYaml", poddisruptionbudgets.NewPodDisruptionBudgetRouteHandler(appContainer, base.GetYaml))
	addNamedRoute(e, http.MethodGet, "api/v1/poddisruptionbudgets/:name/events", "poddisruptionbudgetsEvents", poddisruptionbudgets.NewPodDisruptionBudgetRouteHandler(appContainer, base.GetEvents))
	addNamedRoute(e, http.MethodDelete, "api/v1/poddisruptionbudgets", "poddisruptionbudgetsDelete", poddisruptionbudgets.NewPodDisruptionBudgetRouteHandler(appContainer, base.Delete))

	// PriorityClasses
	addNamedRoute(e, http.MethodGet, "api/v1/priorityclasses", "priorityclassesList", priorityclasses.NewPriorityClassRouteHandler(appContainer, base.GetList))
	addNamedRoute(e, http.MethodGet, "api/v1/priorityclasses/:name", "priorityclassesDetails", priorityclasses.NewPriorityClassRouteHandler(appContainer, base.GetDetails))
	addNamedRoute(e, http.MethodGet, "api/v1/priorityclasses/:name/yaml", "priorityclassesYaml", priorityclasses.NewPriorityClassRouteHandler(appContainer, base.GetYaml))
	addNamedRoute(e, http.MethodGet, "api/v1/priorityclasses/:name/events", "priorityclassesEvents", priorityclasses.NewPriorityClassRouteHandler(appContainer, base.GetEvents))
	addNamedRoute(e, http.MethodDelete, "api/v1/priorityclasses", "priorityclassesDelete", priorityclasses.NewPriorityClassRouteHandler(appContainer, base.Delete))

	// RuntimeClasses
	addNamedRoute(e, http.MethodGet, "api/v1/runtimeclasses", "runtimeclassesList", runtimeclasses.NewRunTimeClassRouteHandler(appContainer, base.GetList))
	addNamedRoute(e, http.MethodGet, "api/v1/runtimeclasses/:name", "runtimeclassesDetails", runtimeclasses.NewRunTimeClassRouteHandler(appContainer, base.GetDetails))
	addNamedRoute(e, http.MethodGet, "api/v1/runtimeclasses/:name/yaml", "runtimeclassesYaml", runtimeclasses.NewRunTimeClassRouteHandler(appContainer, base.GetYaml))
	addNamedRoute(e, http.MethodGet, "api/v1/runtimeclasses/:name/events", "runtimeclassesEvents", runtimeclasses.NewRunTimeClassRouteHandler(appContainer, base.GetEvents))
	addNamedRoute(e, http.MethodDelete, "api/v1/runtimeclasses", "runtimeclassesDelete", runtimeclasses.NewRunTimeClassRouteHandler(appContainer, base.Delete))

	// Leases
	addNamedRoute(e, http.MethodGet, "api/v1/leases", "leasesList", leases.NewLeaseRouteHandler(appContainer, base.GetList))
	addNamedRoute(e, http.MethodGet, "api/v1/leases/:name", "leasesDetails", leases.NewLeaseRouteHandler(appContainer, base.GetDetails))
	addNamedRoute(e, http.MethodGet, "api/v1/leases/:name/yaml", "leasesYaml", leases.NewLeaseRouteHandler(appContainer, base.GetYaml))
	addNamedRoute(e, http.MethodGet, "api/v1/leases/:name/events", "leasesEvents", leases.NewLeaseRouteHandler(appContainer, base.GetEvents))
	addNamedRoute(e, http.MethodDelete, "api/v1/leases", "leasesDelete", leases.NewLeaseRouteHandler(appContainer, base.Delete))
}

func workloadRoutes(e *echo.Echo, appContainer container.Container) {
	// Pods
	addNamedRoute(e, http.MethodGet, "api/v1/pods", "podsList", pods.NewPodsRouteHandler(appContainer, base.GetList))
	addNamedRoute(e, http.MethodGet, "api/v1/pods/:name", "podsDetails", pods.NewPodsRouteHandler(appContainer, base.GetDetails))
	addNamedRoute(e, http.MethodGet, "api/v1/pods/:name/yaml", "podsYaml", pods.NewPodsRouteHandler(appContainer, base.GetYaml))
	addNamedRoute(e, http.MethodGet, "api/v1/pods/:name/logs", "podsLogs", pods.NewPodsRouteHandler(appContainer, base.GetLogs))
	addNamedRoute(e, http.MethodGet, "api/v1/pods/:name/logs/history", "podsLogsHistory", pods.NewPodsRouteHandler(appContainer, pods.GetLogHistory))
	addNamedRoute(e, http.MethodGet, "api/v1/pods/:name/events", "podsEvents", pods.NewPodsRouteHandler(appContainer, base.GetEvents))
	addNamedRoute(e, http.MethodDelete, "api/v1/pods", "podsDelete", pods.NewPodsRouteHandler(appContainer, base.Delete))

	// Deployments
	addNamedRoute(e, http.MethodGet, "api/v1/deployments", "deploymentsList", deployments.NewDeploymentRouteHandler(appContainer, base.GetList))
	addNamedRoute(e, http.MethodGet, "api/v1/deployments/:name", "deploymentsDetails", deployments.NewDeploymentRouteHandler(appContainer, base.GetDetails))
	addNamedRoute(e, http.MethodGet, "api/v1/deployments/:name/yaml", "deploymentsYaml", deployments.NewDeploymentRouteHandler(appContainer, base.GetYaml))
	addNamedRoute(e, http.MethodGet, "api/v1/deployments/:name/events", "deploymentsEvents", deployments.NewDeploymentRouteHandler(appContainer, base.GetEvents))
	addNamedRoute(e, http.MethodGet, "api/v1/deployments/:name/pods", "deploymentsPods", deployments.NewDeploymentRouteHandler(appContainer, deployments.GetPods))
	addNamedRoute(e, http.MethodDelete, "api/v1/deployments", "deploymentsDelete", deployments.NewDeploymentRouteHandler(appContainer, base.Delete))
	addNamedRoute(e, http.MethodPost, "api/v1/deployments/:name/scale", "deploymentsScale", deployments.NewDeploymentRouteHandler(appContainer, deployments.UpdateScale))

	// DaemonSets
	addNamedRoute(e, http.MethodGet, "api/v1/daemonsets", "daemonsetsList", daemonsets.NewDaemonSetsRouteHandler(appContainer, base.GetList))
	addNamedRoute(e, http.MethodGet, "api/v1/daemonsets/:name", "daemonsetsDetails", daemonsets.NewDaemonSetsRouteHandler(appContainer, base.GetDetails))
	addNamedRoute(e, http.MethodGet, "api/v1/daemonsets/:name/yaml", "daemonsetsYaml", daemonsets.NewDaemonSetsRouteHandler(appContainer, base.GetYaml))
	addNamedRoute(e, http.MethodGet, "api/v1/daemonsets/:name/events", "daemonsetsEvents", daemonsets.NewDaemonSetsRouteHandler(appContainer, base.GetEvents))
	addNamedRoute(e, http.MethodGet, "api/v1/daemonsets/:name/pods", "daemonsetsPods", pods.NewOwnerPodsRouteHandler(appContainer, pods.DaemonSetsResource))
	addNamedRoute(e, http.MethodDelete, "api/v1/daemonsets", "daemonsetsDelete", daemonsets.NewDaemonSetsRouteHandler(appContainer, base.Delete))

	// ReplicaSets
	addNamedRoute(e, http.MethodGet, "api/v1/replicasets", "replicasetsList", replicaset.NewReplicaSetRouteHandler(appContainer, base.GetList))
	addNamedRoute(e, http.MethodGet, "api/v1/replicasets/:name", "replicasetsDetails", replicaset.NewReplicaSetRouteHandler(appContainer, base.GetDetails))
	addNamedRoute(e, http.MethodGet, "api/v1/replicasets/:name/yaml", "replicasetsYaml", replicaset.NewReplicaSetRouteHandler(appContainer, base.GetYaml))
	addNamedRoute(e, http.MethodGet, "api/v1/replicasets/:name/events", "replicasetsEvents", replicaset.NewReplicaSetRouteHandler(appContainer, base.GetEvents))
	addNamedRoute(e, http.MethodGet, "api/v1/replicasets/:name/pods", "replicasetsPods", pods.NewOwnerPodsRouteHandler(appContainer, pods.ReplicaSetsResource))
	addNamedRoute(e, http.MethodDelete, "api/v1/replicasets", "replicasetsDelete", replicaset.NewReplicaSetRouteHandler(appContainer, base.Delete))

	// StatefulSets
	addNamedRoute(e, http.MethodGet, "api/v1/statefulsets", "statefulsetsList", statefulset.NewStatefulSetRouteHandler(appContainer, base.GetList))
	addNamedRoute(e, http.MethodGet, "api/v1/statefulsets/:name", "statefulsetsDetails", statefulset.NewStatefulSetRouteHandler(appContainer, base.GetDetails))
	addNamedRoute(e, http.MethodGet, "api/v1/statefulsets/:name/yaml", "statefulsetsYaml", statefulset.NewStatefulSetRouteHandler(appContainer, base.GetYaml))
	addNamedRoute(e, http.MethodGet, "api/v1/statefulsets/:name/events", "statefulsetsEvents", statefulset.NewStatefulSetRouteHandler(appContainer, base.GetEvents))
	addNamedRoute(e, http.MethodGet, "api/v1/statefulsets/:name/pods", "statefulsetsPods", pods.NewOwnerPodsRouteHandler(appContainer, pods.StatefulSetsResource))
	addNamedRoute(e, http.MethodDelete, "api/v1/statefulsets", "statefulsetsDelete", statefulset.NewStatefulSetRouteHandler(appContainer, base.Delete))

	// Jobs
	addNamedRoute(e, http.MethodGet, "api/v1/jobs", "jobsList", jobs.NewJobsRouteHandler(appContainer, base.GetList))
	addNamedRoute(e, http.MethodGet, "api/v1/jobs/:name", "jobsDetails", jobs.NewJobsRouteHandler(appContainer, base.GetDetails))
	addNamedRoute(e, http.MethodGet, "api/v1/jobs/:name/yaml", "jobsYaml", jobs.NewJobsRouteHandler(appContainer, base.GetYaml))
	addNamedRoute(e, http.MethodGet, "api/v1/jobs/:name/events", "jobsEvents", jobs.NewJobsRouteHandler(appContainer, base.GetEvents))
	addNamedRoute(e, http.MethodGet, "api/v1/jobs/:name/pods", "jobsPods", pods.NewOwnerPodsRouteHandler(appContainer, pods.JobsResource))
	addNamedRoute(e, http.MethodDelete, "api/v1/jobs", "jobsDelete", jobs.NewJobsRouteHandler(appContainer, base.Delete))

	// CronJobs
	addNamedRoute(e, http.MethodGet, "api/v1/cronjobs", "cronjobsList", cronjobs.NewCronJobsRouteHandler(appContainer, base.GetList))
	addNamedRoute(e, http.MethodGet, "api/v1/cronjobs/:name", "cronjobsDetails", cronjobs.NewCronJobsRouteHandler(appContainer, base.GetDetails))
	addNamedRoute(e, http.MethodGet, "api/v1/cronjobs/:name/yaml", "cronjobsYaml", cronjobs.NewCronJobsRouteHandler(appContainer, base.GetYaml))
	addNamedRoute(e, http.MethodGet, "api/v1/cronjobs/:name/events", "cronjobsEvents", cronjobs.NewCronJobsRouteHandler(appContainer, base.GetEvents))
	addNamedRoute(e, http.MethodGet, "api/v1/cronjobs/:name/jobs", "cronjobsJobs", cronjobs.NewCronJobsRouteHandler(appContainer, cronjobs.GetJobs))
	addNamedRoute(e, http.MethodDelete, "api/v1/cronjobs", "cronjobsDelete", cronjobs.NewCronJobsRouteHandler(appContainer, base.Delete))
}

func accessControlRoutes(e *echo.Echo, appContainer container.Container) {
	// ServiceAccounts
	addNamedRoute(e, http.MethodGet, "api/v1/serviceaccounts", "serviceaccountsList", serviceaccounts.NewServiceAccountsRouteHandler(appContainer, base.GetList))
	addNamedRoute(e, http.MethodGet, "api/v1/serviceaccounts/:name", "serviceaccountsDetails", serviceaccounts.NewServiceAccountsRouteHandler(appContainer, base.GetDetails))
	addNamedRoute(e, http.MethodGet, "api/v1/serviceaccounts/:name/yaml", "serviceaccountsYaml", serviceaccounts.NewServiceAccountsRouteHandler(appContainer, base.GetYaml))
	addNamedRoute(e, http.MethodGet, "api/v1/serviceaccounts/:name/events", "serviceaccountsEvents", serviceaccounts.NewServiceAccountsRouteHandler(appContainer, base.GetEvents))
	addNamedRoute(e, http.MethodDelete, "api/v1/serviceaccounts", "serviceaccountsDelete", serviceaccounts.NewServiceAccountsRouteHandler(appContainer, base.Delete))

	// Roles
	addNamedRoute(e, http.MethodGet, "api/v1/roles", "rolesList", roles.NewRoleRouteHandler(appContainer, base.GetList))
	addNamedRoute(e, http.MethodGet, "api/v1/roles/:name", "rolesDetails", roles.NewRoleRouteHandler(appContainer, base.GetDetails))
	addNamedRoute(e, http.MethodGet, "api/v1/roles/:name/yaml", "rolesYaml", roles.NewRoleRouteHandler(appContainer, base.GetYaml))
	addNamedRoute(e, http.MethodGet, "api/v1/roles/:name/events", "rolesEvents", roles.NewRoleRouteHandler(appContainer, base.GetEvents))
	addNamedRoute(e, http.MethodDelete, "api/v1/roles", "rolesDelete", roles.NewRoleRouteHandler(appContainer, base.Delete))

	// Role Bindings
	addNamedRoute(e, http.MethodGet, "api/v1/rolebindings", "rolebindingsList", rolebindings.NewRoleBindingsRouteHandler(appContainer, base.GetList))
	addNamedRoute(e, http.MethodGet, "api/v1/rolebindings/:name", "rolebindingsDetails", rolebindings.NewRoleBindingsRouteHandler(appContainer, base.GetDetails))
	addNamedRoute(e, http.MethodGet, "api/v1/rolebindings/:name/yaml", "rolebindingsYaml", rolebindings.NewRoleBindingsRouteHandler(appContainer, base.GetYaml))
	addNamedRoute(e, http.MethodGet, "api/v1/rolebindings/:name/events", "rolebindingsEvents", rolebindings.NewRoleBindingsRouteHandler(appContainer, base.GetEvents))
	addNamedRoute(e, http.MethodDelete, "api/v1/rolebindings", "rolebindingsDelete", rolebindings.NewRoleBindingsRouteHandler(appContainer, base.Delete))

	// Cluster Roles
	addNamedRoute(e, http.MethodGet, "api/v1/clusterroles", "clusterrolesList", clusterroles.NewClusterRoleRouteHandler(appContainer, base.GetList))
	addNamedRoute(e, http.MethodGet, "api/v1/clusterroles/:name", "clusterrolesDetails", clusterroles.NewClusterRoleRouteHandler(appContainer, base.GetDetails))
	addNamedRoute(e, http.MethodGet, "api/v1/clusterroles/:name/yaml", "clusterrolesYaml", clusterroles.NewClusterRoleRouteHandler(appContainer, base.GetYaml))
	addNamedRoute(e, http.MethodGet, "api/v1/clusterroles/:name/events", "clusterrolesEvents", clusterroles.NewClusterRoleRouteHandler(appContainer, base.GetEvents))
	addNamedRoute(e, http.MethodDelete, "api/v1/clusterroles", "clusterrolesDelete", clusterroles.NewClusterRoleRouteHandler(appContainer, base.Delete))

	// Cluster Role Bindings
	addNamedRoute(e, http.MethodGet, "api/v1/clusterrolebindings", "clusterrolebindingsList", clusterrolebindings.NewClusterRoleBindingsRouteHandler(appContainer, base.GetList))
	addNamedRoute(e, http.MethodGet, "api/v1/clusterrolebindings/:name", "clusterrolebindingsDetails", clusterrolebindings.NewClusterRoleBindingsRouteHandler(appContainer, base.GetDetails))
	addNamedRoute(e, http.MethodGet, "api/v1/clusterrolebindings/:name/yaml", "clusterrolebindingsYaml", clusterrolebindings.NewClusterRoleBindingsRouteHandler(appContainer, base.GetYaml))
	addNamedRoute(e, http.MethodGet, "api/v1/clusterrolebindings/:name/events", "clusterrolebindingsEvents", clusterrolebindings.NewClusterRoleBindingsRouteHandler(appContainer, base.GetEvents))
	addNamedRoute(e, http.MethodDelete, "api/v1/clusterrolebindings", "clusterrolebindingsDelete", clusterrolebindings.NewClusterRoleBindingsRouteHandler(appContainer, base.Delete))
}

func setCORSConfig(e *echo.Echo) {
	e.Use(middleware.CORSWithConfig(middleware.CORSConfig{
		AllowCredentials:      true,
		UnsafeAllowOriginFunc: reflectRequestOrigin,
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

func reflectRequestOrigin(_ *echo.Context, origin string) (string, bool, error) {
	return origin, true, nil
}

func logRequest(_ *echo.Context, request middleware.RequestLoggerValues) error {
	level := log.InfoLevel
	fields := []any{"status", request.Status, "method", request.Method, "uri", request.URI, "ip", request.RemoteIP, "latency", request.Latency}
	if request.Error != nil {
		level = log.ErrorLevel
		fields = append(fields, "err", request.Error)
	}
	log.Log(level, "request", fields...)
	return nil
}

func addNamedRoute(e *echo.Echo, method, path, name string, handler echo.HandlerFunc) {
	route := echo.Route{Method: method, Path: path, Name: name, Handler: handler}
	if _, err := e.AddRoute(route); err != nil {
		panic(err)
	}
}
