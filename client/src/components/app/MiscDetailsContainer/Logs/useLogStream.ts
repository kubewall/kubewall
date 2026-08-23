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

/**
 * Why no more history is on offer, when it isn't simply that the pod has none:
 * 'buffer' - the client buffer is full, so we stop paging back regardless.
 * 'error'  - the last request failed; retrying is still worth it.
 */
export type HistoryLimit = 'buffer' | 'error' | null;

export function useLogStream({ pod, namespace, configName, clusterName, store }: Params) {
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [historyLimit, setHistoryLimit] = useState<HistoryLimit>(null);
  const loadingRef = useRef(false);
  const hasMoreRef = useRef(true);
  const { append, clear, entriesRef, prependBatch } = store;

  useEffect(() => {
    clear();
    hasMoreRef.current = true;
    setHasMore(true);
    setHistoryLimit(null);
    loadingRef.current = false;
    setIsLoadingHistory(false);
  }, [pod, namespace, clusterName, configName, clear]);

  // We will not page back any further, so stop offering it - otherwise "Load
  // older logs" stays enabled and silently does nothing on every click.
  const stopHistory = useCallback((reason: HistoryLimit) => {
    hasMoreRef.current = false;
    setHasMore(false);
    setHistoryLimit(reason);
    return 0;
  }, []);

  const loadOlder = useCallback(async (): Promise<number> => {
    if (loadingRef.current || !hasMoreRef.current) return 0;
    const entries = entriesRef.current;
    if (!entries.length) return 0;
    if (entries.length > HISTORY_CEILING) return stopHistory('buffer');

    // Nothing carries a timestamp, so there is no cursor to page back from.
    const oldest = entries.find((e) => e.timestamp);
    if (!oldest) return stopHistory(null);

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
      setHistoryLimit(null);
      return prependBatch(older);
    } catch {
      // Likely transient, so hasMore stays put and the button keeps working -
      // but say something, or the click looks like it did nothing.
      setHistoryLimit('error');
      return 0;
    } finally {
      loadingRef.current = false;
      setIsLoadingHistory(false);
    }
  }, [pod, namespace, configName, clusterName, entriesRef, prependBatch, stopHistory]);

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

  return { isLoadingHistory, hasMore, historyLimit, loadOlder };
}
