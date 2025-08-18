import { NavigationRoutes } from "@/types";
import { isFeatureEnabled } from "./FeatureFlags";

const NAVIGATION_ROUTE: NavigationRoutes = {
  'Cluster': [
    {
      name: 'Overview',
      route: 'overview'
    },
    {
      name: 'Nodes',
      route: 'nodes'
    },
    {
      name: 'Namespaces',
      route: 'namespaces'
    },
    {
      name: 'Leases',
      route: 'leases'
    },
    {
      name: 'Events',
      route: 'events'
    },
  ],
  'Workloads': [
    {
      name: 'Pods',
      route: 'pods'
    },
    {
      name: 'Deployments',
      route: 'deployments'
    },
    {
      name: 'DaemonSets',
      route: 'daemonsets'
    },
    {
      name: 'StatefulSets',
      route: 'statefulsets'
    },
    {
      name: 'ReplicaSets',
      route: 'replicasets'
    },
    {
      name: 'Jobs',
      route: 'jobs'
    },
    {
      name: 'CronJobs',
      route: 'cronjobs'
    }
  ],
  'Configuration': [
    {
      name: 'Secrets',
      route: 'secrets'
    },
    {
      name: 'ConfigMaps',
      route: 'configmaps'
    },
    {
      name: 'HPA',
      route: 'horizontalpodautoscalers'
    },
    {
      name: 'Limit Ranges',
      route: 'limitranges'
    },
    {
      name: 'Resource Quotas',
      route: 'resourcequotas'
    },
    {
      name: 'Priority Classes',
      route: 'priorityclasses'
    },
    {
      name: 'Runtime Classes',
      route: 'runtimeclasses'
    },
    {
      name: 'Pod Disruption Budgets',
      route: 'poddisruptionbudgets'
    }
  ],
  'Access Control' :[
    {
      name: 'Service Accounts',
      route: 'serviceaccounts'
    },
    {
      name: 'Roles',
      route: 'roles'
    },
    {
      name: 'Role Bindings',
      route: 'rolebindings'
    },
    {
      name: 'Cluster Roles',
      route: 'clusterroles'
    },
    {
      name: 'Cluster Role Bindings',
      route: 'clusterrolebindings'
    },
  ],
  'Network':[
    {
      name: 'Services',
      route: 'services'
    },
    {
      name: 'Ingresses',
      route: 'ingresses'
    },
    {
      name: 'Endpoints',
      route: 'endpoints'
    },
  ],
  'Storage' :[
    {
      name: 'Persistent Volume Claims',
      route: 'persistentvolumeclaims'
    },
    {
      name: 'Persistent Volumes',
      route: 'persistentvolumes'
    },
    {
      name: 'Storage Classes',
      route: 'storageclasses'
    }
  ],
  'Helm': [
    {
      name: 'Releases',
      route: 'helmreleases'
    },
    {
      name: 'Charts',
      route: 'helmcharts'
    }
  ],
  'Tools': [
    {
      name: 'Cloud Shell',
      route: 'cloudshell'
    },
    {
      name: 'Tracing',
      route: 'tools/tracing'
    }
  ],
  'Preferences': [
    {
      name: 'Settings',
      route: 'settings'
    }
  ]
};

// Function to get navigation routes with feature flag filtering
export const getFilteredNavigationRoutes = (): NavigationRoutes => {
  const routes = { ...NAVIGATION_ROUTE };
  
  // Filter out tracing routes if feature is disabled
  if (!isFeatureEnabled('ENABLE_TRACING')) {
    routes['Tools'] = routes['Tools'].filter(route => 
      !route.route.includes('tracing')
    );
  }
  
  return routes;
};

export {
  NAVIGATION_ROUTE
};