import { Navigate, createRootRoute, createRoute, createRouter, lazyRouteComponent } from '@tanstack/react-router';
import { kwDetailsSearch, kwListSearch } from '@/types';

import FourOFourError from "@/components/app/Errors/404Error";
import GenericError from "@/components/app/Errors/GenericError";
import { KubeWall } from '@/KubeWall';

const AppWrapper = ({ component }: { component: JSX.Element }) => {
  return (
    component
  );
};

// Each top-level page becomes its own chunk, fetched (and preloaded on link
// intent, per defaultPreload below) only when a user navigates there instead
// of all landing in the single startup bundle.
const KubeConfigurationLazy = lazyRouteComponent(() => import('@/components/app/KubeConfiguration'), 'KubeConfiguration');
const KwListLazy = lazyRouteComponent(() => import('@/components/app/Common/List'), 'KwList');
const KwDetailsLazy = lazyRouteComponent(() => import('@/components/app/Common/Details'), 'KwDetails');

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
  path: '/$config/list',
  component: () => <AppWrapper component={<KwListLazy />} />,
  validateSearch: (search: Record<string, unknown>): kwListSearch => {
    return {
      cluster: String(search.cluster) || '',
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
  path: '/$config/details',
  component: () => <AppWrapper component={<KwDetailsLazy />} />,
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
  path: '/kwconfig',
  component: KubeConfigurationLazy,
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