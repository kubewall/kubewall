import { useCallback, useMemo } from "react";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { useAppDispatch, useAppSelector } from "@/redux/hooks";
import { useEventSource } from "@/components/app/Common/Hooks/EventSource";
import { createEventStreamQueryObject, getEventStreamUrl } from "@/utils";
import { kwDetails, appRoute } from "@/routes";
import type { DependencyResource } from "./DependencyCard";

// Generic dependency types
export interface DependencyData {
  pods?: DependencyResource[];
  deployments?: DependencyResource[];
  jobs?: DependencyResource[];
  cronjobs?: DependencyResource[];
  [key: string]: DependencyResource[] | undefined;
}

export interface DependencyState {
  loading: boolean;
  dependencies: DependencyData;
  error?: string;
}

interface UseDependenciesOptions {
  resourceType: string;
  endpointSingular: string;
  updateAction: (data: any) => any;
  selector: (state: any) => DependencyState;
  onError?: (error: string) => void;
}

export function useDependencies({
  resourceType,
  endpointSingular,
  updateAction,
  selector,
  onError,
}: UseDependenciesOptions) {
  const { config } = appRoute.useParams();
  const { cluster, resourcename, namespace } = kwDetails.useSearch();
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  
  const { loading, dependencies, error } = useAppSelector(selector);

  // Handle incoming dependency updates
  const sendMessage = useCallback(
    (message: DependencyData) => {
      dispatch(updateAction(message));
    },
    [dispatch, updateAction]
  );

  // Handle configuration errors
  const handleConfigError = useCallback(() => {
    const errorMessage = "The configuration you were viewing has been deleted or is no longer available.";
    toast.error("Configuration Error", {
      description: errorMessage,
    });
    if (onError) {
      onError(errorMessage);
    }
    navigate({ to: '/config' });
  }, [navigate, onError]);

  // Set up event source for real-time updates
  useEventSource({
    url: getEventStreamUrl(
      endpointSingular,
      createEventStreamQueryObject(config, cluster, namespace),
      `/${resourcename}/dependencies`
    ),
    sendMessage,
    onConfigError: handleConfigError,
  });

  // Navigation handler for dependency resources
  const navigateToResource = useCallback(
    (resourceType: string, resourceName: string, resourceNamespace: string) => {
      const searchParams = new URLSearchParams({
        cluster: cluster,
        resourcekind: resourceType,
        resourcename: resourceName,
        namespace: resourceNamespace,
      });
      
      navigate({ 
        to: `/${config}/details?${searchParams.toString()}` 
      });
    },
    [navigate, config, cluster]
  );

  // Check if there are any dependencies
  const hasAnyDependencies = useMemo(() => {
    return Object.values(dependencies).some(
      (deps) => Array.isArray(deps) && deps.length > 0
    );
  }, [dependencies]);

  // Get total count of all dependencies
  const totalDependencyCount = useMemo(() => {
    return Object.values(dependencies).reduce(
      (total, deps) => total + (Array.isArray(deps) ? deps.length : 0),
      0
    );
  }, [dependencies]);

  // Get dependency counts by type
  const dependencyCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    Object.entries(dependencies).forEach(([key, deps]) => {
      counts[key] = Array.isArray(deps) ? deps.length : 0;
    });
    return counts;
  }, [dependencies]);

  // Filter dependencies by search query
  const filterDependencies = useCallback(
    (deps: DependencyResource[], searchQuery: string): DependencyResource[] => {
      if (!searchQuery.trim()) return deps;
      
      const query = searchQuery.toLowerCase();
      return deps.filter(
        (resource) =>
          resource.name.toLowerCase().includes(query) ||
          resource.namespace.toLowerCase().includes(query) ||
          (resource.status && resource.status.toLowerCase().includes(query))
      );
    },
    []
  );

  // Retry mechanism for failed requests
  const retry = useCallback(() => {
    // This would typically trigger a refetch of the data
    // For now, we'll just clear any error state
    if (error) {
      // You might want to dispatch a retry action here
      toast.info("Retrying...", {
        description: "Attempting to reload dependency information.",
      });
    }
  }, [error]);

  return {
    // State
    loading,
    dependencies,
    error,
    hasAnyDependencies,
    totalDependencyCount,
    dependencyCounts,
    
    // Actions
    navigateToResource,
    filterDependencies,
    retry,
    
    // Metadata
    resourceType,
    config,
    cluster,
    resourcename,
    namespace,
  };
}

// Specialized hook for secrets
export function useSecretDependencies() {
  return useDependencies({
    resourceType: "secret",
    endpointSingular: "SECRET_ENDPOINT_SINGULAR", // This should be imported from constants
    updateAction: (data: any) => ({ type: 'secretDependencies/updateSecretDependencies', payload: data }),
    selector: (state: any) => state.secretDependencies,
  });
}

// Specialized hook for config maps
export function useConfigMapDependencies() {
  return useDependencies({
    resourceType: "configmap",
    endpointSingular: "CONFIGMAP_ENDPOINT_SINGULAR", // This should be imported from constants
    updateAction: (data: any) => ({ type: 'configMapDependencies/updateConfigMapDependencies', payload: data }),
    selector: (state: any) => state.configMapDependencies,
  });
}

export type { UseDependenciesOptions };