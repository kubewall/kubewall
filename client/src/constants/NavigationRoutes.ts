import { NavigationRoutes } from "@/types";

const NAVIGATION_ROUTE: NavigationRoutes = {
  'Cluster': [
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
  ]
};

export {
  NAVIGATION_ROUTE
};