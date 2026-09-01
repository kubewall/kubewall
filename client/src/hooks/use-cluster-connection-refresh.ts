import { useAppDispatch, useAppSelector } from '@/redux/hooks';

import { RootState } from '@/redux/store';
import { fetchClusters } from '@/data/KwClusters/ClustersSlice';
import { useEffect } from 'react';

export function useClusterConnectionRefresh(config: string, cluster: string, loading: boolean): void {
  const dispatch = useAppDispatch();
  // A boolean, so this selector can't churn renders even while the fetch it
  // triggers is in flight.
  const connected = useAppSelector((state: RootState) =>
    !!state.clusters.clusters.kubeConfigs?.[config]?.clusters?.[cluster]?.connected
  );

  useEffect(() => {
    if (loading || connected) return;
    dispatch(fetchClusters());
  }, [loading, connected, config, cluster, dispatch]);
}
