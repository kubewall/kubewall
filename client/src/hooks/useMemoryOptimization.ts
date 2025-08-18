import { useEffect, useRef, useCallback } from 'react';

interface UseMemoryOptimizationOptions {
  enabled?: boolean;
  cleanupInterval?: number; // in milliseconds
  maxCacheSize?: number;
}

/**
 * Custom hook for memory optimization and cleanup
 * Helps prevent memory leaks and optimize performance in large datasets
 */
export function useMemoryOptimization({
  enabled = true,
  cleanupInterval = 30000, // 30 seconds
  maxCacheSize = 1000,
}: UseMemoryOptimizationOptions = {}) {
  const cleanupTimerRef = useRef<NodeJS.Timeout | null>(null);
  const cacheRef = useRef<Map<string, any>>(new Map());
  const observersRef = useRef<Set<IntersectionObserver | ResizeObserver>>(new Set());
  const eventListenersRef = useRef<Set<() => void>>(new Set());

  // Cache management with LRU-like behavior
  const setCache = useCallback((key: string, value: any) => {
    if (!enabled) return;
    
    const cache = cacheRef.current;
    
    // Remove oldest entries if cache is too large
    if (cache.size >= maxCacheSize) {
      const firstKey = cache.keys().next().value;
      if (firstKey) {
        cache.delete(firstKey);
      }
    }
    
    cache.set(key, value);
  }, [enabled, maxCacheSize]);

  const getCache = useCallback((key: string) => {
    if (!enabled) return undefined;
    return cacheRef.current.get(key);
  }, [enabled]);

  const clearCache = useCallback(() => {
    cacheRef.current.clear();
  }, []);

  // Observer management
  const addObserver = useCallback((observer: IntersectionObserver | ResizeObserver) => {
    if (!enabled) return;
    observersRef.current.add(observer);
  }, [enabled]);

  const removeObserver = useCallback((observer: IntersectionObserver | ResizeObserver) => {
    observersRef.current.delete(observer);
    observer.disconnect();
  }, []);

  const cleanupObservers = useCallback(() => {
    observersRef.current.forEach(observer => {
      observer.disconnect();
    });
    observersRef.current.clear();
  }, []);

  // Event listener management
  const addEventListenerCleanup = useCallback((cleanup: () => void) => {
    if (!enabled) return;
    eventListenersRef.current.add(cleanup);
  }, [enabled]);

  const removeEventListenerCleanup = useCallback((cleanup: () => void) => {
    eventListenersRef.current.delete(cleanup);
  }, []);

  const cleanupEventListeners = useCallback(() => {
    eventListenersRef.current.forEach(cleanup => {
      try {
        cleanup();
      } catch (error) {
        console.warn('Error during event listener cleanup:', error);
      }
    });
    eventListenersRef.current.clear();
  }, []);

  // Periodic cleanup
  const startPeriodicCleanup = useCallback(() => {
    if (!enabled || cleanupTimerRef.current) return;
    
    cleanupTimerRef.current = setInterval(() => {
      // Clear old cache entries
      const cache = cacheRef.current;
      if (cache.size > maxCacheSize * 0.8) {
        const keysToDelete = Array.from(cache.keys()).slice(0, Math.floor(cache.size * 0.2));
        keysToDelete.forEach(key => cache.delete(key));
      }
      
      // Force garbage collection if available (development only)
      if (process.env.NODE_ENV === 'development' && 'gc' in window) {
        try {
          (window as any).gc();
        } catch (e) {
          // Ignore errors
        }
      }
    }, cleanupInterval);
  }, [enabled, cleanupInterval, maxCacheSize]);

  const stopPeriodicCleanup = useCallback(() => {
    if (cleanupTimerRef.current) {
      clearInterval(cleanupTimerRef.current);
      cleanupTimerRef.current = null;
    }
  }, []);

  // Memory usage monitoring (Chrome/Edge only)
  const getMemoryUsage = useCallback(() => {
    if ('memory' in performance && (performance as any).memory) {
      const memory = (performance as any).memory;
      return {
        used: Math.round(memory.usedJSHeapSize / 1024 / 1024), // MB
        total: Math.round(memory.totalJSHeapSize / 1024 / 1024), // MB
        limit: Math.round(memory.jsHeapSizeLimit / 1024 / 1024), // MB
      };
    }
    return null;
  }, []);

  // Complete cleanup function
  const cleanup = useCallback(() => {
    stopPeriodicCleanup();
    clearCache();
    cleanupObservers();
    cleanupEventListeners();
  }, [stopPeriodicCleanup, clearCache, cleanupObservers, cleanupEventListeners]);

  // Start periodic cleanup on mount
  useEffect(() => {
    if (enabled) {
      startPeriodicCleanup();
    }
    
    return () => {
      cleanup();
    };
  }, [enabled, startPeriodicCleanup, cleanup]);

  // Cleanup on page visibility change (when tab becomes hidden)
  useEffect(() => {
    if (!enabled) return;
    
    const handleVisibilityChange = () => {
      if (document.hidden) {
        // Page is hidden, perform cleanup
        clearCache();
        cleanupObservers();
      }
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    const cleanupListener = () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
    
    addEventListenerCleanup(cleanupListener);
    
    return cleanupListener;
  }, [enabled, clearCache, cleanupObservers, addEventListenerCleanup]);

  return {
    // Cache management
    setCache,
    getCache,
    clearCache,
    
    // Observer management
    addObserver,
    removeObserver,
    cleanupObservers,
    
    // Event listener management
    addEventListenerCleanup,
    removeEventListenerCleanup,
    cleanupEventListeners,
    
    // Cleanup control
    startPeriodicCleanup,
    stopPeriodicCleanup,
    cleanup,
    
    // Memory monitoring
    getMemoryUsage,
    
    // Stats
    getCacheSize: () => cacheRef.current.size,
    getObserverCount: () => observersRef.current.size,
    getEventListenerCount: () => eventListenersRef.current.size,
  };
}