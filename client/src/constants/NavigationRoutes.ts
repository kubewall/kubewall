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
      name: 'Events',
      route: 'events'
    },
  ],
  'Workloads': [
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
    },
    {
      name: 'HPA',
      route: 'horizontalpodautoscalers'
    },

  ],
  'Access Control' :[
    {
      name: 'Service Accounts',
      route: 'serviceaccounts'
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
