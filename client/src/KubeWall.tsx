import { Outlet, useRouterState } from "@tanstack/react-router";
import { useAppDispatch, useAppSelector } from "@/redux/hooks";

import { App } from "./app";
import { ClusterRail } from "@/components/app/ClusterRail";
import { fetchClusters } from "@/data/KwClusters/ClustersSlice";
import { useEffect } from "react";

export function KubeWall() {
  // Narrow selector (shallow-compared) so this component only re-renders when
  // pathname/search actually change, not on every router state transition. `search`
  // has to stay in here: switching cluster within one kubeconfig changes nothing but
  // `?cluster=`, so a pathname-only subscription never re-renders and the rail keeps
  // marking the previous cluster as current.
  const { pathname, search } = useRouterState({
    select: (state) => ({ pathname: state.location.pathname, search: state.location.search }),
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
    if (!clusters.kubeConfigs) {
      dispatch(fetchClusters());
    }
  }, [clusters, dispatch]);

  if (pathname === '/kwconfig' || pathname === '/') {
    return <Outlet />;
  }

  return (
    <div className="flex h-screen">
      <ClusterRail
        configName={configName}
        clusterName={clusterName}
        selectedResource={selectedResource}
      />
      <div className="flex flex-1 overflow-hidden"><App /></div>
    </div>
  );
}
