package middleware

import (
	"fmt"

	"github.com/kubewall/kubewall/backend/container"
	"github.com/kubewall/kubewall/backend/handlers/helpers"
	"github.com/kubewall/kubewall/backend/handlers/workloads/deployments"
	"github.com/labstack/echo/v4"

	"github.com/kubewall/kubewall/backend/handlers/accesscontrol/serviceaccounts"
	horizontalpodautoscalers "github.com/kubewall/kubewall/backend/handlers/config/horizontalPodAutoscalers"
	"github.com/kubewall/kubewall/backend/handlers/config/leases"
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

			conn := container.Config().KubeConfig[config].Clusters[cluster]
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
	// go pods.NewPodsHandler(c, container)
	go deployments.NewDeploymentsHandler(c, container)
	go daemonsets.NewDaemonSetsHandler(c, container)
	go replicaset.NewReplicaSetHandler(c, container)
	go statefulset.NewSatefulSetHandler(c, container)
	go cronjobs.NewCronJobsHandler(c, container)
	go jobs.NewJobsHandler(c, container)

	// Storage
	go persistentvolumeclaims.NewPersistentVolumeClaimsHandler(c, container)
	go persistentvolumes.NewPersistentVolumeHandler(c, container)
	go storageclasses.NewStorageClassesHandler(c, container)

	// Config
	// go configmaps.NewConfigMapsHandler(c, container)
	// go secrets.NewSecretsHandler(c, container)
	// go resourcequotas.NewResourceQuotaHandler(c, container)
	go namespaces.NewNamespacesHandler(c, container)
	go horizontalpodautoscalers.NewHorizontalPodAutoScalerHandler(c, container)
	// go poddisruptionbudgets.NewPodDisruptionBudgetHandler(c, container)
	// go priorityclasses.NewPriorityClassHandler(c, container)
	// go runtimeclasses.NewRunTimeClassHandler(c, container)
	go leases.NewLeasesHandler(c, container)

	// AccessControl
	go serviceaccounts.NewServiceAccountsHandler(c, container)
	// go roles.NewRolesHandler(c, container)
	// go rolebindings.NewRoleBindingHandler(c, container)
	// go clusterroles.NewRolesHandler(c, container)
	// go clusterrolebindings.NewClusterRoleBindingHandler(c, container)

	// Network
	go endpoints.NewEndpointsHandler(c, container)
	go ingresses.NewIngressHandler(c, container)
	go services.NewServicesHandler(c, container)
	// go limitranges.NewLimitRangesHandler(c, container)

	go nodes.NewNodeHandler(c, container)
	go events.NewEventsHandler(c, container)
}
