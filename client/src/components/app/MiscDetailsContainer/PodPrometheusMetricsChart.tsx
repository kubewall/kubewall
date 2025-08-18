import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { getEventStreamUrl } from "@/utils";
import { useEffect, useMemo, useRef, useState } from "react";
import { ResponsiveContainer, AreaChart, Area, YAxis, XAxis, Tooltip, CartesianGrid, ReferenceLine } from 'recharts';
import { AlertTriangle, Clock } from "lucide-react";

type MetricSeries = { 
  metric: string; 
  points: { t: number; v: number }[] 
};

type VPARecommendations = {
  cpu_target?: number;
  cpu_upperbound?: number;
  memory_target?: number;
  memory_upperbound?: number;
};

type PrometheusMetricsData = {
  series: MetricSeries[];
  limits: {
    cpu: number;
    memory: number;
  };
  requests: {
    cpu: number;
    memory: number;
  };
  vpa_recommendations?: VPARecommendations;
};

type TimeRange = {
  label: string;
  value: string;
  range: string;
  step: string;
};

const TIME_RANGES: TimeRange[] = [
  { label: '15m', value: '15m', range: '15m', step: '15s' },
  { label: '1h', value: '1h', range: '1h', step: '1m' },
  { label: '6h', value: '6h', range: '6h', step: '5m' },
  { label: '24h', value: '24h', range: '24h', step: '15m' },
];

interface PodPrometheusMetricsChartProps {
  namespace: string;
  podName: string;
  configName: string;
  clusterName: string;
}

export default function PodPrometheusMetricsChart({ 
  namespace, 
  podName, 
  configName, 
  clusterName 
}: PodPrometheusMetricsChartProps) {
  const [metricsData, setMetricsData] = useState<PrometheusMetricsData | null>(null);
  const [selectedTimeRange, setSelectedTimeRange] = useState<TimeRange>(TIME_RANGES[0]);
  const esRef = useRef<EventSource | null>(null);

  useEffect(() => {
    if (!podName || !namespace) return;
    
    const url = getEventStreamUrl(
      `metrics/pods`,
      { config: configName, cluster: clusterName },
      `/${encodeURIComponent(namespace)}/${encodeURIComponent(podName)}/prometheus`,
      `&range=${selectedTimeRange.range}&step=${selectedTimeRange.step}`
    );
    
    console.log(`[Frontend] Requesting metrics for time range: ${selectedTimeRange.range} (${selectedTimeRange.label}) with step: ${selectedTimeRange.step}`);
    console.log(`[Frontend] EventSource URL: ${url}`);
    
    const es = new EventSource(url);
    esRef.current = es;
    
    es.onmessage = (evt) => {
      try {
        const data = JSON.parse(evt.data) as PrometheusMetricsData;
        console.log('Received metrics data:', data);
        console.log('VPA recommendations in received data:', data.vpa_recommendations);
        
        // Log data points analysis
        const totalDataPoints = data.series.reduce((total, series) => total + series.points.length, 0);
        console.log(`[Frontend] Received ${data.series.length} series with ${totalDataPoints} total data points`);
        
        data.series.forEach(series => {
          if (series.points.length > 0) {
            const firstPoint = new Date(series.points[0].t * 1000);
            const lastPoint = new Date(series.points[series.points.length - 1].t * 1000);
            console.log(`[Frontend] ${series.metric}: ${series.points.length} points from ${firstPoint.toISOString()} to ${lastPoint.toISOString()}`);
          }
        });
        
        setMetricsData(data);
      } catch (error) {
        console.error('Failed to parse metrics data:', error);
      }
    };
    
    es.onerror = (error) => {
      console.error('EventSource error:', error);
    };
    
    return () => { 
      es.close(); 
      esRef.current = null; 
    };
  }, [configName, clusterName, podName, namespace, selectedTimeRange]);

  // Process data for charts
  const { cpuData, memoryData, cpuLimits, memoryLimits, memoryViolations } = useMemo(() => {
    if (!metricsData) {
      return { cpuData: [], memoryData: [], cpuLimits: null, memoryLimits: null, memoryViolations: null };
    }

    const cpuAvgSeries = metricsData.series.find(s => s.metric === 'cpu_average');
    const cpuMaxSeries = metricsData.series.find(s => s.metric === 'cpu_maximum');
    const memUsageSeries = metricsData.series.find(s => s.metric === 'memory_usage');

    // Merge CPU data points by timestamp
    const cpuMap = new Map<string, any>();
    
    cpuAvgSeries?.points.forEach(p => {
      const ts = new Date(p.t * 1000).toISOString();
      cpuMap.set(ts, { ts, cpuAvg: p.v });
    });
    
    cpuMaxSeries?.points.forEach(p => {
      const ts = new Date(p.t * 1000).toISOString();
      const existing = cpuMap.get(ts) || { ts };
      cpuMap.set(ts, { ...existing, cpuMax: p.v });
    });
    
    const cpuData = Array.from(cpuMap.values()).sort((a, b) => a.ts.localeCompare(b.ts));

    // Process memory data with violation analysis
    const memoryLimitGB = metricsData.limits.memory / (1024 * 1024 * 1024);
    const memoryRequestGB = metricsData.requests.memory / (1024 * 1024 * 1024);
    
    const memoryData = memUsageSeries?.points.map(p => {
      const memUsageGB = p.v / (1024 * 1024 * 1024);
      const limitPercentage = memoryLimitGB > 0 ? (memUsageGB / memoryLimitGB) * 100 : 0;
      return {
        ts: new Date(p.t * 1000).toISOString(),
        memUsage: memUsageGB,
        limitPercentage,
        isViolation: memUsageGB > memoryLimitGB
      };
    }).sort((a, b) => a.ts.localeCompare(b.ts)) || [];

    // Analyze memory violations
    const violations = memoryData.filter(d => d.isViolation);
    const violationPercentage = memoryData.length > 0 ? (violations.length / memoryData.length) * 100 : 0;
    const maxViolation = violations.length > 0 ? Math.max(...violations.map(v => v.limitPercentage)) : 0;
    const currentViolation = memoryData.length > 0 ? memoryData[memoryData.length - 1] : null;

    return {
      cpuData,
      memoryData,
      cpuLimits: {
        limit: metricsData.limits.cpu,
        request: metricsData.requests.cpu
      },
      memoryLimits: {
        limit: memoryLimitGB,
        request: memoryRequestGB
      },
      memoryViolations: {
        count: violations.length,
        percentage: violationPercentage,
        maxViolation,
        currentViolation,
        isCurrentlyViolating: currentViolation?.isViolation || false
      }
    };
  }, [metricsData]);

  const themeStroke = 'var(--border)';
  const tickColor = 'hsl(var(--foreground))';
  const cpuAvgColor = 'rgb(34 197 94)'; // green for average
  const cpuMaxColor = 'rgb(234 179 8)'; // yellow for maximum
  const memColor = 'rgb(139 92 246)'; // purple for memory
  const limitColor = 'rgb(239 68 68)'; // red for limits
  const requestColor = 'rgb(234 179 8)'; // amber for requests

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload || payload.length === 0) return null;
    
    const dataPoint = payload[0]?.payload;
    
    return (
      <div className="rounded border border-border bg-background/95 shadow-sm p-2 text-xs">
        <div className="text-[11px] text-muted-foreground mb-1">
          {new Date(label).toLocaleString()}
        </div>
        {payload.map((entry: any, index: number) => (
          <div key={index} className="flex items-center gap-2">
            <span 
              className="w-2 h-0.5 rounded" 
              style={{ backgroundColor: entry.color }} 
            />
            <span className="text-foreground">
              {entry.name}: {entry.value?.toFixed(2)} {entry.unit || ''}
            </span>
          </div>
        ))}
        {dataPoint?.limitPercentage && (
          <div className="mt-1 pt-1 border-t border-border">
            <span className={`text-[11px] ${
              dataPoint.limitPercentage > 100 ? 'text-red-500' : 
              dataPoint.limitPercentage > 80 ? 'text-yellow-500' : 'text-green-500'
            }`}>
              {dataPoint.limitPercentage.toFixed(1)}% of limit
            </span>
            {dataPoint.isViolation && (
              <Badge variant="destructive" className="ml-2 text-[10px] px-1 py-0">
                LIMIT EXCEEDED
              </Badge>
            )}
          </div>
        )}
      </div>
    );
  };

  if (!metricsData) {
    return (
      <Card className="shadow-none rounded-lg mb-2">
        <CardHeader className="p-4">
          <CardTitle className="text-sm font-medium">Enhanced Metrics (Prometheus)</CardTitle>
        </CardHeader>
        <CardContent className="px-4">
          <div className="flex items-center justify-center h-64 text-muted-foreground">
            Loading metrics data...
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Time Range Controls */}
      <Card className="shadow-none rounded-lg">
        <CardHeader className="p-4">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Clock className="w-4 h-4" />
              Time Range
            </CardTitle>
            <div className="flex gap-1">
              {TIME_RANGES.map((range) => (
                <Button
                  key={range.value}
                  variant={selectedTimeRange.value === range.value ? "default" : "outline"}
                  size="sm"
                  className="h-7 px-2 text-xs"
                  onClick={() => setSelectedTimeRange(range)}
                >
                  {range.label}
                </Button>
              ))}
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* VPA Recommendations */}
      {metricsData?.vpa_recommendations && (() => {
        console.log('VPA Recommendations Data:', metricsData.vpa_recommendations);
        return (
          <Card className="shadow-none rounded-lg border-blue-200 bg-blue-50">
            <CardHeader className="p-4">
            <CardTitle className="text-sm font-medium flex items-center gap-2 text-blue-800">
              <AlertTriangle className="w-4 h-4" />
              VPA Recommendations
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* CPU Recommendations */}
              {(metricsData.vpa_recommendations.cpu_target || metricsData.vpa_recommendations.cpu_upperbound) && (
                <div className="space-y-2">
                  <div className="font-medium text-sm text-blue-800">CPU Recommendations</div>
                  <div className="space-y-1 text-xs">
                    <div className="flex justify-between items-center">
                      <span className="text-muted-foreground">Current Request:</span>
                      <span className="font-medium">{cpuLimits?.request || 0}m</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-muted-foreground">Current Limit:</span>
                      <span className="font-medium">{cpuLimits?.limit || 0}m</span>
                    </div>
                    {metricsData.vpa_recommendations.cpu_target && (
                      <div className="flex justify-between items-center">
                        <span className="text-blue-600">VPA Target:</span>
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-blue-600">
                            {metricsData.vpa_recommendations.cpu_target.toFixed(0)}m
                          </span>
                          <Badge 
                            variant={metricsData.vpa_recommendations.cpu_target > (cpuLimits?.request || 0) ? "destructive" : "secondary"}
                            className="text-[10px] px-1 py-0"
                          >
                            {metricsData.vpa_recommendations.cpu_target > (cpuLimits?.request || 0) ? "↑" : "↓"}
                          </Badge>
                        </div>
                      </div>
                    )}
                    {metricsData.vpa_recommendations.cpu_upperbound && (
                      <div className="flex justify-between items-center">
                        <span className="text-orange-600">VPA Upperbound:</span>
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-orange-600">
                            {metricsData.vpa_recommendations.cpu_upperbound.toFixed(0)}m
                          </span>
                          <Badge 
                            variant={metricsData.vpa_recommendations.cpu_upperbound > (cpuLimits?.limit || 0) ? "destructive" : "secondary"}
                            className="text-[10px] px-1 py-0"
                          >
                            {metricsData.vpa_recommendations.cpu_upperbound > (cpuLimits?.limit || 0) ? "↑" : "↓"}
                          </Badge>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
              
              {/* Memory Recommendations */}
              {(metricsData.vpa_recommendations.memory_target || metricsData.vpa_recommendations.memory_upperbound) && (
                <div className="space-y-2">
                  <div className="font-medium text-sm text-blue-800">Memory Recommendations</div>
                  <div className="space-y-1 text-xs">
                    <div className="flex justify-between items-center">
                      <span className="text-muted-foreground">Current Request:</span>
                      <span className="font-medium">{memoryLimits?.request?.toFixed(2) || 0}GB</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-muted-foreground">Current Limit:</span>
                      <span className="font-medium">{memoryLimits?.limit?.toFixed(2) || 0}GB</span>
                    </div>
                    {metricsData.vpa_recommendations.memory_target && (
                      <div className="flex justify-between items-center">
                        <span className="text-blue-600">VPA Target:</span>
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-blue-600">
                            {(metricsData.vpa_recommendations.memory_target / (1024 * 1024 * 1024)).toFixed(2)}GB
                          </span>
                          <Badge 
                            variant={metricsData.vpa_recommendations.memory_target > (metricsData.requests.memory || 0) ? "destructive" : "secondary"}
                            className="text-[10px] px-1 py-0"
                          >
                            {metricsData.vpa_recommendations.memory_target > (metricsData.requests.memory || 0) ? "↑" : "↓"}
                          </Badge>
                        </div>
                      </div>
                    )}
                    {metricsData.vpa_recommendations.memory_upperbound && (
                      <div className="flex justify-between items-center">
                        <span className="text-orange-600">VPA Upperbound:</span>
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-orange-600">
                            {(metricsData.vpa_recommendations.memory_upperbound / (1024 * 1024 * 1024)).toFixed(2)}GB
                          </span>
                          <Badge 
                            variant={metricsData.vpa_recommendations.memory_upperbound > (metricsData.limits.memory || 0) ? "destructive" : "secondary"}
                            className="text-[10px] px-1 py-0"
                          >
                            {metricsData.vpa_recommendations.memory_upperbound > (metricsData.limits.memory || 0) ? "↑" : "↓"}
                          </Badge>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
        );
      })()}

      {/* Memory Violation Alert */}
      {memoryViolations?.isCurrentlyViolating && (
        <Alert className="border-red-200 bg-red-50">
          <AlertTriangle className="h-4 w-4 text-red-600" />
          <AlertDescription className="text-red-800">
            <div className="font-medium">Memory Limit Exceeded</div>
            <div className="text-sm mt-1">
              Current usage: {memoryViolations.currentViolation?.limitPercentage.toFixed(1)}% of limit
              {memoryViolations.percentage > 0 && (
                <span className="ml-2">
                  • {memoryViolations.percentage.toFixed(1)}% of time period exceeds limits
                </span>
              )}
            </div>
          </AlertDescription>
        </Alert>
      )}

      {/* CPU Metrics Card */}
      <Card className="shadow-none rounded-lg">
        <CardHeader className="p-4">
          <CardTitle className="text-sm font-medium">CPU Metrics (Prometheus)</CardTitle>
        </CardHeader>
        <CardContent className="px-2 md:px-4">
          <div className="flex gap-4">
            {/* CPU Legend */}
            <div className="min-w-[140px] text-xs text-muted-foreground space-y-2">
              <div className="font-medium text-foreground">Legend</div>
              <div className="flex items-center gap-2">
                <span className="w-3 h-0.5 rounded" style={{ backgroundColor: cpuAvgColor }} />
                CPU Average
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3 h-0.5 rounded" style={{ backgroundColor: cpuMaxColor }} />
                CPU Maximum
              </div>
              {cpuLimits?.request && cpuLimits.request > 10 && (
                <div className="flex items-center gap-2">
                  <span className="w-3 h-0.5 rounded" style={{ backgroundColor: requestColor }} />
                  Request: {cpuLimits.request}m
                </div>
              )}
              {cpuLimits?.limit && cpuLimits.limit > 10 && (
                <div className="flex items-center gap-2">
                  <span className="w-3 h-0.5 rounded" style={{ backgroundColor: limitColor }} />
                  Limit: {cpuLimits.limit}m
                </div>
              )}
            </div>
            
            {/* CPU Chart */}
            <div className="flex-1 h-64 bg-background/50 rounded border border-border p-2">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={cpuData} margin={{ top: 10, right: 10, left: 0, bottom: 12 }}>
                  <defs>
                    <linearGradient id="cpuAvgFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={cpuAvgColor} stopOpacity={0.3}/>
                      <stop offset="95%" stopColor={cpuAvgColor} stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="cpuMaxFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={cpuMaxColor} stopOpacity={0.3}/>
                      <stop offset="95%" stopColor={cpuMaxColor} stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke={themeStroke} strokeDasharray="3 3" />
                  <XAxis 
                    dataKey="ts" 
                    tick={{ fill: tickColor, fontSize: 10 }} 
                    tickLine={false} 
                    minTickGap={24}
                    tickFormatter={(value) => {
                      const date = new Date(value);
                      return date.toLocaleTimeString('en-US', { 
                        hour12: false, 
                        hour: '2-digit', 
                        minute: '2-digit' 
                      });
                    }}
                  />
                  <YAxis 
                    tick={{ fill: tickColor, fontSize: 10 }} 
                    tickLine={false} 
                    width={48}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  
                  {/* Reference lines for limits and requests */}
                  {cpuLimits?.limit && cpuLimits.limit > 10 && (
                    <ReferenceLine 
                      y={cpuLimits.limit} 
                      stroke={limitColor} 
                      strokeWidth={2}
                      strokeDasharray="4 4" 
                    />
                  )}
                  {cpuLimits?.request && cpuLimits.request > 10 && (
                    <ReferenceLine 
                      y={cpuLimits.request} 
                      stroke={requestColor} 
                      strokeWidth={2}
                      strokeDasharray="6 6" 
                    />
                  )}
                  
                  <Area 
                    type="monotone" 
                    dataKey="cpuAvg" 
                    name="CPU Average (m)" 
                    stroke={cpuAvgColor} 
                    fillOpacity={1} 
                    fill="url(#cpuAvgFill)" 
                    dot={false} 
                    strokeWidth={2} 
                  />
                  <Area 
                    type="monotone" 
                    dataKey="cpuMax" 
                    name="CPU Maximum (m)" 
                    stroke={cpuMaxColor} 
                    fillOpacity={1} 
                    fill="url(#cpuMaxFill)" 
                    dot={false} 
                    strokeWidth={2} 
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Memory Metrics Card */}
      <Card className="shadow-none rounded-lg">
        <CardHeader className="p-4">
          <CardTitle className="text-sm font-medium">Memory Metrics (Prometheus)</CardTitle>
        </CardHeader>
        <CardContent className="px-2 md:px-4">
          <div className="flex gap-4">
            {/* Memory Legend */}
            <div className="min-w-[140px] text-xs text-muted-foreground space-y-2">
              <div className="font-medium text-foreground">Legend</div>
              <div className="flex items-center gap-2">
                <span className="w-3 h-0.5 rounded" style={{ backgroundColor: memColor }} />
                Memory Usage
              </div>
              {memoryLimits?.request && memoryLimits.request > 0.1 && (
                <div className="flex items-center gap-2">
                  <span className="w-3 h-0.5 rounded" style={{ backgroundColor: requestColor }} />
                  Request: {memoryLimits.request.toFixed(2)}GB
                </div>
              )}
              {memoryLimits?.limit && memoryLimits.limit > 0.1 && (
                <div className="flex items-center gap-2">
                  <span className="w-3 h-0.5 rounded" style={{ backgroundColor: limitColor }} />
                  Limit: {memoryLimits.limit.toFixed(2)}GB
                </div>
              )}
            </div>
            
            {/* Memory Chart */}
            <div className="flex-1 h-64 bg-background/50 rounded border border-border p-2">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={memoryData} margin={{ top: 10, right: 10, left: 0, bottom: 12 }}>
                  <defs>
                    <linearGradient id="memFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={memColor} stopOpacity={0.3}/>
                      <stop offset="95%" stopColor={memColor} stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke={themeStroke} strokeDasharray="3 3" />
                  <XAxis 
                    dataKey="ts" 
                    tick={{ fill: tickColor, fontSize: 10 }} 
                    tickLine={false} 
                    minTickGap={24}
                    tickFormatter={(value) => {
                      const date = new Date(value);
                      return date.toLocaleTimeString('en-US', { 
                        hour12: false, 
                        hour: '2-digit', 
                        minute: '2-digit' 
                      });
                    }}
                  />
                  <YAxis 
                    tick={{ fill: tickColor, fontSize: 10 }} 
                    tickLine={false} 
                    width={48}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  
                  {/* Reference lines for limits and requests */}
                  {memoryLimits?.limit && memoryLimits.limit > 0.1 && (
                    <ReferenceLine 
                      y={memoryLimits.limit} 
                      stroke={limitColor} 
                      strokeWidth={2}
                      strokeDasharray="4 4" 
                    />
                  )}
                  {memoryLimits?.request && memoryLimits.request > 0.1 && (
                    <ReferenceLine 
                      y={memoryLimits.request} 
                      stroke={requestColor} 
                      strokeWidth={2}
                      strokeDasharray="6 6" 
                    />
                  )}
                  
                  <Area 
                    type="monotone" 
                    dataKey="memUsage" 
                    name="Memory Usage (GB)" 
                    stroke={memColor} 
                    fillOpacity={1} 
                    fill="url(#memFill)" 
                    dot={false}
                    strokeWidth={2} 
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}