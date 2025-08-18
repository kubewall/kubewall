import kwFetch from '../kwFetch';

// Feature flags response interface
export interface FeatureFlagsResponse {
  enableTracing: boolean;
  enableCloudShell: boolean;
}

// Default feature flags
const DEFAULT_FEATURE_FLAGS: FeatureFlagsResponse = {
  enableTracing: false,
  enableCloudShell: false,
};

/**
 * Fetches runtime feature flags from the backend API
 * @returns Promise<FeatureFlagsResponse> The current feature flags configuration
 */
export const fetchRuntimeFeatureFlags = async (): Promise<FeatureFlagsResponse> => {
  try {
    const response = await kwFetch('/api/v1/feature-flags');
    return response as FeatureFlagsResponse;
  } catch (error) {
    console.warn('Failed to fetch runtime feature flags, using defaults:', error);
    return DEFAULT_FEATURE_FLAGS;
  }
};

/**
 * Cache for feature flags to avoid repeated API calls
 */
let featureFlagsCache: FeatureFlagsResponse | null = null;
let cacheTimestamp: number = 0;
const CACHE_DURATION = 30000; // 30 seconds

/**
 * Fetches runtime feature flags with caching
 * @param forceRefresh - Whether to force refresh the cache
 * @returns Promise<FeatureFlagsResponse> The current feature flags configuration
 */
export const fetchRuntimeFeatureFlagsWithCache = async (
  forceRefresh: boolean = false
): Promise<FeatureFlagsResponse> => {
  const now = Date.now();
  
  // Return cached data if it's still valid and not forcing refresh
  if (!forceRefresh && featureFlagsCache && (now - cacheTimestamp) < CACHE_DURATION) {
    return featureFlagsCache;
  }

  try {
    const flags = await fetchRuntimeFeatureFlags();
    featureFlagsCache = flags;
    cacheTimestamp = now;
    return flags;
  } catch (error) {
    // If we have cached data, return it even if it's stale
    if (featureFlagsCache) {
      console.warn('Using stale feature flags cache due to API error:', error);
      return featureFlagsCache;
    }
    
    // Otherwise return defaults
    return DEFAULT_FEATURE_FLAGS;
  }
};

/**
 * Clears the feature flags cache
 */
export const clearFeatureFlagsCache = (): void => {
  featureFlagsCache = null;
  cacheTimestamp = 0;
};