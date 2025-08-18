import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { createEventStreamQueryObject, getEventStreamUrl } from "@/utils";
import { useAppDispatch, useAppSelector } from "@/redux/hooks";
import { kwDetails, appRoute } from "@/routes";
import { memo, useCallback, useMemo } from "react";
import { updateSecretDependencies } from "@/data/Configurations/Secrets/SecretDependenciesSlice";
import { useEventSource } from "@/components/app/Common/Hooks/EventSource";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { SECRET_ENDPOINT_SINGULAR } from "@/constants";
import type { SecretDependencies } from "@/data/Configurations/Secrets/SecretDependenciesSlice";

// Import new modular components
import { ResourceList } from "./Dependencies/ResourceList";
import { VirtualizedResourceList } from "./Dependencies/VirtualizedResourceList";
import { ProgressiveResourceList } from "./Dependencies/ProgressiveResourceList";
import { LoadingState } from "./Dependencies/LoadingState";
import { NoDependenciesState, ErrorState } from "./Dependencies/EmptyState";
import { usePerformanceMonitor } from "@/hooks/usePerformanceMonitor";
import { useMemoryOptimization } from "@/hooks/useMemoryOptimization";
import { cn } from "@/lib/utils";

const SecretDependenciesContainer = memo(function () {
  const { config } = appRoute.useParams();
  const { cluster, resourcename, namespace } = kwDetails.useSearch();
  const {
    loading,
    secretDependencies,
    error
  } = useAppSelector((state) => state.secretDependencies);
  const dispatch = useAppDispatch();
  const navigate = useNavigate();

  // Calculate total dependency count for performance monitoring
  const totalDependencyCount = useMemo(() => {
    return Object.values(secretDependencies).reduce(
      (total, deps) => total + (Array.isArray(deps) ? deps.length : 0),
      0
    );
  }, [secretDependencies]);

  // Performance monitoring
  const { getPerformanceReport } = usePerformanceMonitor({
    componentName: 'SecretDependenciesContainer',
    itemCount: totalDependencyCount,
    enabled: process.env.NODE_ENV === 'development',
    logToConsole: totalDependencyCount > 50, // Log only for large datasets
  });

  // Memory optimization
  useMemoryOptimization({
    enabled: true,
    cleanupInterval: 30000,
    maxCacheSize: 500,
  });

  const sendMessage = useCallback((message: SecretDependencies) => {
    dispatch(updateSecretDependencies(message));
  }, [dispatch]);

  const handleConfigError = useCallback(() => {
    toast.error("Configuration Error", {
      description: "The configuration you were viewing has been deleted or is no longer available. Redirecting to configuration page.",
    });
    navigate({ to: '/config' });
  }, [navigate]);

  useEventSource({
    url: getEventStreamUrl(
      SECRET_ENDPOINT_SINGULAR,
      createEventStreamQueryObject(
        config,
        cluster,
        namespace
      ),
      `/${resourcename}/dependencies`
    ),
    sendMessage,
    onConfigError: handleConfigError,
  });

  const navigateToResource = useCallback((resourceType: string, resourceName: string, resourceNamespace: string) => {
    const searchParams = new URLSearchParams({
      cluster: cluster,
      resourcekind: resourceType,
      resourcename: resourceName,
      namespace: resourceNamespace,
    });
    
    navigate({ 
      to: `/${config}/details?${searchParams.toString()}` 
    });
  }, [navigate, config, cluster]);

  // Performance thresholds for different rendering strategies
  const PROGRESSIVE_THRESHOLD = 20;
  const VIRTUALIZATION_THRESHOLD = 100;
  
  // Helper function to determine which component to use based on data size
  const getOptimalComponent = useCallback((resources: any[], title: string, resourceType: string, options: any = {}) => {
    const count = resources?.length || 0;
    
    if (count > VIRTUALIZATION_THRESHOLD) {
      return (
        <VirtualizedResourceList
          title={title}
          resources={resources}
          resourceType={resourceType}
          onNavigate={navigateToResource}
          defaultExpanded={true}
          showSearch={count > 10}
          virtualizationThreshold={VIRTUALIZATION_THRESHOLD}
          itemHeight={100}
          maxHeight={500}
          className="border-border/30"
          {...options}
        />
      );
    } else if (count > PROGRESSIVE_THRESHOLD) {
      return (
        <ProgressiveResourceList
          title={title}
          resources={resources}
          resourceType={resourceType}
          onNavigate={navigateToResource}
          defaultExpanded={true}
          showSearch={count > 10}
          initialItemCount={15}
          incrementCount={25}
          maxItemsBeforeVirtualization={VIRTUALIZATION_THRESHOLD}
          className="border-border/30"
          {...options}
        />
      );
    } else {
      return (
        <ResourceList
          title={title}
          resources={resources}
          resourceType={resourceType}
          onNavigate={navigateToResource}
          defaultExpanded={true}
          showSearch={count > 5}
          className="border-border/30"
          {...options}
        />
      );
    }
  }, [navigateToResource]);

  const handleRetry = useCallback(() => {
    toast.info("Retrying...", {
      description: "Attempting to reload dependency information.",
    });
    // The event source will automatically reconnect
  }, []);

  // Check if there are any dependencies
  const hasAnyDependencies = useMemo(() => 
    Object.values(secretDependencies).some(deps => Array.isArray(deps) && deps.length > 0),
    [secretDependencies]
  );

  // Memoize performance report for development
  const performanceReport = useMemo(() => {
    if (process.env.NODE_ENV === 'development' && totalDependencyCount > 100) {
      return getPerformanceReport();
    }
    return null;
  }, [getPerformanceReport, totalDependencyCount]);

  // Handle error state
  if (error) {
    return (
      <ErrorState 
        onRetry={handleRetry}
        className="mt-4"
      />
    );
  }

  // Handle loading state
  if (loading) {
    return (
      <LoadingState 
        showMultipleCards={true}
        cardCount={2}
        className="mt-4"
      />
    );
  }

  // Handle empty state
  if (!hasAnyDependencies) {
    return (
      <NoDependenciesState 
        resourceType="secret"
        className="mt-4"
      />
    );
  }

  return (
    <div className="mt-4">
      <Card className={cn(
        "shadow-none rounded-lg border-border/50 bg-gradient-to-br from-card/80 to-card/40",
        "backdrop-blur-sm"
      )}>
        <CardHeader className="p-4 border-b border-border/50">
          <CardTitle className="text-sm font-medium flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <div className="h-2 w-2 rounded-full bg-primary/60 animate-pulse" />
              <span>Dependencies</span>
            </div>
            <div className="flex items-center space-x-2 text-xs text-muted-foreground font-normal">
              <span>{totalDependencyCount} total</span>
              {process.env.NODE_ENV === 'development' && performanceReport && (
                <span className="text-amber-600 dark:text-amber-400">
                  • Avg: {performanceReport.averageRenderTime.toFixed(1)}ms
                </span>
              )}
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4">
          <div className="text-sm text-muted-foreground mb-6 flex items-center space-x-2">
            <span>Workloads that use this secret:</span>
          </div>
          
          <div className="space-y-4">
            {secretDependencies.pods && secretDependencies.pods.length > 0 && 
              getOptimalComponent(
                secretDependencies.pods,
                "Pods",
                "pods",
                { showStatus: true }
              )
            }
            
            {secretDependencies.deployments && secretDependencies.deployments.length > 0 && 
              getOptimalComponent(
                secretDependencies.deployments,
                "Deployments",
                "deployments"
              )
            }
            
            {secretDependencies.jobs && secretDependencies.jobs.length > 0 && 
              getOptimalComponent(
                secretDependencies.jobs,
                "Jobs",
                "jobs",
                { defaultExpanded: false }
              )
            }
            
            {secretDependencies.cronjobs && secretDependencies.cronjobs.length > 0 && 
              getOptimalComponent(
                secretDependencies.cronjobs,
                "CronJobs",
                "cronjobs",
                { defaultExpanded: false }
              )
            }
          </div>
        </CardContent>
      </Card>
    </div>
  );
});

export {
  SecretDependenciesContainer
};