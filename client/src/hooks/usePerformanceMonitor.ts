import { useEffect, useRef, useCallback } from 'react';

interface PerformanceMetrics {
  renderTime: number;
  memoryUsage?: number;
  componentName: string;
  itemCount: number;
}

interface UsePerformanceMonitorOptions {
  componentName: string;
  itemCount: number;
  enabled?: boolean;
  logToConsole?: boolean;
}

/**
 * Custom hook to monitor component performance
 * Tracks render times and memory usage for optimization purposes
 */
export function usePerformanceMonitor({
  componentName,
  itemCount,
  enabled = process.env.NODE_ENV === 'development',
  logToConsole = false,
}: UsePerformanceMonitorOptions) {
  const renderStartTime = useRef<number>(0);
  const metricsHistory = useRef<PerformanceMetrics[]>([]);
  const maxHistorySize = 50; // Keep last 50 measurements

  const startMeasurement = useCallback(() => {
    if (!enabled) return;
    renderStartTime.current = performance.now();
  }, [enabled]);

  const endMeasurement = useCallback(() => {
    if (!enabled || renderStartTime.current === 0) return;
    
    const renderTime = performance.now() - renderStartTime.current;
    let memoryUsage: number | undefined;

    // Get memory usage if available (Chrome/Edge)
    if ('memory' in performance && (performance as any).memory) {
      const memory = (performance as any).memory;
      memoryUsage = memory.usedJSHeapSize / 1024 / 1024; // Convert to MB
    }

    const metrics: PerformanceMetrics = {
      renderTime,
      memoryUsage,
      componentName,
      itemCount,
    };

    // Add to history
    metricsHistory.current.push(metrics);
    
    // Keep only recent measurements
    if (metricsHistory.current.length > maxHistorySize) {
      metricsHistory.current = metricsHistory.current.slice(-maxHistorySize);
    }

    // Log performance warnings
    if (logToConsole) {
      if (renderTime > 16) { // More than one frame at 60fps
        console.warn(
          `🐌 Slow render detected in ${componentName}:`,
          `${renderTime.toFixed(2)}ms for ${itemCount} items`
        );
      }
      
      if (memoryUsage && memoryUsage > 100) { // More than 100MB
        console.warn(
          `🧠 High memory usage in ${componentName}:`,
          `${memoryUsage.toFixed(2)}MB`
        );
      }
    }

    renderStartTime.current = 0;
  }, [enabled, componentName, itemCount, logToConsole]);

  const getAverageRenderTime = useCallback(() => {
    if (metricsHistory.current.length === 0) return 0;
    
    const total = metricsHistory.current.reduce((sum, metric) => sum + metric.renderTime, 0);
    return total / metricsHistory.current.length;
  }, []);

  const getPerformanceReport = useCallback(() => {
    const history = metricsHistory.current;
    if (history.length === 0) {
      return {
        averageRenderTime: 0,
        maxRenderTime: 0,
        minRenderTime: 0,
        totalMeasurements: 0,
        averageMemoryUsage: 0,
        recommendations: [],
      };
    }

    const renderTimes = history.map(m => m.renderTime);
    const memoryUsages = history.filter(m => m.memoryUsage).map(m => m.memoryUsage!);
    
    const averageRenderTime = renderTimes.reduce((a, b) => a + b, 0) / renderTimes.length;
    const maxRenderTime = Math.max(...renderTimes);
    const minRenderTime = Math.min(...renderTimes);
    const averageMemoryUsage = memoryUsages.length > 0 
      ? memoryUsages.reduce((a, b) => a + b, 0) / memoryUsages.length 
      : 0;

    const recommendations: string[] = [];
    
    if (averageRenderTime > 16) {
      recommendations.push('Consider virtualization for better performance');
    }
    
    if (maxRenderTime > 100) {
      recommendations.push('Implement progressive loading to reduce initial render time');
    }
    
    if (averageMemoryUsage > 50) {
      recommendations.push('Monitor memory usage - consider implementing cleanup strategies');
    }

    return {
      averageRenderTime,
      maxRenderTime,
      minRenderTime,
      totalMeasurements: history.length,
      averageMemoryUsage,
      recommendations,
    };
  }, []);

  // Start measurement on every render
  useEffect(() => {
    startMeasurement();
  });

  // End measurement after render
  useEffect(() => {
    endMeasurement();
  });

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      metricsHistory.current = [];
    };
  }, []);

  return {
    getAverageRenderTime,
    getPerformanceReport,
    metricsHistory: metricsHistory.current,
  };
}