import { useCallback, useEffect, useRef, useState } from 'react';

import { LogStore } from './useLogStore';
import { PodSocketResponse } from '@/types';
import { fetchLogHistory } from '@/data/Workloads/Pods/fetchLogHistory';
import { getEventStreamUrl } from '@/utils/MiscUtils';
import { useEventSource } from '@/components/app/Common/Hooks/EventSource';

const HISTORY_BATCH = 500;
const HISTORY_CEILING = 45000;

type Params = {
  pod: string;
  namespace: string;
  configName: string;
  clusterName: string;
  store: LogStore;
};

export function useLogStream({ pod, namespace, configName, clusterName, store }: Params) {
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const loadingRef = useRef(false);
  const hasMoreRef = useRef(true);
  const { append, clear, entriesRef, prependBatch } = store;

  useEffect(() => {
    clear();
    hasMoreRef.current = true;
    setHasMore(true);
    loadingRef.current = false;
    setIsLoadingHistory(false);
  }, [pod, namespace, clusterName, configName, clear]);

  const loadOlder = useCallback(async (): Promise<number> => {
    if (loadingRef.current || !hasMoreRef.current) return 0;
    const entries = entriesRef.current;
    if (!entries.length || entries.length > HISTORY_CEILING) return 0;

    const oldest = entries.find((e) => e.timestamp);
    if (!oldest) return 0;

    loadingRef.current = true;
    setIsLoadingHistory(true);
    try {
      const response = await fetchLogHistory(pod, {
        namespace,
        config: configName,
        cluster: clusterName,
        allContainers: true,
        before: oldest.timestamp,
        batchSize: HISTORY_BATCH,
      });
      // The API answers with logs: null (not []) when there is nothing older,
      // so this must not assume an array.
      const older = response?.logs ?? [];
      hasMoreRef.current = older.length > 0 && Boolean(response?.hasMore);
      setHasMore(hasMoreRef.current);
      return prependBatch(older);
    } catch {
      return 0;
    } finally {
      loadingRef.current = false;
      setIsLoadingHistory(false);
    }
  }, [pod, namespace, configName, clusterName, entriesRef, prependBatch]);

  // Every container is streamed; which ones are shown is a filter concern, so
  // changing the selection never tears down the connection.
  const sendMessage = (message: PodSocketResponse) => {
    if (!message?.log) return;
    append(message);
  };

  useEventSource({
    url: getEventStreamUrl(`pods/${pod}/logs`, {
      namespace,
      config: configName,
      cluster: clusterName,
      'all-containers': 'true',
    }),
    sendMessage,
  });

  return { isLoadingHistory, hasMore, loadOlder };
}
