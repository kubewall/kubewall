import { PodSocketResponse } from '@/types';
import kwFetch from '@/data/kwFetch';
import { API_VERSION } from '@/constants';

export type LogHistoryResponse = {
  logs: PodSocketResponse[];
  hasMore: boolean;
};

export async function fetchLogHistory(
  podName: string,
  params: {
    namespace: string;
    config: string;
    cluster: string;
    container?: string;
    allContainers?: boolean;
    before: string;
    batchSize?: number;
  }
): Promise<LogHistoryResponse> {
  const qp = new URLSearchParams({
    namespace: params.namespace,
    config: params.config,
    cluster: params.cluster,
    before: params.before,
    batchSize: String(params.batchSize ?? 500),
  });
  if (params.container) qp.set('container', params.container);
  if (params.allContainers) qp.set('all-containers', 'true');

  return kwFetch(`${API_VERSION}/pods/${podName}/logs/history?${qp}`);
}
