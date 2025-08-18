import { useEffect, useState } from "react";
import kwFetch from "@/data/kwFetch";
import { API_VERSION } from "@/constants";
import { appRoute, kwDetails } from "@/routes";
import NodeMetricsContainer from "@/components/app/NodeMetrics/NodeMetricsContainer";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function NodeMetricsSwitch() {
  const { config } = appRoute.useParams();
  const { cluster } = kwDetails.useSearch();
  const [hasProm, setHasProm] = useState<boolean | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let active = true;
    setIsLoading(true);
    const url = `${API_VERSION}/metrics/prometheus/availability?config=${encodeURIComponent(config)}&cluster=${encodeURIComponent(cluster)}`;
    kwFetch(url)
      .then((res: any) => {
        if (!active) return;
        setHasProm(Boolean(res?.installed && res?.reachable));
        setIsLoading(false);
      })
      .catch(() => { 
        if (active) {
          setHasProm(false);
          setIsLoading(false);
        }
      });
    return () => { active = false; };
  }, [config, cluster]);

  if (isLoading) {
    return (
      <Card className="shadow-none rounded-lg mb-4">
        <CardHeader className="p-4">
          <CardTitle className="text-sm font-medium">Node Metrics</CardTitle>
        </CardHeader>
        <CardContent className="px-4">
          <div className="flex items-center justify-center h-16">
            <div className="animate-pulse text-muted-foreground text-sm">Checking Prometheus availability...</div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!hasProm) {
    return (
      <Card className="shadow-none rounded-lg mb-4">
        <CardHeader className="p-4">
          <CardTitle className="text-sm font-medium">Node Metrics</CardTitle>
        </CardHeader>
        <CardContent className="px-4">
          <div className="text-center py-8">
            <div className="text-muted-foreground text-sm mb-2">
              Prometheus is not available or not reachable in this cluster.
            </div>
            <div className="text-xs text-muted-foreground">
              Node metrics require Prometheus to be installed and accessible.
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return <NodeMetricsContainer />;
}


