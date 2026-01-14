package middleware

import (
	"fmt"

	"github.com/kubewall/kubewall/backend/container"
	"github.com/kubewall/kubewall/backend/handlers/config/secrets"
	"github.com/kubewall/kubewall/backend/handlers/helpers"
	"github.com/kubewall/kubewall/backend/handlers/workloads/deployments"
	"github.com/labstack/echo/v4"

	"github.com/kubewall/kubewall/backend/handlers/accesscontrol/clusterroles"
	clusterrolebindings "github.com/kubewall/kubewall/backend/handlers/accesscontrol/clusterrolesbindings"
	"github.com/kubewall/kubewall/backend/handlers/accesscontrol/roles"
	rolebindings "github.com/kubewall/kubewall/backend/handlers/accesscontrol/rolesbindings"
	"github.com/kubewall/kubewall/backend/handlers/accesscontrol/serviceaccounts"
	configmaps "github.com/kubewall/kubewall/backend/handlers/config/configMaps"
	horizontalpodautoscalers "github.com/kubewall/kubewall/backend/handlers/config/horizontalPodAutoscalers"
	"github.com/kubewall/kubewall/backend/handlers/config/leases"
	limitranges "github.com/kubewall/kubewall/backend/handlers/config/limitRanges"
	poddisruptionbudgets "github.com/kubewall/kubewall/backend/handlers/config/podDisruptionBudgets"
	priorityclasses "github.com/kubewall/kubewall/backend/handlers/config/priorityClasses"
	resourcequotas "github.com/kubewall/kubewall/backend/handlers/config/resourceQuotas"
	runtimeclasses "github.com/kubewall/kubewall/backend/handlers/config/runtimeClasses"
	"github.com/kubewall/kubewall/backend/handlers/events"
	"github.com/kubewall/kubewall/backend/handlers/namespaces"
	"github.com/kubewall/kubewall/backend/handlers/network/endpoints"
	"github.com/kubewall/kubewall/backend/handlers/network/ingresses"
	"github.com/kubewall/kubewall/backend/handlers/network/services"
	"github.com/kubewall/kubewall/backend/handlers/nodes"
	"github.com/kubewall/kubewall/backend/handlers/storage/persistentvolumeclaims"
	"github.com/kubewall/kubewall/backend/handlers/storage/persistentvolumes"
	"github.com/kubewall/kubewall/backend/handlers/storage/storageclasses"
	cronjobs "github.com/kubewall/kubewall/backend/handlers/workloads/cronJobs"
	"github.com/kubewall/kubewall/backend/handlers/workloads/daemonsets"
	"github.com/kubewall/kubewall/backend/handlers/workloads/jobs"
	"github.com/kubewall/kubewall/backend/handlers/workloads/pods"
	"github.com/kubewall/kubewall/backend/handlers/workloads/replicaset"
	statefulset "github.com/kubewall/kubewall/backend/handlers/workloads/statefulsets"
)

func ClusterCacheMiddleware(container container.Container) echo.MiddlewareFunc {
	return func(next echo.HandlerFunc) echo.HandlerFunc {
		return func(c echo.Context) error {
			if shouldSkip(c) {
				return next(c)
			}

			config := c.QueryParam("config")
			cluster := c.QueryParam("cluster")

			allResourcesKey := fmt.Sprintf(helpers.AllResourcesCacheKeyFormat, config, cluster)

			// Safe access with nil checks
			kubeConfig, ok := container.Config().KubeConfig[config]
			if !ok || kubeConfig == nil {
				return c.JSON(400, "config not found")
			}

			conn, ok := kubeConfig.Clusters[cluster]
			if !ok || conn == nil {
				return c.JSON(400, "cluster not found in config")
			}

			if !conn.IsConnected() {
				conn.MarkAsConnected()
			}

			_, exists := container.Cache().GetIfPresent(allResourcesKey)
			if !exists {
				helpers.CacheAllResources(container, config, cluster)
				loadAllInformerOfCluster(c, container)
			}

			return next(c)
		}
	}
}

func loadAllInformerOfCluster(c echo.Context, container container.Container) {
	// Load critical workload informers first with higher priority
	// These are most frequently accessed and should be ready ASAP
	go func() {
		pods.NewPodsHandler(c, container)
		deployments.NewDeploymentsHandler(c, container)
		replicaset.NewReplicaSetHandler(c, container)
		services.NewServicesHandler(c, container)
		namespaces.NewNamespacesHandler(c, container)
	}()

	// Load remaining workload informers
	go func() {
		daemonsets.NewDaemonSetsHandler(c, container)
		statefulset.NewSatefulSetHandler(c, container)
		cronjobs.NewCronJobsHandler(c, container)
		jobs.NewJobsHandler(c, container)
	}()

	// Load storage informers
	go func() {
		persistentvolumeclaims.NewPersistentVolumeClaimsHandler(c, container)
		persistentvolumes.NewPersistentVolumeHandler(c, container)
		storageclasses.NewStorageClassesHandler(c, container)
	}()

	// Load config informers
	go func() {
		configmaps.NewConfigMapsHandler(c, container)
		secrets.NewSecretsHandler(c, container)
		resourcequotas.NewResourceQuotaHandler(c, container)
		horizontalpodautoscalers.NewHorizontalPodAutoScalerHandler(c, container)
		poddisruptionbudgets.NewPodDisruptionBudgetHandler(c, container)
		priorityclasses.NewPriorityClassHandler(c, container)
		runtimeclasses.NewRunTimeClassHandler(c, container)
		leases.NewLeasesHandler(c, container)
	}()

	// Load access control informers
	go func() {
		serviceaccounts.NewServiceAccountsHandler(c, container)
		roles.NewRolesHandler(c, container)
		rolebindings.NewRoleBindingHandler(c, container)
		clusterroles.NewRolesHandler(c, container)
		clusterrolebindings.NewClusterRoleBindingHandler(c, container)
	}()

	// Load network informers
	go func() {
		endpoints.NewEndpointsHandler(c, container)
		ingresses.NewIngressHandler(c, container)
		limitranges.NewLimitRangesHandler(c, container)
	}()

	// Load node and events informers
	go func() {
		nodes.NewNodeHandler(c, container)
		events.NewEventsHandler(c, container)
	}()
}
