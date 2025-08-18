import { useState, useEffect } from 'react';
import { appRoute, kwDetails } from '@/routes';

interface PrometheusAvailability {
  installed: boolean;
  reachable: boolean;
  namespace?: string;
  pod?: string;
  service?: string;
  port?: number;
  portName?: string;
}

export function usePrometheusAvailability() {
  const { config } = appRoute.useParams();
  const { cluster } = kwDetails.useSearch();
  const [availability, setAvailability] = useState<PrometheusAvailability | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!config || !cluster) {
      setLoading(false);
      return;
    }

    const checkAvailability = async () => {
      try {
        setLoading(true);
        setError(null);
        
        const params = new URLSearchParams({
          config,
          cluster
        });
        
        const response = await fetch(`/api/v1/metrics/prometheus/availability?${params}`);
        
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const data = await response.json();
        setAvailability(data);
      } catch (err) {
        console.error('Failed to check Prometheus availability:', err);
        setError(err instanceof Error ? err.message : 'Unknown error');
        setAvailability({ installed: false, reachable: false });
      } finally {
        setLoading(false);
      }
    };

    checkAvailability();
  }, [config, cluster]);

  return {
    availability,
    loading,
    error,
    isAvailable: availability?.installed && availability?.reachable
  };
}