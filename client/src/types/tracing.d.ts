// Tracing types for OpenTelemetry trace visualization

export interface Trace {
  traceId: string;
  operationName: string;
  startTime: string;
  duration: number;
  status: 'success' | 'error';
  services: string[];
  spanCount: number;
  spans: Span[];
  tags: Record<string, string>;
}

export interface Span {
  spanId: string;
  traceId: string;
  parentSpanId?: string;
  operationName: string;
  serviceName: string;
  startTime: string;
  duration: number;
  status: 'success' | 'error';
  tags: Record<string, string>;
  logs: SpanLog[];
}

export interface SpanLog {
  timestamp: string;
  level: string;
  message: string;
  fields: Record<string, any>;
}



export interface TracingConfig {
  samplingRate: number;
  maxTraces: number;
  retentionHours: number;
  exportEnabled: boolean;
  jaegerEndpoint: string;
}

export interface TraceFilter {
  service?: string;
  operation?: string;
  startTime?: string;
  endTime?: string;
  minDuration?: string;
  maxDuration?: string;
  status?: 'success' | 'error';
  limit?: number;
  offset?: number;
}

export interface TraceResponse {
  traces: Trace[];
  total: number;
  hasMore: boolean;
}



export interface TraceStats {
  totalTraces: number;
  totalSpans: number;
  errorRate: number;
  avgDuration: number;
  p95Duration: number;
  serviceCount: number;
  operationCount: number;
}

// Redux state types
export interface TracingState {
  traces: {
    data: Trace[];
    loading: boolean;
    error: string | null;
    total: number;
    hasMore: boolean;
  };
  currentTrace: {
    data: Trace | null;
    loading: boolean;
    error: string | null;
  };

  config: {
    data: TracingConfig | null;
    loading: boolean;
    error: string | null;
  };
  stats: {
    data: TraceStats | null;
    loading: boolean;
    error: string | null;
  };
  filters: TraceFilter;
}

// Component props types
export interface TraceListProps {
  traces: Trace[];
  loading: boolean;
  onTraceSelect: (traceId: string) => void;
  onLoadMore?: () => void;
  hasMore?: boolean;
}

export interface TraceDetailsProps {
  trace: Trace;
  loading: boolean;
}



export interface TraceTimelineProps {
  spans: Span[];
  totalDuration: number;
  onSpanClick?: (span: Span) => void;
}

export interface TraceFiltersProps {
  filters: TraceFilter;
  onFiltersChange: (filters: TraceFilter) => void;
  onApplyFilters: () => void;
  onClearFilters: () => void;
}

export interface TracingSettingsProps {
  config: TracingConfig;
  onConfigChange: (config: TracingConfig) => void;
  onSaveConfig: () => void;
  loading: boolean;
}