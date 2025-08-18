import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';
import { useMemo } from 'react';
import { MetricSeries, InstantMetrics } from '@/data/Clusters/Nodes/NodeMetricsSlice';

interface NodeDiskUsageChartProps {
  series: MetricSeries[];
  instant?: InstantMetrics | null;
  loading?: boolean;
}



export default function NodeDiskUsageChart({ series, loading = false }: NodeDiskUsageChartProps) {
  // Extract disk usage time series
  const diskUsageData = useMemo(() => {
    const usedSeries = series.find(s => s.metric === 'disk_used_bytes');
    const availableSeries = series.find(s => s.metric === 'disk_available_bytes');
    
    if (!usedSeries && !availableSeries) return [];
    
    const map = new Map<number, any>();
    
    // Add used disk data
    (usedSeries?.points || []).forEach(p => {
      const ts = p.t * 1000;
      map.set(ts, { ts, used: p.v });
    });
    
    // Add available disk data
    (availableSeries?.points || []).forEach(p => {
      const ts = p.t * 1000;
      const existing = map.get(ts) || { ts };
      map.set(ts, { ...existing, available: p.v });
    });
    
    return Array.from(map.values())
      .filter(item => 
        item.used !== undefined || 
        item.available !== undefined
      )
      .sort((a, b) => a.ts - b.ts)
      .map(item => {
        const total = (item.used || 0) + (item.available || 0);
        return {
          ...item,
          total,
          usedGB: ((item.used || 0) / (1024 ** 3)).toFixed(2),
          availableGB: ((item.available || 0) / (1024 ** 3)).toFixed(2),
          usedPercent: total > 0 ? (((item.used || 0) / total) * 100).toFixed(1) : '0',
          availablePercent: total > 0 ? (((item.available || 0) / total) * 100).toFixed(1) : '0'
        };
      });
  }, [series]);

  const themeStroke = 'var(--border)';
  const tickColor = 'hsl(var(--foreground))';
  const axisColor = 'hsl(var(--border))';
  const usedColor = 'rgb(239 68 68)';
  const availableColor = 'rgb(34 197 94)';

  if (loading) {
    return (
      <Card className="shadow-none rounded-lg">
        <CardHeader className="p-4">
          <CardTitle className="text-sm font-medium">Disk Usage Breakdown</CardTitle>
        </CardHeader>
        <CardContent className="px-2 md:px-4">
          <div className="flex gap-4">
            <div className="min-w-[140px] text-xs text-muted-foreground space-y-2">
              <div className="font-medium text-foreground">Legend</div>
              <div className="flex items-center gap-2"><span className="w-3 h-0.5 rounded" style={{backgroundColor: usedColor}} /> Used</div>
              <div className="flex items-center gap-2"><span className="w-3 h-0.5 rounded" style={{backgroundColor: availableColor}} /> Available</div>
            </div>
            <div className="flex-1 h-72 bg-background/50 rounded border border-border p-2 flex items-center justify-center">
              <div className="animate-pulse text-muted-foreground">Loading disk metrics...</div>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (diskUsageData.length === 0) {
    return (
      <Card className="shadow-none rounded-lg">
        <CardHeader className="p-4">
          <CardTitle className="text-sm font-medium">Disk Usage Breakdown</CardTitle>
        </CardHeader>
        <CardContent className="px-2 md:px-4">
          <div className="flex gap-4">
            <div className="min-w-[140px] text-xs text-muted-foreground space-y-2">
              <div className="font-medium text-foreground">Legend</div>
              <div className="flex items-center gap-2"><span className="w-3 h-0.5 rounded" style={{backgroundColor: usedColor}} /> Used</div>
              <div className="flex items-center gap-2"><span className="w-3 h-0.5 rounded" style={{backgroundColor: availableColor}} /> Available</div>
            </div>
            <div className="flex-1 h-72 bg-background/50 rounded border border-border p-2 flex items-center justify-center">
              <div className="text-muted-foreground text-sm">No disk usage data available</div>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="shadow-none rounded-lg">
      <CardHeader className="p-4">
        <CardTitle className="text-sm font-medium">Disk Usage Breakdown</CardTitle>
        <div className="text-xs text-muted-foreground mt-1">
          Used and Available disk space over time
        </div>
      </CardHeader>
      <CardContent className="px-2 md:px-4">
        <div className="flex gap-4">
          {/* Legend column */}
          <div className="min-w-[140px] text-xs text-muted-foreground space-y-2">
            <div className="font-medium text-foreground">Legend</div>
            <div className="flex items-center gap-2"><span className="w-3 h-0.5 rounded" style={{backgroundColor: usedColor}} /> Used Disk</div>
            <div className="flex items-center gap-2"><span className="w-3 h-0.5 rounded" style={{backgroundColor: availableColor}} /> Available Disk</div>
            {diskUsageData.length > 0 && (
              <div className="text-[10px] text-muted-foreground mt-1 pt-1 border-t border-border">
                Used: {diskUsageData[diskUsageData.length - 1]?.usedGB || '0'} GB
                <br />Available: {diskUsageData[diskUsageData.length - 1]?.availableGB || '0'} GB
              </div>
            )}
          </div>
          {/* Chart container */}
          <div className="flex-1 h-72 bg-background/50 rounded border border-border p-2">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={diskUsageData} margin={{ top: 10, right: 10, left: 0, bottom: 12 }}>
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
                  tickFormatter={(value) => `${(value / (1024 ** 3)).toFixed(0)}GB`}
                />
                <Tooltip 
                  cursor={{ stroke: 'var(--muted-foreground)', strokeDasharray: '3 3' }}
                  content={({ active, payload, label }) => {
                    if (!active || !payload || payload.length === 0) return null;
                    
                    return (
                      <div className="rounded border border-border bg-background/95 shadow-sm p-2 text-xs">
                        <div className="text-[11px] text-muted-foreground mb-1">
                          {new Date(label).toLocaleString('en-US', { 
                            month: 'short', 
                            day: 'numeric', 
                            hour: '2-digit', 
                            minute: '2-digit',
                            hour12: false 
                          })}
                        </div>
                        {payload.map((entry, index) => {
                          let displayName = entry.dataKey as string;
                          let percentage = '0%';
                          
                          switch (entry.dataKey) {
                            case 'used':
                              displayName = 'Used';
                              percentage = `${entry.payload.usedPercent}%`;
                              break;
                            case 'available':
                              displayName = 'Available';
                              percentage = `${entry.payload.availablePercent}%`;
                              break;
                          }
                          
                          return (
                            <div key={index} className="flex items-center gap-2">
                              <span className="w-2 h-0.5 rounded" style={{backgroundColor: entry.color}} />
                              {displayName}: <span className="text-foreground">{((entry.value as number) / (1024 ** 3)).toFixed(2)} GB ({percentage})</span>
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
                  dataKey="used"
                  stackId="1"
                  name="Used Disk"
                  stroke={usedColor}
                  fill={usedColor}
                  fillOpacity={0.6}
                />
                <Area
                  type="monotone"
                  dataKey="available"
                  stackId="1"
                  name="Available Disk"
                  stroke={availableColor}
                  fill={availableColor}
                  fillOpacity={0.6}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}