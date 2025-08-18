import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAppDispatch, useAppSelector } from "@/redux/hooks";
import { appRoute, kwDetails } from "@/routes";
import { getEventStreamUrl } from "@/utils";
import { useEventSource } from "@/components/app/Common/Hooks/EventSource";
import { 
  updateNodeMetrics, 
  setNodeMetricsLoading, 
  setNodeMetricsError,
  setNodeMetricsRange,
  clearNodeMetrics
} from "@/data/Clusters/Nodes/NodeMetricsSlice";
import NodeSummaryChart from "@/components/app/Charts/NodeSummaryChart";
import NodeDiskUsageChart from "@/components/app/Charts/NodeDiskUsageChart";
import NodeMemoryBreakdownChart from "@/components/app/Charts/NodeMemoryBreakdownChart";
import { toast } from "sonner";
import { useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";

export default function NodeMetricsContainer() {
  const { config } = appRoute.useParams();
  const { cluster, resourcename } = kwDetails.useSearch();
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  
  const { 
    series, 
    loading, 
    range, 
    step, 
    error 
  } = useAppSelector((state) => state.nodeMetrics);

  // Handle configuration errors
  const handleConfigError = () => {
    toast.error("Configuration Error", {
      description: "The configuration you were viewing has been deleted or is no longer available. Redirecting to configuration page.",
    });
    navigate({ to: '/config' });
  };

  // Handle permission errors
  const handlePermissionError = () => {
    toast.error("Permission Error", {
      description: "You don't have permission to access node metrics. Please check your cluster permissions.",
    });
  };

  // Handle incoming SSE messages
  const sendMessage = (data: any) => {
    try {
      dispatch(updateNodeMetrics(data));
    } catch (error) {
      console.error('Error processing node metrics data:', error);
      dispatch(setNodeMetricsError('Failed to process metrics data'));
    }
  };

  // Handle loading state changes
  const onLoading = (isLoading: boolean) => {
    dispatch(setNodeMetricsLoading(isLoading));
  };



  // Construct the SSE URL for node metrics
  const eventSourceUrl = resourcename ? getEventStreamUrl(
    `metrics/nodes`,
    { config, cluster },
    `/${encodeURIComponent(resourcename)}/prometheus`,
    `&range=${encodeURIComponent(range)}&step=${encodeURIComponent(step)}`
  ) : null;

  // Set up SSE connection - use empty string if no URL to avoid null issues
  useEventSource({
    url: eventSourceUrl || '',
    sendMessage: eventSourceUrl ? sendMessage : () => {}, // No-op if no URL
    onConfigError: handleConfigError,
    onPermissionError: handlePermissionError,
    setLoading: onLoading,
  });

  // Handle range changes
  const handleRangeChange = (newRange: string) => {
    dispatch(setNodeMetricsRange(newRange));
  };

  // Clear metrics when component unmounts or node changes
  useEffect(() => {
    return () => {
      dispatch(clearNodeMetrics());
    };
  }, [resourcename, dispatch]);

  // Show error state
  if (error) {
    return (
      <Card className="shadow-none rounded-lg mb-4">
        <CardHeader className="p-4">
          <CardTitle className="text-sm font-medium text-red-600">Node Metrics Error</CardTitle>
        </CardHeader>
        <CardContent className="px-4">
          <div className="text-sm text-muted-foreground">
            {error}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with time range selector */}
      <Card className="shadow-none rounded-lg">
        <CardHeader className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base font-semibold">Node Metrics</CardTitle>
              <div className="text-xs text-muted-foreground mt-1">
                Comprehensive monitoring for node {resourcename}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Time Range:</span>
              <Select value={range} onValueChange={handleRangeChange}>
                <SelectTrigger className="w-20 h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1d">1d</SelectItem>
                  <SelectItem value="7d">7d</SelectItem>
                  <SelectItem value="15d">15d</SelectItem>
                  <SelectItem value="30d">30d</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Node Summary - CPU and Memory Utilization */}
      <NodeSummaryChart series={series} loading={loading} />

      {/* Node Disk Usage */}
      <NodeDiskUsageChart series={series} loading={loading} />

      {/* Memory Usage Breakdown */}
      <NodeMemoryBreakdownChart series={series} loading={loading} />

      {/* Loading indicator for initial load */}
      {loading && series.length === 0 && (
        <Card className="shadow-none rounded-lg">
          <CardContent className="p-8 text-center">
            <div className="flex items-center justify-center">
              <svg className="w-8 h-8 animate-spin text-muted-foreground fill-foreground" viewBox="0 0 100 101" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M100 50.5908C100 78.2051 77.6142 100.591 50 100.591C22.3858 100.591 0 78.2051 0 50.5908C0 22.9766 22.3858 0.59082 50 0.59082C77.6142 0.59082 100 22.9766 100 50.5908ZM9.08144 50.5908C9.08144 73.1895 27.4013 91.5094 50 91.5094C72.5987 91.5094 90.9186 73.1895 90.9186 50.5908C90.9186 27.9921 72.5987 9.67226 50 9.67226C27.4013 9.67226 9.08144 27.9921 9.08144 50.5908Z" fill="currentColor"/>
                <path d="M93.9676 39.0409C96.393 38.4038 97.8624 35.9116 97.0079 33.5539C95.2932 28.8227 92.871 24.3692 89.8167 20.348C85.8452 15.1192 80.8826 10.7238 75.2124 7.41289C69.5422 4.10194 63.2754 1.94025 56.7698 1.05124C51.7666 0.367541 46.6976 0.446843 41.7345 1.27873C39.2613 1.69328 37.813 4.19778 38.4501 6.62326C39.0873 9.04874 41.5694 10.4717 44.0505 10.1071C47.8511 9.54855 51.7191 9.52689 55.5402 10.0491C60.8642 10.7766 65.9928 12.5457 70.6331 15.2552C75.2735 17.9648 79.3347 21.5619 82.5849 25.841C84.9175 28.9121 86.7997 32.2913 88.1811 35.8758C89.083 38.2158 91.5421 39.6781 93.9676 39.0409Z" fill="currentFill"/>
              </svg>
            </div>
            <div className="mt-4">
              <h3 className="text-lg md:text-xl font-semibold">Loading node metrics…</h3>
              <p className="text-sm text-muted-foreground mt-1">Fetching comprehensive monitoring data...</p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}