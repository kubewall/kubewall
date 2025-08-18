import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';
import { useMemo } from 'react';
import { MetricSeries } from '@/data/Clusters/Nodes/NodeMetricsSlice';

interface NodeMemoryBreakdownChartProps {
  series: MetricSeries[];
  loading?: boolean;
}



export default function NodeMemoryBreakdownChart({ series, loading = false }: NodeMemoryBreakdownChartProps) {
  // Extract memory breakdown time series
  const memoryBreakdownData = useMemo(() => {
    const usedSeries = series.find(s => s.metric === 'memory_used_bytes');
    const bufferedSeries = series.find(s => s.metric === 'memory_buffered_bytes');
    const cachedSeries = series.find(s => s.metric === 'memory_cached_bytes');
    const freeSeries = series.find(s => s.metric === 'memory_free_bytes');
    
    if (!usedSeries && !bufferedSeries && !cachedSeries && !freeSeries) {
      return [];
    }
    
    const map = new Map<string, any>();
    
    // Add used memory data
    (usedSeries?.points || []).forEach(p => {
      const ts = new Date(p.t * 1000).toISOString();
      map.set(ts, { ts, used: p.v });
    });
    
    // Add buffered memory data
    (bufferedSeries?.points || []).forEach(p => {
      const ts = new Date(p.t * 1000).toISOString();
      const existing = map.get(ts) || { ts };
      map.set(ts, { ...existing, buffered: p.v });
    });
    
    // Add cached memory data
    (cachedSeries?.points || []).forEach(p => {
      const ts = new Date(p.t * 1000).toISOString();
      const existing = map.get(ts) || { ts };
      map.set(ts, { ...existing, cached: p.v });
    });
    
    // Add free memory data
    (freeSeries?.points || []).forEach(p => {
      const ts = new Date(p.t * 1000).toISOString();
      const existing = map.get(ts) || { ts };
      map.set(ts, { ...existing, free: p.v });
    });
    
    return Array.from(map.values())
      .filter(item => 
        item.used !== undefined || 
        item.buffered !== undefined || 
        item.cached !== undefined || 
        item.free !== undefined
      )
      .sort((a, b) => a.ts.localeCompare(b.ts))
      .map(item => {
        const used = item.used || 0;
        const buffered = item.buffered || 0;
        const cached = item.cached || 0;
        const free = item.free || 0;
        const total = used + buffered + cached + free;
        
        return {
          ...item,
          used,
          buffered,
          cached,
          free,
          total,
          // Convert to GB for display
          usedGB: (used / (1024 ** 3)).toFixed(2),
          bufferedGB: (buffered / (1024 ** 3)).toFixed(2),
          cachedGB: (cached / (1024 ** 3)).toFixed(2),
          freeGB: (free / (1024 ** 3)).toFixed(2),
          totalGB: (total / (1024 ** 3)).toFixed(2),
          // Calculate percentages
          usedPercent: total > 0 ? ((used / total) * 100).toFixed(1) : '0',
          bufferedPercent: total > 0 ? ((buffered / total) * 100).toFixed(1) : '0',
          cachedPercent: total > 0 ? ((cached / total) * 100).toFixed(1) : '0',
          freePercent: total > 0 ? ((free / total) * 100).toFixed(1) : '0'
        };
      });
  }, [series]);

  const themeStroke = 'var(--border)';
  const tickColor = 'hsl(var(--foreground))';
  const axisColor = 'hsl(var(--border))';
  const usedColor = 'rgb(239 68 68)';
  const bufferedColor = 'rgb(245 158 11)';
  const cachedColor = 'rgb(59 130 246)';
  const freeColor = 'rgb(34 197 94)';

  if (loading) {
    return (
      <Card className="shadow-none rounded-lg">
        <CardHeader className="p-4">
          <CardTitle className="text-sm font-medium">Memory Usage Breakdown</CardTitle>
        </CardHeader>
        <CardContent className="px-2 md:px-4">
          <div className="flex gap-4">
            <div className="min-w-[140px] text-xs text-muted-foreground space-y-2">
              <div className="font-medium text-foreground">Legend</div>
              <div className="flex items-center gap-2"><span className="w-3 h-0.5 rounded" style={{backgroundColor: usedColor}} /> Used</div>
              <div className="flex items-center gap-2"><span className="w-3 h-0.5 rounded" style={{backgroundColor: bufferedColor}} /> Buffered</div>
              <div className="flex items-center gap-2"><span className="w-3 h-0.5 rounded" style={{backgroundColor: cachedColor}} /> Cached</div>
              <div className="flex items-center gap-2"><span className="w-3 h-0.5 rounded" style={{backgroundColor: freeColor}} /> Free</div>
            </div>
            <div className="flex-1 h-72 bg-background/50 rounded border border-border p-2 flex items-center justify-center">
              <div className="animate-pulse text-muted-foreground">Loading memory breakdown...</div>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (memoryBreakdownData.length === 0) {
    return (
      <Card className="shadow-none rounded-lg">
        <CardHeader className="p-4">
          <CardTitle className="text-sm font-medium">Memory Usage Breakdown</CardTitle>
        </CardHeader>
        <CardContent className="px-2 md:px-4">
          <div className="flex gap-4">
            <div className="min-w-[140px] text-xs text-muted-foreground space-y-2">
              <div className="font-medium text-foreground">Legend</div>
              <div className="flex items-center gap-2"><span className="w-3 h-0.5 rounded" style={{backgroundColor: usedColor}} /> Used</div>
              <div className="flex items-center gap-2"><span className="w-3 h-0.5 rounded" style={{backgroundColor: bufferedColor}} /> Buffered</div>
              <div className="flex items-center gap-2"><span className="w-3 h-0.5 rounded" style={{backgroundColor: cachedColor}} /> Cached</div>
              <div className="flex items-center gap-2"><span className="w-3 h-0.5 rounded" style={{backgroundColor: freeColor}} /> Free</div>
            </div>
            <div className="flex-1 h-72 bg-background/50 rounded border border-border p-2 flex items-center justify-center">
              <div className="text-muted-foreground text-sm">No memory breakdown data available</div>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="shadow-none rounded-lg">
      <CardHeader className="p-4">
        <CardTitle className="text-sm font-medium">Memory Usage Breakdown</CardTitle>
        <div className="text-xs text-muted-foreground mt-1">
          Used, Buffered, Cached, and Free memory over time
        </div>
      </CardHeader>
      <CardContent className="px-2 md:px-4">
        <div className="flex gap-4">
          {/* Legend column */}
          <div className="min-w-[140px] text-xs text-muted-foreground space-y-2">
            <div className="font-medium text-foreground">Legend</div>
            <div className="flex items-center gap-2"><span className="w-3 h-0.5 rounded" style={{backgroundColor: usedColor}} /> Used Memory</div>
            <div className="flex items-center gap-2"><span className="w-3 h-0.5 rounded" style={{backgroundColor: bufferedColor}} /> Buffered Memory</div>
            <div className="flex items-center gap-2"><span className="w-3 h-0.5 rounded" style={{backgroundColor: cachedColor}} /> Cached Memory</div>
            <div className="flex items-center gap-2"><span className="w-3 h-0.5 rounded" style={{backgroundColor: freeColor}} /> Free Memory</div>
            {memoryBreakdownData.length > 0 && (
              <div className="text-[10px] text-muted-foreground mt-1 pt-1 border-t border-border">
                Current values:
                <br />Used: {memoryBreakdownData[memoryBreakdownData.length - 1]?.usedGB || '0'} GB
                <br />Buffered: {memoryBreakdownData[memoryBreakdownData.length - 1]?.bufferedGB || '0'} GB
                <br />Cached: {memoryBreakdownData[memoryBreakdownData.length - 1]?.cachedGB || '0'} GB
                <br />Free: {memoryBreakdownData[memoryBreakdownData.length - 1]?.freeGB || '0'} GB
              </div>
            )}
          </div>
          {/* Chart container */}
          <div className="flex-1 h-72 bg-background/50 rounded border border-border p-2">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={memoryBreakdownData} margin={{ top: 10, right: 10, left: 0, bottom: 12 }}>
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
                  tickFormatter={(value) => `${(value / (1024 ** 3)).toFixed(1)}GB`}
                />
                <Tooltip 
                  cursor={{ stroke: 'var(--muted-foreground)', strokeDasharray: '3 3' }}
                  content={({ active, payload, label }) => {
                    if (!active || !payload || payload.length === 0) return null;
                    return (
                      <div className="rounded border border-border bg-background/95 shadow-sm p-2 text-xs">
                        <div className="text-[11px] text-muted-foreground mb-1">{label}</div>
                        {payload.map((entry, index) => {
                          const gbValue = ((entry.value as number) / (1024 ** 3)).toFixed(2);
                          let displayName = entry.dataKey as string;
                          let percentage = '0%';
                          
                          switch (entry.dataKey) {
                            case 'used':
                              displayName = 'Used';
                              percentage = `${entry.payload.usedPercent}%`;
                              break;
                            case 'buffered':
                              displayName = 'Buffered';
                              percentage = `${entry.payload.bufferedPercent}%`;
                              break;
                            case 'cached':
                              displayName = 'Cached';
                              percentage = `${entry.payload.cachedPercent}%`;
                              break;
                            case 'free':
                              displayName = 'Free';
                              percentage = `${entry.payload.freePercent}%`;
                              break;
                          }
                          
                          return (
                            <div key={index} className="flex items-center gap-2">
                              <span className="w-2 h-0.5 rounded" style={{backgroundColor: entry.color}} />
                              {displayName}: <span className="text-foreground">{gbValue} GB ({percentage})</span>
                            </div>
                          );
                        })}
                      </div>
                    );
                  }}
                />
                
                {/* Stack areas from bottom to top */}
                <Area
                  type="monotone"
                  dataKey="free"
                  stackId="1"
                  name="Free Memory"
                  stroke={freeColor}
                  fill={freeColor}
                  fillOpacity={0.6}
                />
                <Area
                  type="monotone"
                  dataKey="cached"
                  stackId="1"
                  name="Cached Memory"
                  stroke={cachedColor}
                  fill={cachedColor}
                  fillOpacity={0.6}
                />
                <Area
                  type="monotone"
                  dataKey="buffered"
                  stackId="1"
                  name="Buffered Memory"
                  stroke={bufferedColor}
                  fill={bufferedColor}
                  fillOpacity={0.6}
                />
                <Area
                  type="monotone"
                  dataKey="used"
                  stackId="1"
                  name="Used Memory"
                  stroke={usedColor}
                  fill={usedColor}
                  fillOpacity={0.8}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}