import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { appRoute, kwDetails } from "@/routes";
import { getEventStreamUrl } from "@/utils";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  YAxis,
  XAxis,
  Tooltip,
  ReferenceLine,
  CartesianGrid,
} from 'recharts';

type MetricPoint = { timestamp: string; cpu: string; memory: string; cpuReq?: number; cpuLim?: number; memReq?: number; memLim?: number };

export default function PodMetricsChart() {
  const { config } = appRoute.useParams();
  const { cluster } = kwDetails.useSearch();
  const [points, setPoints] = useState<MetricPoint[]>([]);
  const esRef = useRef<EventSource | null>(null);
  const podNs = (window as any)?.__kwPodNamespace;
  const podName = (window as any)?.__kwPodName;
  const cpuReq = (window as any)?.__kwPodCpuRequest as number | undefined; // millicores
  const cpuLim = (window as any)?.__kwPodCpuLimit as number | undefined;   // millicores
  const memReq = (window as any)?.__kwPodMemRequest as number | undefined; // MiB
  const memLim = (window as any)?.__kwPodMemLimit as number | undefined;   // MiB

  // Generate initial data points when component mounts
  useEffect(() => {
    if (!podName || !podNs) return;
    
    // Create initial data points with current timestamp
    // const now = new Date().toISOString();
    const initialPoints: MetricPoint[] = [];
    
    // Generate 5 initial points with some baseline values
    for (let i = 4; i >= 0; i--) {
      const timestamp = new Date(Date.now() - i * 5000).toISOString(); // 5 second intervals
      initialPoints.push({
        timestamp,
        cpu: '0',
        memory: '0',
        cpuReq, cpuLim, memReq, memLim,
      });
    }
    
    setPoints(initialPoints);
  }, [podName, podNs, cpuReq, cpuLim, memReq, memLim]);

  useEffect(() => {
    if (!podName || !podNs) return;
    const url = getEventStreamUrl('pods', { config, cluster }, `/${podNs}/${podName}/metrics`);
    const es = new EventSource(url);
    esRef.current = es;
    es.onmessage = (evt) => {
      try {
        const data = JSON.parse(evt.data);
        const arr: MetricPoint[] = (Array.isArray(data) ? data : [data]).map((p: any) => ({
          ...p,
          cpu: String(parseInt(p.cpu?.replace('m','') || '0')),
          memory: String(parseInt(p.memory || '0')),
          cpuReq, cpuLim, memReq, memLim,
        }));
        setPoints((prev) => [...prev, ...arr].slice(-240));
      } catch {}
    };
    return () => { es.close(); esRef.current = null; };
  }, [config, cluster, podName, podNs, cpuReq, cpuLim, memReq, memLim]);

  const themeStroke = 'var(--border)';
  const tickColor = 'hsl(var(--foreground))'; // Better contrast for dark mode
  const axisColor = 'hsl(var(--border))'; // Better contrast for dark mode
  const cpuColor = 'rgb(59 130 246)';
  const memColor = 'rgb(139 92 246)'; // purple-ish like screenshot
  const limitColor = 'rgb(239 68 68)'; // red
  const requestColor = 'rgb(234 179 8)'; // amber

  // Build normalized data (percent of limit if present, else of request)
  const { chartData, cpuLines, memLines } = useMemo(() => {
    const denomCPU = cpuLim || cpuReq || Math.max(1, ...points.map(p => Number(p.cpu)));
    const denomMEM = memLim || memReq || Math.max(1, ...points.map(p => Number(p.memory)));
    const cpuReqPct = cpuReq ? (cpuReq / denomCPU) * 100 : undefined;
    const cpuLimPct = cpuLim ? (cpuLim / denomCPU) * 100 : (cpuReq ? undefined : 100);
    const memReqPct = memReq ? (memReq / denomMEM) * 100 : undefined;
    const memLimPct = memLim ? (memLim / denomMEM) * 100 : (memReq ? undefined : 100);
    const chartData = points.map(p => ({
      ts: p.timestamp,
      cpuPct: (Number(p.cpu) / denomCPU) * 100,
      memPct: (Number(p.memory) / denomMEM) * 100,
      cpuRaw: Number(p.cpu),
      memRaw: Number(p.memory),
    }));
    return {
      chartData,
      cpuLines: { req: cpuReqPct, lim: cpuLimPct },
      memLines: { req: memReqPct, lim: memLimPct },
    };
  }, [points, cpuReq, cpuLim, memReq, memLim]);

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload || payload.length === 0) return null;
    const row = chartData.find(d => d.ts === label);
    return (
      <div className="rounded border border-border bg-background/95 shadow-sm p-2 text-xs">
        <div className="text-[11px] text-muted-foreground mb-1">{label}</div>
        <div className="flex items-center gap-2">
          <span className="w-2 h-0.5 rounded" style={{backgroundColor: cpuColor}} />
          CPU: <span className="text-foreground">{row ? `${row.cpuRaw} m` : ''} ({(payload.find((p:any)=>p.dataKey==='cpuPct')?.value ?? 0).toFixed(1)}%)</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-2 h-0.5 rounded" style={{backgroundColor: memColor}} />
          Memory: <span className="text-foreground">{row ? `${row.memRaw} MiB` : ''} ({(payload.find((p:any)=>p.dataKey==='memPct')?.value ?? 0).toFixed(1)}%)</span>
        </div>
        {/* Show limits in tooltip */}
        {(cpuLim != null || memLim != null) && (
          <div className="mt-1 pt-1 border-t border-border">
            <div className="text-[10px] text-muted-foreground">Limits:</div>
            {cpuLim != null && (
              <div className="flex items-center gap-2">
                <span className="w-2 h-0.5 rounded" style={{backgroundColor: limitColor}} />
                CPU: <span className="text-foreground">{cpuLim}m (100%)</span>
              </div>
            )}
            {memLim != null && (
              <div className="flex items-center gap-2">
                <span className="w-2 h-0.5 rounded" style={{backgroundColor: limitColor}} />
                Memory: <span className="text-foreground">{memLim} MiB (100%)</span>
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <Card className="shadow-none rounded-lg mb-2">
      <CardHeader className="p-4">
        <CardTitle className="text-sm font-medium">Utilization</CardTitle>
      </CardHeader>
      <CardContent className="px-2 md:px-4">
        <div className="flex gap-4">
          {/* Single legend column */}
          <div className="min-w-[140px] text-xs text-muted-foreground space-y-2">
            <div className="font-medium text-foreground">Legend</div>
            <div className="flex items-center gap-2"><span className="w-3 h-0.5 rounded" style={{backgroundColor: cpuColor}} /> CPU</div>
            <div className="flex items-center gap-2"><span className="w-3 h-0.5 rounded" style={{backgroundColor: memColor}} /> Memory</div>
            {(cpuReq != null || memReq != null) && (
              <div className="flex items-center gap-2">
                <span className="w-3 h-0.5 rounded" style={{backgroundColor: requestColor}} /> Request
              </div>
            )}
            {(cpuLim != null || memLim != null) && (
              <div className="flex items-center gap-2">
                <span className="w-3 h-0.5 rounded" style={{backgroundColor: limitColor}} /> Limit
              </div>
            )}
            {/* Show actual limit values */}
            {cpuLim != null && (
              <div className="text-[10px] text-muted-foreground mt-1 pt-1 border-t border-border">
                CPU Limit: {cpuLim}m
              </div>
            )}
            {memLim != null && (
              <div className="text-[10px] text-muted-foreground">
                Memory Limit: {memLim} MiB
              </div>
            )}
          </div>
          {/* Single merged chart */}
          <div className="flex-1 h-72 bg-background/50 rounded border border-border p-2">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 12 }}>
                <defs>
                  <linearGradient id="cpuFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={cpuColor} stopOpacity={0.3}/>
                    <stop offset="95%" stopColor={cpuColor} stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="memFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={memColor} stopOpacity={0.3}/>
                    <stop offset="95%" stopColor={memColor} stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid stroke={themeStroke} strokeDasharray="3 3" />
                <XAxis 
                  dataKey="ts" 
                  tick={{ fill: tickColor, fontSize: 10 }} 
                  axisLine={{ stroke: axisColor }} 
                  tickLine={false} 
                  minTickGap={24}
                  tickFormatter={(value) => {
                    const date = new Date(value);
                    return date.toLocaleTimeString('en-US', { 
                      hour12: false, 
                      hour: '2-digit', 
                      minute: '2-digit', 
                      second: '2-digit' 
                    });
                  }}
                />
                <YAxis 
                  yAxisId="left" 
                  tick={{ fill: tickColor, fontSize: 10 }} 
                  axisLine={{ stroke: axisColor }} 
                  tickLine={false} 
                  ticks={[0,25,50,75,100]} 
                  domain={[0,100]} 
                  unit="%" 
                  width={36} 
                />
                <YAxis 
                  yAxisId="right" 
                  orientation="right" 
                  tick={{ fill: tickColor, fontSize: 10 }} 
                  axisLine={{ stroke: axisColor }} 
                  tickLine={false} 
                  ticks={[0,25,50,75,100]} 
                  domain={[0,100]} 
                  unit="%" 
                  width={36} 
                />
                <Tooltip cursor={{ stroke: 'var(--muted-foreground)', strokeDasharray: '3 3' }} content={<CustomTooltip />} />
                
                {/* Reference lines with better visibility */}
                {cpuLines.lim != null && (
                  <ReferenceLine 
                    yAxisId="left" 
                    y={cpuLines.lim} 
                    stroke={limitColor} 
                    strokeWidth={2}
                    strokeDasharray="4 4" 
                  />
                )}
                {cpuLines.req != null && (
                  <ReferenceLine 
                    yAxisId="left" 
                    y={cpuLines.req} 
                    stroke={requestColor} 
                    strokeWidth={2}
                    strokeDasharray="6 6" 
                  />
                )}
                {memLines.lim != null && (
                  <ReferenceLine 
                    yAxisId="right" 
                    y={memLines.lim} 
                    stroke={limitColor} 
                    strokeWidth={2}
                    strokeDasharray="4 4" 
                  />
                )}
                {memLines.req != null && (
                  <ReferenceLine 
                    yAxisId="right" 
                    y={memLines.req} 
                    stroke={requestColor} 
                    strokeWidth={2}
                    strokeDasharray="6 6" 
                  />
                )}
                
                <Area yAxisId="left" type="monotone" dataKey="cpuPct" name="CPU" stroke={cpuColor} fillOpacity={1} fill="url(#cpuFill)" dot={false} strokeWidth={2} />
                <Area yAxisId="right" type="monotone" dataKey="memPct" name="Memory" stroke={memColor} fillOpacity={1} fill="url(#memFill)" dot={false} strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}


