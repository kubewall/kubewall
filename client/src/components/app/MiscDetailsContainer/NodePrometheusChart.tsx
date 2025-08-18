import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { appRoute, kwDetails } from "@/routes";
import { getEventStreamUrl } from "@/utils";
import { useEffect, useMemo, useRef, useState } from "react";
import { ResponsiveContainer, LineChart, Line, YAxis, XAxis, Tooltip, CartesianGrid, Legend } from 'recharts';

type Series = { metric: string; points: { t: number; v: number }[] };

export default function NodePrometheusChart() {
  const { config } = appRoute.useParams();
  const { cluster, resourcename } = kwDetails.useSearch();
  const [series, setSeries] = useState<Series[]>([]);
  const esRef = useRef<EventSource | null>(null);

  useEffect(() => {
    if (!resourcename) return;
    const url = getEventStreamUrl(
      `metrics/nodes`,
      { config, cluster },
      `/${encodeURIComponent(resourcename)}/prometheus`,
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
  }, [config, cluster, resourcename]);

  const sCPU = useMemo(() => (series.find(s => s.metric.includes('cpu'))?.points || []).map(p => ({ ts: new Date(p.t * 1000).toISOString(), cpu: p.v })), [series]);
  const sMEM = useMemo(() => (series.find(s => s.metric.includes('Mem'))?.points || series.find(s => s.metric.includes('memory'))?.points || []).map(p => ({ ts: new Date(p.t * 1000).toISOString(), mem: p.v })), [series]);
  const sFS = useMemo(() => (series.find(s => s.metric.includes('filesystem'))?.points || series.find(s => s.metric.includes('files'))?.points || []).map(p => ({ ts: new Date(p.t * 1000).toISOString(), fs: p.v })), [series]);
  const sRX = useMemo(() => (series.find(s => s.metric.includes('receive') || s.metric.includes('rx'))?.points || []).map(p => ({ ts: new Date(p.t * 1000).toISOString(), rx: p.v })), [series]);
  const sTX = useMemo(() => (series.find(s => s.metric.includes('transmit') || s.metric.includes('tx'))?.points || []).map(p => ({ ts: new Date(p.t * 1000).toISOString(), tx: p.v })), [series]);

  const merged = useMemo(() => {
    const map = new Map<string, any>();
    for (const p of sCPU) { map.set(p.ts, { ts: p.ts, cpu: p.cpu }); }
    for (const p of sMEM) { const prev = map.get(p.ts) || { ts: p.ts }; map.set(p.ts, { ...prev, mem: p.mem }); }
    for (const p of sFS) { const prev = map.get(p.ts) || { ts: p.ts }; map.set(p.ts, { ...prev, fs: p.fs }); }
    for (const p of sRX) { const prev = map.get(p.ts) || { ts: p.ts }; map.set(p.ts, { ...prev, rx: p.rx }); }
    for (const p of sTX) { const prev = map.get(p.ts) || { ts: p.ts }; map.set(p.ts, { ...prev, tx: p.tx }); }
    return Array.from(map.values()).sort((a, b) => a.ts.localeCompare(b.ts));
  }, [sCPU, sMEM, sFS, sRX, sTX]);

  const themeStroke = 'var(--border)';
  const tickColor = 'hsl(var(--foreground))';

  return (
    <Card className="shadow-none rounded-lg mb-2">
      <CardHeader className="p-4">
        <CardTitle className="text-sm font-medium">Node Metrics (Prometheus)</CardTitle>
      </CardHeader>
      <CardContent className="px-2 md:px-4">
        <div className="flex-1 h-64 bg-background/50 rounded border border-border p-2">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={merged} margin={{ top: 10, right: 10, left: 0, bottom: 12 }}>
              <CartesianGrid stroke={themeStroke} strokeDasharray="3 3" />
              <XAxis dataKey="ts" tick={{ fill: tickColor, fontSize: 10 }} tickLine={false} minTickGap={24} />
              <YAxis yAxisId="left" tick={{ fill: tickColor, fontSize: 10 }} tickLine={false} width={48} />
              <YAxis yAxisId="right" orientation="right" tick={{ fill: tickColor, fontSize: 10 }} tickLine={false} width={48} />
              <Tooltip />
              <Legend />
              <Line yAxisId="left" type="monotone" dataKey="cpu" name="CPU %" stroke="#3b82f6" dot={false} strokeWidth={2} />
              <Line yAxisId="left" type="monotone" dataKey="mem" name="Memory %" stroke="#8b5cf6" dot={false} strokeWidth={2} />
              <Line yAxisId="right" type="monotone" dataKey="fs" name="FS %" stroke="#ef4444" dot={false} strokeWidth={2} />
              <Line yAxisId="right" type="monotone" dataKey="rx" name="RX B/s" stroke="#22c55e" dot={false} strokeWidth={1.5} />
              <Line yAxisId="right" type="monotone" dataKey="tx" name="TX B/s" stroke="#eab308" dot={false} strokeWidth={1.5} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}


