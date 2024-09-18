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
  component: () => <Navigate to="/kwconfig" />
});

const kwList = createRoute({
  getParentRoute: () => rootRoute,
  path: '/$config/$cluster/list',
  component: () => <AppWrapper component={<KwList />} />,
  validateSearch: (search: Record<string, unknown>): kwListSearch => {
    return {
      resourcekind: String(search.resourcekind) || '',
      ...(search.group ? {group: String(search.group)}: {}),
      ...(search.kind ? {kind: String(search.kind)}: {}),
      ...(search.resource ? {resource: String(search.resource)}: {}),
      ...(search.version ? {version: String(search.version)}: {}),
    };
  }
});

const kwDetails = createRoute({
  getParentRoute: () => rootRoute,
  path: '/$config/$cluster/details',
  component: () => <AppWrapper component={<KwDetails />} />,
  validateSearch: (search: Record<string, unknown>): kwDetailsSearch => ({
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
  path: '/kwconfig',
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