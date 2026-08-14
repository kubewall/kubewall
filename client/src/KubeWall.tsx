import { Outlet, useRouterState } from "@tanstack/react-router";
import { useAppDispatch, useAppSelector } from "@/redux/hooks";

import { App } from "./app";
import { ClusterRail } from "@/components/app/ClusterRail";
import { fetchClusters } from "@/data/KwClusters/ClustersSlice";
import { useEffect } from "react";

export function KubeWall() {
  // Narrow selector (shallow-compared) so this component only re-renders
  // when the pathname actually changes, not on every router state transition.
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const dispatch = useAppDispatch();

  const configName = pathname.split('/')[1];
  const clusterName = new URL(location.href).searchParams.get('cluster') || '';
  const selectedResource = new URL(location.href).searchParams.get('resourcekind') || '';
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
