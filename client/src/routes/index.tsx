import { Navigate, createRootRoute, createRoute, createRouter } from '@tanstack/react-router';
import { kwDetailsSearch, kwListSearch } from '@/types';

import FourOFourError from "@/components/app/Errors/404Error";
import GenericError from "@/components/app/Errors/GenericError";
import { App } from '@/app';
import { KubeConfiguration } from '@/components/app/KubeConfiguration';
import { KubeWall } from '@/KubeWall';
import { KwDetails } from '@/components/app/Common/Details';
import { KwList } from '@/components/app/Common/List';
import { CloudShellDetailsContainer } from '@/components/app/MiscDetailsContainer/CloudShellDetailsContainer';
import { HelmChartsOverview } from '@/components/app/HelmCharts/HelmChartsOverview';
import { Settings } from '@/components/app/Settings';
import { ClusterOverview } from '@/components/app/Overview/ClusterOverview';
import TracesDashboard from '@/components/app/Tracing/TracesDashboard';
import TraceDetails from '@/components/app/Tracing/TraceDetails';





const rootRoute = createRootRoute({
  component: () => <KubeWall />
});

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  component: () => <Navigate to="/config" />
});

const appRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/$config',
  component: App,
});

const kwList = createRoute({
  getParentRoute: () => appRoute,
  path: '/list',
  component: KwList,
  validateSearch: (search: Record<string, unknown>): kwListSearch => {
    return {
      cluster: String(search.cluster) || '',
      resourcekind: String(search.resourcekind) || '',
      ...(search.group ? {group: String(search.group)}: {}),
      ...(search.kind ? {kind: String(search.kind)}: {}),
      ...(search.resource ? {resource: String(search.resource)}: {}),
      ...(search.version ? {version: String(search.version)}: {}),
      ...(search.node ? {node: String(search.node)}: {}),
      ...(search.namespace ? {namespace: String(search.namespace)}: {}),
      ...(search.owner ? {owner: String(search.owner)}: {}),
      ...(search.ownerName ? {ownerName: String(search.ownerName)}: {}),
    };
  }
});

const kwDetails = createRoute({
  getParentRoute: () => appRoute,
  path: '/details',
  component: KwDetails,
  validateSearch: (search: Record<string, unknown>): kwDetailsSearch => ({
    cluster: String(search.cluster) || '',
    resourcekind: String(search.resourcekind) || '',
    resourcename: String(search.resourcename) || '',
    group: search.group ? String(search.group) : '',
    kind: search.kind? String(search.kind) : '',
    resource: search.resource ? String(search.resource) : '',
    version:search.version ? String(search.version) : '',
    namespace: search.namespace ? String(search.namespace) : '',
  })
});

const cloudShellRoute = createRoute({
  getParentRoute: () => appRoute,
  path: '/cloudshell',
  component: CloudShellDetailsContainer,
  validateSearch: (search: Record<string, unknown>) => ({
    cluster: String(search.cluster) || '',
    namespace: search.namespace ? String(search.namespace) : 'default',
  })
});

const helmChartsRoute = createRoute({
  getParentRoute: () => appRoute,
  path: '/helmcharts',
  component: HelmChartsOverview,
  validateSearch: (search: Record<string, unknown>) => ({
    cluster: String(search.cluster) || '',
    namespace: search.namespace ? String(search.namespace) : 'default',
  })
});

const settingsRoute = createRoute({
  getParentRoute: () => appRoute,
  path: '/settings',
  component: Settings,
  validateSearch: (search: Record<string, unknown>) => ({
    cluster: String(search.cluster) || '',
  })
});

const overviewRoute = createRoute({
  getParentRoute: () => appRoute,
  path: '/overview',
  component: ClusterOverview,
  validateSearch: (search: Record<string, unknown>) => ({
    cluster: String(search.cluster) || '',
  })
});

const tracesRoute = createRoute({
  getParentRoute: () => appRoute,
  path: '/tools/tracing',
  component: TracesDashboard,
  validateSearch: (search: Record<string, unknown>) => ({
    cluster: String(search.cluster) || '',
    service: search.service ? String(search.service) : undefined,
    operation: search.operation ? String(search.operation) : undefined,
    status: search.status ? String(search.status) : undefined,
  })
});

const traceDetailsRoute = createRoute({
  getParentRoute: () => appRoute,
  path: '/tools/tracing/$traceId',
  component: TraceDetails,
  validateSearch: (search: Record<string, unknown>) => ({
    cluster: String(search.cluster) || '',
  })
});







const kubeConfigurationRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/config',
  component: KubeConfiguration,
});

const routeTree = rootRoute.addChildren([
  indexRoute,
  kubeConfigurationRoute,
  appRoute.addChildren([
    kwList,
    kwDetails,
    cloudShellRoute,
    helmChartsRoute,
    settingsRoute,
    overviewRoute,
    tracesRoute,
    traceDetailsRoute
  ])
]);

const router = createRouter({
  routeTree,
  defaultNotFoundComponent: () => <FourOFourError />,
  defaultErrorComponent: () => <GenericError />,
  defaultPreload: 'intent',
  defaultStaleTime: 5000,
});

// Register things for typesafety
declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}

export { 
  router,
  kwList,
  kwDetails,
  cloudShellRoute,
  helmChartsRoute,
  appRoute,
  settingsRoute,
  overviewRoute,
  tracesRoute,
  traceDetailsRoute
};