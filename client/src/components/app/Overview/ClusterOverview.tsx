import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { appRoute, overviewRoute } from "@/routes";
import { API_VERSION } from "@/constants";
import { useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo } from "react";
import { ResponsiveContainer, AreaChart, Area, YAxis, XAxis, Tooltip, CartesianGrid } from 'recharts';
import kwFetch from "@/data/kwFetch";
import { Loader } from "@/components/app/Loader";
import { Tooltip as UITooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useAppSelector, useAppDispatch } from '@/redux/hooks';
import { updateClusterOverview, setClusterOverviewLoading, setPrometheusAvailability, setClusterOverviewError, setClusterOverviewRange } from '@/data/Overview/ClusterOverviewSlice';
import { useEventSource } from '../Common/Hooks/EventSource';



// Helper function to get packing color and tooltip based on percentage
const getPackingInfo = (percentage: number) => {
  if (percentage < 30) {
    return {
      bgColor: 'bg-red-50 dark:bg-red-950/20',
      borderColor: 'border-red-200 dark:border-red-800',
      textColor: 'text-red-700 dark:text-red-400',
      labelColor: 'text-red-600 dark:text-red-300',
      subtitleColor: 'text-red-500 dark:text-red-400',
      tooltip: 'Under-utilized cluster. This may lead to unnecessary costs. Consider scaling down nodes or consolidating workloads.'
    };
  } else if (percentage >= 30 && percentage < 60) {
    return {
      bgColor: 'bg-yellow-50 dark:bg-yellow-950/20',
      borderColor: 'border-yellow-200 dark:border-yellow-800',
      textColor: 'text-yellow-700 dark:text-yellow-400',
      labelColor: 'text-yellow-600 dark:text-yellow-300',
      subtitleColor: 'text-yellow-500 dark:text-yellow-400',
      tooltip: 'Suboptimal utilization. Consider better workload distribution or scaling down nodes for cost optimization.'
    };
  } else if (percentage >= 60 && percentage <= 90) {
    return {
      bgColor: 'bg-green-50 dark:bg-green-950/20',
      borderColor: 'border-green-200 dark:border-green-800',
      textColor: 'text-green-700 dark:text-green-400',
      labelColor: 'text-green-600 dark:text-green-300',
      subtitleColor: 'text-green-500 dark:text-green-400',
      tooltip: 'Ideal utilization range. 60-80% is good, 80-90% is excellent packing efficiency.'
    };
  } else {
    return {
      bgColor: 'bg-red-50 dark:bg-red-950/20',
      borderColor: 'border-red-200 dark:border-red-800',
      textColor: 'text-red-700 dark:text-red-400',
      labelColor: 'text-red-600 dark:text-red-300',
      subtitleColor: 'text-red-500 dark:text-red-400',
      tooltip: 'Over-packed cluster. This can lead to frequent scale-ups and impact workload latency when new pods are scheduled.'
    };
  }
};

// Helper function to get allocation color and tooltip based on percentage
const getAllocationInfo = (percentage: number) => {
  if (percentage < 40) {
    return {
      bgColor: 'bg-red-50 dark:bg-red-950/20',
      borderColor: 'border-red-200 dark:border-red-800',
      textColor: 'text-red-700 dark:text-red-400',
      labelColor: 'text-red-600 dark:text-red-300',
      subtitleColor: 'text-red-500 dark:text-red-400',
      tooltip: 'Low resource allocation. Consider consolidating workloads or scaling down to optimize costs.'
    };
  } else if (percentage >= 40 && percentage < 60) {
    return {
      bgColor: 'bg-yellow-50 dark:bg-yellow-950/20',
      borderColor: 'border-yellow-200 dark:border-yellow-800',
      textColor: 'text-yellow-700 dark:text-yellow-400',
      labelColor: 'text-yellow-600 dark:text-yellow-300',
      subtitleColor: 'text-yellow-500 dark:text-yellow-400',
      tooltip: 'Moderate resource allocation. Room for optimization or additional workloads.'
    };
  } else if (percentage >= 60 && percentage <= 90) {
    return {
      bgColor: 'bg-green-50 dark:bg-green-950/20',
      borderColor: 'border-green-200 dark:border-green-800',
      textColor: 'text-green-700 dark:text-green-400',
      labelColor: 'text-green-600 dark:text-green-300',
      subtitleColor: 'text-green-500 dark:text-green-400',
      tooltip: 'Optimal resource allocation. Good balance between utilization and headroom for scaling.'
    };
  } else {
    return {
      bgColor: 'bg-orange-50 dark:bg-orange-950/20',
      borderColor: 'border-orange-200 dark:border-orange-800',
      textColor: 'text-orange-700 dark:text-orange-400',
      labelColor: 'text-orange-600 dark:text-orange-300',
      subtitleColor: 'text-orange-500 dark:text-orange-400',
      tooltip: 'High resource allocation. Limited headroom for pod autoscaling and new workloads.'
    };
  }
};

export function ClusterOverview() {
  const { config } = appRoute.useParams();
  const { cluster } = overviewRoute.useSearch();
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const { series, instant, loading: isLoading, hasProm, range } = useAppSelector((state) => state.clusterOverview);

  const getStepForRange = (r: string): string => {
    switch (r) {
      case '1h':
        return '30s';
      case '3h':
        return '1m';
      case '6h':
        return '2m';
      case '12h':
        return '5m';
      case '24h':
        return '10m';
      case '7d':
        return '30m';
      case '15d':
        return '1h';
      case '30d':
        return '2h';
      default:
        return '5m';
    }
  };
  const step = useMemo(() => getStepForRange(range), [range]);

  // Check Prometheus availability
  useEffect(() => {
    let active = true;
    kwFetch(`${API_VERSION}/metrics/prometheus/availability?config=${encodeURIComponent(config)}&cluster=${encodeURIComponent(cluster)}`)
      .then(res => { 
        if (active) {
          dispatch(setPrometheusAvailability(Boolean(res?.installed && res?.reachable)));
        }
      })
      .catch(() => { 
        if (active) {
          dispatch(setPrometheusAvailability(false));
        }
      });
    return () => { active = false; };
  }, [config, cluster, dispatch]);

  // EventSource URL for cluster overview metrics
  const eventSourceUrl = hasProm ? 
    `${API_VERSION}/metrics/overview/prometheus?config=${encodeURIComponent(config)}&cluster=${encodeURIComponent(cluster)}&range=${encodeURIComponent(range)}&step=${encodeURIComponent(step)}` : 
    null;

  // Use EventSource hook for real-time updates
  useEventSource({
    url: eventSourceUrl || '',
    sendMessage: (data: any) => {
      if (data && (data.series || data.instant)) {
        dispatch(updateClusterOverview(data));
      }
    },
    setLoading: (loading: boolean) => {
      dispatch(setClusterOverviewLoading(loading));
    },
    onConfigError: () => {
      dispatch(setClusterOverviewError('Configuration error'));
    },
    onPermissionError: (error: any) => {
      dispatch(setClusterOverviewError(error?.message || 'Permission error'));
    },
  });

  // Extract cluster stats from the new API response
  const nodeCount = Math.round(Number(instant?.node_count || 0));
  const cpuPacking = Number(instant?.cpu_packing || 0);
  const memoryPacking = Number(instant?.memory_packing || 0);
  const k8sVersion: string = String(instant?.kubernetes_version || '');
  const metricsServerEnabled: boolean = Boolean(instant?.metrics_server || false);
  const podsTotal = Math.round(Number(instant?.pods_capacity || 0));
  const podsCurrent = Math.round(Number(instant?.pods_present || 0));
  const podsPercent = podsTotal > 0 ? ((podsCurrent / podsTotal) * 100) : 0;
  
  // Extract allocation summary metrics
  const totalAllocatableCPU = Number(instant?.total_allocatable_cpu || 0);
  const totalCPURequests = Number(instant?.total_cpu_requests || 0);
  const totalAllocatableMemory = Number(instant?.total_allocatable_memory || 0);
  const totalMemoryRequests = Number(instant?.total_memory_requests || 0);
  
  // Helper function to format numbers
  const formatNumber = (value: number, decimals: number = 1): string => {
    return value.toFixed(decimals);
  };
  
  // Helper function to format memory values (convert bytes to GB)
  const formatMemory = (bytes: number): string => {
    const gb = bytes / (1024 * 1024 * 1024);
    return `${gb.toFixed(1)} GB`;
  };

  // Process series data for node count chart only
  const nodeCountSeries = useMemo(() => {
    const s = series.find(s => s.metric.includes('node_count') || s.metric.includes('kube_node_status_condition'));
    return (s?.points || []).map(p => ({ ts: new Date(p.t * 1000).toISOString(), value: p.v }));
  }, [series]);

  const hasMetrics = useMemo(() => {
    const hasSeries = Array.isArray(series) && series.some(s => (s.points?.length || 0) > 0);
    return Boolean(instant) || hasSeries;
  }, [series, instant]);

  if (!hasProm) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-8rem)] px-4">
        <Card className="w-full max-w-xl shadow-none rounded-lg border bg-background/60">
          <CardContent className="p-8 text-center space-y-3">
            <div>
              <h3 className="text-lg md:text-xl font-semibold">Prometheus Not Available</h3>
              <p className="text-sm text-muted-foreground mt-1">Cluster metrics require Prometheus to be installed and accessible in your cluster.</p>
            </div>
            <div className="pt-2">
              <Button
                onClick={() => navigate({ to: `/${config}/list?cluster=${encodeURIComponent(cluster)}&resourcekind=pods` })}
              >
                Go to Pods
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!hasMetrics) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-8rem)] px-4">
        <Card className="w-full max-w-xl shadow-none rounded-lg border bg-background/60">
          <CardContent className="p-8 text-center space-y-4">
            <div className="flex items-center justify-center">
              <svg className="w-8 h-8 animate-spin text-muted-foreground fill-foreground" viewBox="0 0 100 101" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M100 50.5908C100 78.2051 77.6142 100.591 50 100.591C22.3858 100.591 0 78.2051 0 50.5908C0 22.9766 22.3858 0.59082 50 0.59082C77.6142 0.59082 100 22.9766 100 50.5908ZM9.08144 50.5908C9.08144 73.1895 27.4013 91.5094 50 91.5094C72.5987 91.5094 90.9186 73.1895 90.9186 50.5908C90.9186 27.9921 72.5987 9.67226 50 9.67226C27.4013 9.67226 9.08144 27.9921 9.08144 50.5908Z" fill="currentColor"/>
                <path d="M93.9676 39.0409C96.393 38.4038 97.8624 35.9116 97.0079 33.5539C95.2932 28.8227 92.871 24.3692 89.8167 20.348C85.8452 15.1192 80.8826 10.7238 75.2124 7.41289C69.5422 4.10194 63.2754 1.94025 56.7698 1.05124C51.7666 0.367541 46.6976 0.446843 41.7345 1.27873C39.2613 1.69328 37.813 4.19778 38.4501 6.62326C39.0873 9.04874 41.5694 10.4717 44.0505 10.1071C47.8511 9.54855 51.7191 9.52689 55.5402 10.0491C60.8642 10.7766 65.9928 12.5457 70.6331 15.2552C75.2735 17.9648 79.3347 21.5619 82.5849 25.841C84.9175 28.9121 86.7997 32.2913 88.1811 35.8758C89.083 38.2158 91.5421 39.6781 93.9676 39.0409Z" fill="currentFill"/>
              </svg>
            </div>
            <div>
              <h3 className="text-lg md:text-xl font-semibold">Fetching cluster metrics…</h3>
              <p className="text-sm text-muted-foreground mt-1">This may take a few seconds...</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="mt-2 space-y-6">
      {/* Basic Cluster Metrics */}
      <Card className="shadow-none rounded-lg">
        <CardHeader className="p-4">
          <CardTitle className="text-base font-semibold">Cluster Overview</CardTitle>
        </CardHeader>
        <CardContent className="px-6 pb-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="text-center p-4 bg-green-50 dark:bg-green-950/20 rounded-lg border border-green-200 dark:border-green-800">
              <div className="text-3xl font-bold text-green-700 dark:text-green-400 mb-2">
                {instant ? nodeCount : <div className="animate-pulse bg-muted h-8 w-16 mx-auto rounded"></div>}
              </div>
              <div className="text-sm font-medium text-green-600 dark:text-green-300">Node Count</div>
              <div className="text-xs text-green-500 dark:text-green-400 mt-1">Ready Nodes</div>
            </div>
            
            <TooltipProvider>
              <UITooltip delayDuration={300}>
                <TooltipTrigger asChild>
                  <div className={`text-center p-4 rounded-lg border transition-all duration-200 hover:scale-105 hover:shadow-md ${getPackingInfo(cpuPacking).bgColor} ${getPackingInfo(cpuPacking).borderColor}`}>
                    <div className={`text-3xl font-bold mb-2 ${getPackingInfo(cpuPacking).textColor}`}>
                      {instant ? `${formatNumber(cpuPacking)}%` : <div className="animate-pulse bg-muted h-8 w-20 mx-auto rounded"></div>}
                    </div>
                    <div className={`text-sm font-medium ${getPackingInfo(cpuPacking).labelColor}`}>CPU Packing</div>
                    <div className={`text-xs mt-1 ${getPackingInfo(cpuPacking).subtitleColor}`}>Average %</div>
                  </div>
                </TooltipTrigger>
                <TooltipContent side="top" className="max-w-xs bg-primary border border-border shadow-lg">
                  <p className="text-sm text-primary-foreground">{getPackingInfo(cpuPacking).tooltip}</p>
                </TooltipContent>
              </UITooltip>
            </TooltipProvider>
            
            <TooltipProvider>
              <UITooltip delayDuration={300}>
                <TooltipTrigger asChild>
                  <div className={`text-center p-4 rounded-lg border transition-all duration-200 hover:scale-105 hover:shadow-md ${getPackingInfo(memoryPacking).bgColor} ${getPackingInfo(memoryPacking).borderColor}`}>
                    <div className={`text-3xl font-bold mb-2 ${getPackingInfo(memoryPacking).textColor}`}>
                      {instant ? `${formatNumber(memoryPacking)}%` : <div className="animate-pulse bg-muted h-8 w-20 mx-auto rounded"></div>}
                    </div>
                    <div className={`text-sm font-medium ${getPackingInfo(memoryPacking).labelColor}`}>Memory Packing</div>
                    <div className={`text-xs mt-1 ${getPackingInfo(memoryPacking).subtitleColor}`}>Average %</div>
                  </div>
                </TooltipTrigger>
                <TooltipContent side="top" className="max-w-xs bg-primary border border-border shadow-lg">
                  <p className="text-sm text-primary-foreground">{getPackingInfo(memoryPacking).tooltip}</p>
                </TooltipContent>
              </UITooltip>
            </TooltipProvider>
          </div>

          {/* Additional cluster details */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-6">
            <div className="text-center p-4 bg-slate-50 dark:bg-slate-950/20 rounded-lg border border-slate-200 dark:border-slate-800">
              <div className="text-base font-semibold text-slate-700 dark:text-slate-300 mb-1">Kubernetes Version</div>
              <div className="text-sm text-muted-foreground">{instant ? (k8sVersion || 'Unknown') : <div className="animate-pulse bg-muted h-5 w-28 mx-auto rounded"></div>}</div>
            </div>
            <div className="text-center p-4 bg-slate-50 dark:bg-slate-950/20 rounded-lg border border-slate-200 dark:border-slate-800">
              <div className="text-base font-semibold text-slate-700 dark:text-slate-300 mb-1">Metrics Server</div>
              <div className={`inline-flex items-center justify-center px-2 py-1 rounded-full text-xs font-medium ${metricsServerEnabled ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300' : 'bg-rose-100 text-rose-700 dark:bg-rose-950/30 dark:text-rose-300'}`}>
                {instant ? (metricsServerEnabled ? 'Enabled' : 'Not Detected') : <span className="animate-pulse bg-muted h-5 w-20 rounded inline-block"></span>}
              </div>
            </div>
            <div className="text-center p-4 bg-slate-50 dark:bg-slate-950/20 rounded-lg border border-slate-200 dark:border-slate-800">
              <div className="text-base font-semibold text-slate-700 dark:text-slate-300 mb-1">Pods</div>
              <div className="text-sm text-muted-foreground">
                {instant ? (
                  <span className="text-foreground font-medium">{podsCurrent}</span>
                ) : <span className="animate-pulse bg-muted h-5 w-10 inline-block rounded"></span>}
                <span className="mx-1">/</span>
                {instant ? (
                  <span className="text-foreground font-medium">{podsTotal}</span>
                ) : <span className="animate-pulse bg-muted h-5 w-10 inline-block rounded"></span>}
                {instant && podsTotal > 0 && (
                  <span className="ml-2 text-xs text-muted-foreground">({formatNumber(podsPercent)}%)</span>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Resource Allocation Summary */}
      <Card className="shadow-none rounded-lg">
        <CardHeader className="p-4">
          <CardTitle className="text-base font-semibold">Resource Allocation Summary</CardTitle>
        </CardHeader>
        <CardContent className="px-6 pb-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* CPU Allocation Tile */}
            <TooltipProvider>
              <UITooltip delayDuration={300}>
                <TooltipTrigger asChild>
                  <div className={`text-center p-6 rounded-lg border transition-all duration-200 hover:scale-105 hover:shadow-md ${getAllocationInfo((totalCPURequests / totalAllocatableCPU) * 100).bgColor} ${getAllocationInfo((totalCPURequests / totalAllocatableCPU) * 100).borderColor}`}>
                    <div className={`text-4xl font-bold mb-3 ${getAllocationInfo((totalCPURequests / totalAllocatableCPU) * 100).textColor}`}>
                      {instant ? `${formatNumber((totalCPURequests / totalAllocatableCPU) * 100)}%` : <div className="animate-pulse bg-muted h-10 w-20 mx-auto rounded"></div>}
                    </div>
                    <div className={`text-lg font-semibold mb-2 ${getAllocationInfo((totalCPURequests / totalAllocatableCPU) * 100).labelColor}`}>CPU Allocation</div>
                    <div className={`text-sm ${getAllocationInfo((totalCPURequests / totalAllocatableCPU) * 100).subtitleColor}`}>
                      {instant ? `${formatNumber(totalCPURequests)} / ${formatNumber(totalAllocatableCPU)} cores` : <div className="animate-pulse bg-muted h-4 w-24 mx-auto rounded"></div>}
                    </div>
                  </div>
                </TooltipTrigger>
                <TooltipContent side="top" className="max-w-xs bg-primary border border-border shadow-lg">
                  <p className="text-sm text-primary-foreground">{getAllocationInfo((totalCPURequests / totalAllocatableCPU) * 100).tooltip}</p>
                </TooltipContent>
              </UITooltip>
            </TooltipProvider>
            
            {/* Memory Allocation Tile */}
            <TooltipProvider>
              <UITooltip delayDuration={300}>
                <TooltipTrigger asChild>
                  <div className={`text-center p-6 rounded-lg border transition-all duration-200 hover:scale-105 hover:shadow-md ${getAllocationInfo((totalMemoryRequests / totalAllocatableMemory) * 100).bgColor} ${getAllocationInfo((totalMemoryRequests / totalAllocatableMemory) * 100).borderColor}`}>
                    <div className={`text-4xl font-bold mb-3 ${getAllocationInfo((totalMemoryRequests / totalAllocatableMemory) * 100).textColor}`}>
                      {instant ? `${formatNumber((totalMemoryRequests / totalAllocatableMemory) * 100)}%` : <div className="animate-pulse bg-muted h-10 w-20 mx-auto rounded"></div>}
                    </div>
                    <div className={`text-lg font-semibold mb-2 ${getAllocationInfo((totalMemoryRequests / totalAllocatableMemory) * 100).labelColor}`}>Memory Allocation</div>
                    <div className={`text-sm ${getAllocationInfo((totalMemoryRequests / totalAllocatableMemory) * 100).subtitleColor}`}>
                      {instant ? `${formatMemory(totalMemoryRequests)} / ${formatMemory(totalAllocatableMemory)}` : <div className="animate-pulse bg-muted h-4 w-32 mx-auto rounded"></div>}
                    </div>
                  </div>
                </TooltipTrigger>
                <TooltipContent side="top" className="max-w-xs bg-primary border border-border shadow-lg">
                  <p className="text-sm text-primary-foreground">{getAllocationInfo((totalMemoryRequests / totalAllocatableMemory) * 100).tooltip}</p>
                </TooltipContent>
              </UITooltip>
            </TooltipProvider>
          </div>
        </CardContent>
      </Card>

      {/* Node Count Trend - 24 Hour View */}
      <Card className="shadow-none rounded-lg">
        <CardHeader className="p-4">
          <div className="flex items-center justify-between gap-4">
            <CardTitle className="text-base font-semibold">Node Count Trend</CardTitle>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Range</span>
              <Select value={range} onValueChange={(value) => dispatch(setClusterOverviewRange(value))}>
                <SelectTrigger className="w-28 h-8">
                  <SelectValue placeholder="Range" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1h">1h</SelectItem>
                  <SelectItem value="3h">3h</SelectItem>
                  <SelectItem value="6h">6h</SelectItem>
                  <SelectItem value="12h">12h</SelectItem>
                  <SelectItem value="24h">1d</SelectItem>
                  <SelectItem value="7d">7d</SelectItem>
                  <SelectItem value="15d">15d</SelectItem>
                  <SelectItem value="30d">30d</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent className="px-2 md:px-4">
          <div className="flex gap-4">
            {/* Legend column */}
            <div className="min-w-[140px] text-xs text-muted-foreground space-y-2">
              <div className="font-medium text-foreground">Legend</div>
              <div className="flex items-center gap-2">
                <span className="w-3 h-0.5 rounded" style={{backgroundColor: '#10b981'}} /> 
                Node Count
              </div>
              <div className="text-[10px] text-muted-foreground mt-1 pt-1 border-t border-border">
                {range} historical view
              </div>
            </div>
            {/* Chart container */}
            <div className="relative flex-1 h-72 bg-background/50 rounded border border-border p-2">
              {isLoading && (
                <div className="absolute inset-0 bg-background/50 flex items-center justify-center z-10">
                  <Loader className="w-4 h-4 text-muted-foreground animate-spin fill-foreground" />
                </div>
              )}
              {nodeCountSeries.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={nodeCountSeries} margin={{ top: 10, right: 10, left: 0, bottom: 12 }}>
                    <defs>
                      <linearGradient id="nodeFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid stroke={'var(--border)'} strokeDasharray="3 3" />
                    <XAxis 
                      dataKey="ts" 
                      tick={{ fill: 'hsl(var(--foreground))', fontSize: 10 }} 
                      axisLine={{ stroke: 'hsl(var(--border))' }}
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
                      tick={{ fill: 'hsl(var(--foreground))', fontSize: 10 }} 
                      axisLine={{ stroke: 'hsl(var(--border))' }}
                      tickLine={false} 
                      width={36}
                    />
                    <Tooltip 
                      cursor={{ stroke: 'var(--muted-foreground)', strokeDasharray: '3 3' }}
                      content={({ active, payload, label }) => {
                        if (!active || !payload || payload.length === 0) return null;
                        return (
                          <div className="rounded border border-border bg-primary shadow-sm p-2 text-xs">
                            <div className="text-[11px] text-primary-foreground/70 mb-1">{label}</div>
                            <div className="flex items-center gap-2">
                              <span className="w-2 h-0.5 rounded" style={{backgroundColor: '#10b981'}} />
                              Node Count: <span className="text-primary-foreground">{payload[0]?.value}</span>
                            </div>
                          </div>
                        );
                      }}
                    />
                    <Area type="monotone" dataKey="value" name="Node Count" stroke="#10b981" fillOpacity={1} fill="url(#nodeFill)" dot={false} strokeWidth={2} />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-full">
                  <div className="animate-pulse text-muted-foreground">Loading 24-hour trend data...</div>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}


