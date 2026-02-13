package middleware

import (
	"context"
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
				loadAllInformerOfCluster(config, cluster, container)
			}

			return next(c)
		}
	}
}

func loadAllInformerOfCluster(config, cluster string, container container.Container) {
	ctx := context.Background()

	// Load critical workload informers first with higher priority
	// These are most frequently accessed and should be ready ASAP
	go func() {
		pods.NewPodsHandler(ctx, config, cluster, container)
		deployments.NewDeploymentsHandler(ctx, config, cluster, container)
		replicaset.NewReplicaSetHandler(ctx, config, cluster, container)
		services.NewServicesHandler(ctx, config, cluster, container)
		namespaces.NewNamespacesHandler(ctx, config, cluster, container)
	}()

	// Load remaining workload informers
	go func() {
		daemonsets.NewDaemonSetsHandler(ctx, config, cluster, container)
		statefulset.NewSatefulSetHandler(ctx, config, cluster, container)
		cronjobs.NewCronJobsHandler(ctx, config, cluster, container)
		jobs.NewJobsHandler(ctx, config, cluster, container)
	}()

	// Load storage informers
	go func() {
		persistentvolumeclaims.NewPersistentVolumeClaimsHandler(ctx, config, cluster, container)
		persistentvolumes.NewPersistentVolumeHandler(ctx, config, cluster, container)
		storageclasses.NewStorageClassesHandler(ctx, config, cluster, container)
	}()

	// Load config informers
	go func() {
		configmaps.NewConfigMapsHandler(ctx, config, cluster, container)
		secrets.NewSecretsHandler(ctx, config, cluster, container)
		resourcequotas.NewResourceQuotaHandler(ctx, config, cluster, container)
		horizontalpodautoscalers.NewHorizontalPodAutoScalerHandler(ctx, config, cluster, container)
		poddisruptionbudgets.NewPodDisruptionBudgetHandler(ctx, config, cluster, container)
		priorityclasses.NewPriorityClassHandler(ctx, config, cluster, container)
		runtimeclasses.NewRunTimeClassHandler(ctx, config, cluster, container)
		leases.NewLeasesHandler(ctx, config, cluster, container)
	}()

	// Load access control informers
	go func() {
		serviceaccounts.NewServiceAccountsHandler(ctx, config, cluster, container)
		roles.NewRolesHandler(ctx, config, cluster, container)
		rolebindings.NewRoleBindingHandler(ctx, config, cluster, container)
		clusterroles.NewRolesHandler(ctx, config, cluster, container)
		clusterrolebindings.NewClusterRoleBindingHandler(ctx, config, cluster, container)
	}()

	// Load network informers
	go func() {
		endpoints.NewEndpointsHandler(ctx, config, cluster, container)
		ingresses.NewIngressHandler(ctx, config, cluster, container)
		limitranges.NewLimitRangesHandler(ctx, config, cluster, container)
	}()

	// Load node and events informers
	go func() {
		nodes.NewNodeHandler(ctx, config, cluster, container)
		events.NewEventsHandler(ctx, config, cluster, container)
	}()
}
