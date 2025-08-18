import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ResponsiveContainer, LineChart, Line, YAxis, XAxis, Tooltip, CartesianGrid } from 'recharts';
import { useMemo } from 'react';
import { MetricSeries } from '@/data/Clusters/Nodes/NodeMetricsSlice';

interface NodeSummaryChartProps {
  series: MetricSeries[];
  loading?: boolean;
}

export default function NodeSummaryChart({ series, loading = false }: NodeSummaryChartProps) {
  // Extract CPU and Memory utilization ratio series
  const cpuUtilizationSeries = useMemo(() => {
    const cpuSeries = series.find(s => s.metric === 'cpu_utilization_ratio');
    return (cpuSeries?.points || []).map(p => ({ 
      ts: new Date(p.t * 1000).toISOString(), 
      cpu_utilization: (p.v * 100).toFixed(2) // Convert to percentage
    }));
  }, [series]);

  const memoryUtilizationSeries = useMemo(() => {
    const memSeries = series.find(s => s.metric === 'memory_utilization_ratio');
    return (memSeries?.points || []).map(p => ({ 
      ts: new Date(p.t * 1000).toISOString(), 
      memory_utilization: (p.v * 100).toFixed(2) // Convert to percentage
    }));
  }, [series]);

  // Merge the series data by timestamp
  const mergedData = useMemo(() => {
    const map = new Map<string, any>();
    
    // Add CPU utilization data
    for (const point of cpuUtilizationSeries) {
      map.set(point.ts, { ts: point.ts, cpu_utilization: parseFloat(point.cpu_utilization) });
    }
    
    // Add Memory utilization data
    for (const point of memoryUtilizationSeries) {
      const existing = map.get(point.ts) || { ts: point.ts };
      map.set(point.ts, { ...existing, memory_utilization: parseFloat(point.memory_utilization) });
    }
    
    return Array.from(map.values()).sort((a, b) => a.ts.localeCompare(b.ts));
  }, [cpuUtilizationSeries, memoryUtilizationSeries]);

  const themeStroke = 'var(--border)';
  const tickColor = 'hsl(var(--foreground))';
  const axisColor = 'hsl(var(--border))';
  const cpuColor = 'rgb(59 130 246)';
  const memColor = 'rgb(139 92 246)';

  if (loading) {
    return (
      <Card className="shadow-none rounded-lg">
        <CardHeader className="p-4">
          <CardTitle className="text-sm font-medium">Node Summary - CPU & Memory Utilization</CardTitle>
        </CardHeader>
        <CardContent className="px-2 md:px-4">
          <div className="flex gap-4">
            <div className="min-w-[140px] text-xs text-muted-foreground space-y-2">
              <div className="font-medium text-foreground">Legend</div>
              <div className="flex items-center gap-2"><span className="w-3 h-0.5 rounded" style={{backgroundColor: cpuColor}} /> CPU</div>
              <div className="flex items-center gap-2"><span className="w-3 h-0.5 rounded" style={{backgroundColor: memColor}} /> Memory</div>
            </div>
            <div className="flex-1 h-64 bg-background/50 rounded border border-border p-2 flex items-center justify-center">
              <div className="animate-pulse text-muted-foreground">Loading metrics...</div>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (mergedData.length === 0) {
    return (
      <Card className="shadow-none rounded-lg">
        <CardHeader className="p-4">
          <CardTitle className="text-sm font-medium">Node Summary - CPU & Memory Utilization</CardTitle>
        </CardHeader>
        <CardContent className="px-2 md:px-4">
          <div className="flex gap-4">
            <div className="min-w-[140px] text-xs text-muted-foreground space-y-2">
              <div className="font-medium text-foreground">Legend</div>
              <div className="flex items-center gap-2"><span className="w-3 h-0.5 rounded" style={{backgroundColor: cpuColor}} /> CPU</div>
              <div className="flex items-center gap-2"><span className="w-3 h-0.5 rounded" style={{backgroundColor: memColor}} /> Memory</div>
            </div>
            <div className="flex-1 h-64 bg-background/50 rounded border border-border p-2 flex items-center justify-center">
              <div className="text-muted-foreground text-sm">No utilization data available</div>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="shadow-none rounded-lg">
      <CardHeader className="p-4">
        <CardTitle className="text-sm font-medium">Node Summary - CPU & Memory Utilization</CardTitle>
        <div className="text-xs text-muted-foreground mt-1">
          Resource requests vs allocatable capacity ratios
        </div>
      </CardHeader>
      <CardContent className="px-2 md:px-4">
        <div className="flex gap-4">
          {/* Legend column */}
          <div className="min-w-[140px] text-xs text-muted-foreground space-y-2">
            <div className="font-medium text-foreground">Legend</div>
            <div className="flex items-center gap-2"><span className="w-3 h-0.5 rounded" style={{backgroundColor: cpuColor}} /> CPU Utilization</div>
            <div className="flex items-center gap-2"><span className="w-3 h-0.5 rounded" style={{backgroundColor: memColor}} /> Memory Utilization</div>
            <div className="text-[10px] text-muted-foreground mt-1 pt-1 border-t border-border">
              Resource requests vs capacity
            </div>
          </div>
          {/* Chart container */}
          <div className="flex-1 h-72 bg-background/50 rounded border border-border p-2">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={mergedData} margin={{ top: 10, right: 10, left: 0, bottom: 12 }}>
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
                      hour: '2-digit', 
                      minute: '2-digit',
                      hour12: false 
                    });
                  }}
                />
                <YAxis 
                  tick={{ fill: tickColor, fontSize: 10 }} 
                  axisLine={{ stroke: axisColor }}
                  tickLine={false} 
                  width={36}
                  domain={[0, 100]}
                  unit="%"
                />
                <Tooltip 
                  cursor={{ stroke: 'var(--muted-foreground)', strokeDasharray: '3 3' }}
                  content={({ active, payload, label }) => {
                    if (!active || !payload || payload.length === 0) return null;
                    return (
                      <div className="rounded border border-border bg-background/95 shadow-sm p-2 text-xs">
                        <div className="text-[11px] text-muted-foreground mb-1">{label}</div>
                        {payload.map((entry, index) => (
                          <div key={index} className="flex items-center gap-2">
                            <span className="w-2 h-0.5 rounded" style={{backgroundColor: entry.color}} />
                            {entry.dataKey === 'cpu_utilization' ? 'CPU' : 'Memory'}: <span className="text-foreground">{parseFloat(entry.value as string).toFixed(1)}%</span>
                          </div>
                        ))}
                      </div>
                    );
                  }}
                />
                <Line 
                  type="monotone" 
                  dataKey="cpu_utilization" 
                  name="CPU Utilization" 
                  stroke={cpuColor}
                  dot={false} 
                  strokeWidth={2}
                  connectNulls={false}
                />
                <Line 
                  type="monotone" 
                  dataKey="memory_utilization" 
                  name="Memory Utilization" 
                  stroke={memColor}
                  dot={false} 
                  strokeWidth={2}
                  connectNulls={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}