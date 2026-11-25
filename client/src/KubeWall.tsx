import { Outlet, useRouterState } from "@tanstack/react-router";
import { useAppDispatch, useAppSelector } from "@/redux/hooks";

import { App } from "./app";
import { ClusterRail } from "@/components/app/ClusterRail";
import { addonRoutes } from "@/addons/extensions";
import { fetchClusters } from "@/data/KwClusters/ClustersSlice";
import { useEffect } from "react";

// Pages that render bare, without the cluster rail and <App/> chrome. These
// mirror the `path` values in routes/index.tsx, which imports this module - so
// importing the route objects back from there would be a cycle.
const CHROMELESS_ROUTE_IDS: string[] = ['/kwconfig', '/'];

// Layout of an addon page (AddonRoute.layout); the route id is its path.
const addonLayout = (routeId: string) => addonRoutes.find((route) => route.path === routeId)?.layout;

export function KubeWall() {
  // Narrow selector (shallow-compared) so this component only re-renders when
  // pathname/search actually change, not on every router state transition. `search`
  // has to stay in here: switching cluster within one kubeconfig changes nothing but
  // `?cluster=`, so a pathname-only subscription never re-renders and the rail keeps
  // marking the previous cluster as current.
  const { pathname, search, isChromeless, isStandalone, isRailOnly } = useRouterState({
    select: (state) => ({
      pathname: state.location.pathname,
      search: state.location.search,
      isChromeless: state.matches.some((match) => CHROMELESS_ROUTE_IDS.includes(match.routeId) || addonLayout(match.routeId) === 'bare'),
      isStandalone: state.matches.some((match) => addonLayout(match.routeId) === 'bare'),
      isRailOnly: state.matches.some((match) => addonLayout(match.routeId) === 'rail'),
    }),
  });
  const dispatch = useAppDispatch();

  const configName = pathname.split('/')[1];
  const queryParams = new URLSearchParams(search);
  const clusterName = queryParams.get('cluster') || '';
  const selectedResource = queryParams.get('resourcekind') || '';
  const {
    clusters
  } = useAppSelector((state) => state.clusters);

  useEffect(() => {
    if (!isStandalone && !clusters.kubeConfigs) {
      dispatch(fetchClusters());
    }
  }, [isStandalone, clusters, dispatch]);

  if (isChromeless) {
    return <Outlet />;
  }

  return (
    <div className="flex h-screen">
      <ClusterRail
        configName={configName}
        clusterName={clusterName}
        selectedResource={selectedResource}
      />
      <div className="flex flex-1 overflow-hidden">{isRailOnly ? <Outlet /> : <App />}</div>
    </div>
  );
}
