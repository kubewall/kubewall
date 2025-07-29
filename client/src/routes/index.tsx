import { Navigate, createRootRoute, createRoute, createRouter } from '@tanstack/react-router';
import { kwDetailsSearch, kwListSearch } from '@/types';

import FourOFourError from "@/components/app/Errors/404Error";
import GenericError from "@/components/app/Errors/GenericError";
import { KubeConfiguration } from '@/components/app/KubeConfiguration';
import { KubeWall } from '@/KubeWall';
import { KwDetails } from '@/components/app/Common/Details';
import { KwList } from '@/components/app/Common/List';

const AppWrapper = ({ component }: { component: JSX.Element }) => {
  return (
    component
  );
};

const rootRoute = createRootRoute({
  component: () => <KubeWall />
});

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  component: () => <Navigate to="/config" />
});

const kwList = createRoute({
  getParentRoute: () => rootRoute,
  path: '/$config/list',
  component: () => <AppWrapper component={<KwList />} />,
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
  getParentRoute: () => rootRoute,
  path: '/$config/details',
  component: () => <AppWrapper component={<KwDetails />} />,
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



const kubeConfigurationRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/config',
  component: KubeConfiguration,
});

const routeTree = rootRoute.addChildren([
  indexRoute,
  kubeConfigurationRoute,
  kwList,
  kwDetails
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
  kwDetails
};