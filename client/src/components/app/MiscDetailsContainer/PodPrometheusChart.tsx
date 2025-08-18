import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { appRoute, kwDetails } from "@/routes";
import { getEventStreamUrl } from "@/utils";
import { useEffect, useMemo, useRef, useState } from "react";
import { ResponsiveContainer, AreaChart, Area, YAxis, XAxis, Tooltip, CartesianGrid } from 'recharts';

type Series = { metric: string; points: { t: number; v: number }[] };

export default function PodPrometheusChart() {
  const { config } = appRoute.useParams();
  const { cluster } = kwDetails.useSearch();
  const podNs = (window as any)?.__kwPodNamespace as string | undefined;
  const podName = (window as any)?.__kwPodName as string | undefined;
  const [series, setSeries] = useState<Series[]>([]);
  const esRef = useRef<EventSource | null>(null);

  useEffect(() => {
    if (!podName || !podNs) return;
    const url = getEventStreamUrl(
      `metrics/pods`,
      { config, cluster },
      `/${encodeURIComponent(podNs)}/${encodeURIComponent(podName)}/prometheus`,
      `&range=15m&step=15s`
    );
    const es = new EventSource(url);
    esRef.current = es;
    es.onmessage = (evt) => {
      try {
        const data = JSON.parse(evt.data);
        const s: Series[] = Array.isArray(data?.series) ? data.series : [];
        setSeries(s);
      } catch {}
    };
    return () => { es.close(); esRef.current = null; };
  }, [config, cluster, podName, podNs]);

  const cpuPoints = useMemo(() => (series.find(s => s.metric.includes('cpu'))?.points || []).map(p => ({ ts: new Date(p.t * 1000).toISOString(), cpu: p.v })), [series]);
  const memPoints = useMemo(() => (series.find(s => s.metric.includes('memory'))?.points || []).map(p => ({ ts: new Date(p.t * 1000).toISOString(), mem: p.v / (1024 * 1024) })), [series]);

  const merged = useMemo(() => {
    const map = new Map<string, any>();
    for (const p of cpuPoints) {
      map.set(p.ts, { ts: p.ts, cpu: p.cpu });
    }
    for (const p of memPoints) {
      const prev = map.get(p.ts) || { ts: p.ts };
      map.set(p.ts, { ...prev, mem: p.mem });
    }
    return Array.from(map.values()).sort((a, b) => a.ts.localeCompare(b.ts));
  }, [cpuPoints, memPoints]);

  const themeStroke = 'var(--border)';
  const tickColor = 'hsl(var(--foreground))';
  const cpuColor = 'rgb(59 130 246)';
  const memColor = 'rgb(139 92 246)';

  return (
    <Card className="shadow-none rounded-lg mb-2">
      <CardHeader className="p-4">
        <CardTitle className="text-sm font-medium">Utilization (Prometheus)</CardTitle>
      </CardHeader>
      <CardContent className="px-2 md:px-4">
        <div className="flex-1 h-64 bg-background/50 rounded border border-border p-2">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={merged} margin={{ top: 10, right: 10, left: 0, bottom: 12 }}>
              <defs>
                <linearGradient id="cpuFillP" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={cpuColor} stopOpacity={0.3}/>
                  <stop offset="95%" stopColor={cpuColor} stopOpacity={0}/>
                </linearGradient>
                <linearGradient id="memFillP" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={memColor} stopOpacity={0.3}/>
                  <stop offset="95%" stopColor={memColor} stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid stroke={themeStroke} strokeDasharray="3 3" />
              <XAxis dataKey="ts" tick={{ fill: tickColor, fontSize: 10 }} tickLine={false} minTickGap={24} />
              <YAxis yAxisId="left" tick={{ fill: tickColor, fontSize: 10 }} tickLine={false} width={48} />
              <YAxis yAxisId="right" orientation="right" tick={{ fill: tickColor, fontSize: 10 }} tickLine={false} width={48} />
              <Tooltip />
              <Area yAxisId="left" type="monotone" dataKey="cpu" name="CPU (m)" stroke={cpuColor} fillOpacity={1} fill="url(#cpuFillP)" dot={false} strokeWidth={2} />
              <Area yAxisId="right" type="monotone" dataKey="mem" name="Memory (MiB)" stroke={memColor} fillOpacity={1} fill="url(#memFillP)" dot={false} strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}


