import { useState, useEffect, useCallback } from 'react';
import { 
  initializeRuntimeFeatureFlags, 
  getCurrentFeatureFlags, 
  isFeatureEnabled,
  type FeatureFlags 
} from '../constants/FeatureFlags';

interface UseRuntimeFeatureFlagsReturn {
  featureFlags: FeatureFlags;
  isLoading: boolean;
  error: string | null;
  refreshFlags: () => Promise<void>;
  isFeatureEnabled: (feature: keyof FeatureFlags) => boolean;
}

/**
 * Hook for managing runtime feature flags
 * Automatically fetches feature flags on mount and provides utilities for checking flags
 */
export const useRuntimeFeatureFlags = (): UseRuntimeFeatureFlagsReturn => {
  const [featureFlags, setFeatureFlags] = useState<FeatureFlags>(getCurrentFeatureFlags());
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Function to refresh feature flags
  const refreshFlags = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      const flags = await initializeRuntimeFeatureFlags();
      setFeatureFlags(flags);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch feature flags';
      setError(errorMessage);
      console.error('Error fetching runtime feature flags:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Initialize feature flags on mount
  useEffect(() => {
    refreshFlags();
  }, [refreshFlags]);

  // Helper function to check if a feature is enabled
  const checkFeatureEnabled = useCallback((feature: keyof FeatureFlags): boolean => {
    return isFeatureEnabled(feature);
  }, [featureFlags]);

  return {
    featureFlags,
    isLoading,
    error,
    refreshFlags,
    isFeatureEnabled: checkFeatureEnabled,
  };
};

/**
 * Simplified hook that only returns whether a specific feature is enabled
 * Useful when you only need to check one feature flag
 */
export const useFeatureFlag = (feature: keyof FeatureFlags): {
  isEnabled: boolean;
  isLoading: boolean;
  error: string | null;
} => {
  const { isLoading, error, isFeatureEnabled } = useRuntimeFeatureFlags();
  
  return {
    isEnabled: isFeatureEnabled(feature),
    isLoading,
    error,
  };
};

/**
 * Hook specifically for tracing feature flag
 * Most commonly used feature flag gets its own hook for convenience
 */
export const useTracingFeatureFlag = () => {
  return useFeatureFlag('ENABLE_TRACING');
};