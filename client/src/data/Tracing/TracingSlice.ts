import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import kwFetch from '../kwFetch';
import {
  TracingState,
  Trace,
  TraceFilter,
  TraceResponse,

  TracingConfig,
  TraceStats,
} from '../../types/tracing';

// Async thunks for API calls
export const fetchTraces = createAsyncThunk(
  'tracing/fetchTraces',
  async (filters: TraceFilter) => {
    const params = new URLSearchParams();
    
    if (filters.service) params.append('service', filters.service);
    if (filters.operation) params.append('operation', filters.operation);
    if (filters.startTime) params.append('startTime', filters.startTime);
    if (filters.endTime) params.append('endTime', filters.endTime);
    if (filters.minDuration) params.append('minDuration', filters.minDuration);
    if (filters.maxDuration) params.append('maxDuration', filters.maxDuration);
    if (filters.status) params.append('status', filters.status);
    if (filters.limit) params.append('limit', filters.limit.toString());
    if (filters.offset) params.append('offset', filters.offset.toString());

    const response = await kwFetch(`/api/v1/traces?${params.toString()}`);
    return response as TraceResponse;
  }
);

export const fetchTrace = createAsyncThunk(
  'tracing/fetchTrace',
  async (traceId: string) => {
    const response = await kwFetch(`/api/v1/traces/${traceId}`);
    return response.trace as Trace;
  }
);



export const fetchTracingConfig = createAsyncThunk(
  'tracing/fetchTracingConfig',
  async () => {
    const response = await kwFetch('/api/v1/tracing/config');
    return response as TracingConfig;
  }
);

export const updateTracingConfig = createAsyncThunk(
  'tracing/updateTracingConfig',
  async (config: TracingConfig) => {
    await kwFetch('/api/v1/tracing/config', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(config),
    });
    return config;
  }
);

export const fetchTraceStats = createAsyncThunk(
  'tracing/fetchTraceStats',
  async (timeRange: string = '1h') => {
    const response = await kwFetch(`/api/v1/traces/stats?timeRange=${timeRange}`);
    return response as TraceStats;
  }
);

export const exportTraces = createAsyncThunk(
  'tracing/exportTraces',
  async (filters: TraceFilter) => {
    const params = new URLSearchParams();
    
    if (filters.service) params.append('service', filters.service);
    if (filters.operation) params.append('operation', filters.operation);
    if (filters.startTime) params.append('startTime', filters.startTime);
    if (filters.endTime) params.append('endTime', filters.endTime);
    if (filters.status) params.append('status', filters.status);

    const response = await kwFetch(`/api/v1/traces/export?${params.toString()}`);
    return response as TraceResponse;
  }
);

// Initial state
const initialState: TracingState = {
  traces: {
    data: [],
    loading: false,
    error: null,
    total: 0,
    hasMore: false,
  },
  currentTrace: {
    data: null,
    loading: false,
    error: null,
  },

  config: {
    data: null,
    loading: false,
    error: null,
  },
  stats: {
    data: null,
    loading: false,
    error: null,
  },
  filters: {
    limit: 100,
    offset: 0,
  },
};

// Slice
const tracingSlice = createSlice({
  name: 'tracing',
  initialState,
  reducers: {
    setFilters: (state, action: PayloadAction<TraceFilter>) => {
      state.filters = { ...state.filters, ...action.payload };
    },
    clearFilters: (state) => {
      state.filters = {
        limit: 100,
        offset: 0,
      };
    },
    clearCurrentTrace: (state) => {
      state.currentTrace.data = null;
      state.currentTrace.error = null;
    },
    clearTraces: (state) => {
      state.traces.data = [];
      state.traces.total = 0;
      state.traces.hasMore = false;
      state.traces.error = null;
    },
  },
  extraReducers: (builder) => {
    // Fetch traces
    builder
      .addCase(fetchTraces.pending, (state) => {
        state.traces.loading = true;
        state.traces.error = null;
      })
      .addCase(fetchTraces.fulfilled, (state, action) => {
        state.traces.loading = false;
        if (action.meta.arg.offset === 0) {
          // New search, replace data
          state.traces.data = action.payload.traces;
        } else {
          // Load more, append data
          state.traces.data = [...state.traces.data, ...action.payload.traces];
        }
        state.traces.total = action.payload.total;
        state.traces.hasMore = action.payload.hasMore;
      })
      .addCase(fetchTraces.rejected, (state, action) => {
        state.traces.loading = false;
        state.traces.error = action.error.message || 'Failed to fetch traces';
      });

    // Fetch single trace
    builder
      .addCase(fetchTrace.pending, (state) => {
        state.currentTrace.loading = true;
        state.currentTrace.error = null;
      })
      .addCase(fetchTrace.fulfilled, (state, action) => {
        state.currentTrace.loading = false;
        state.currentTrace.data = action.payload;
      })
      .addCase(fetchTrace.rejected, (state, action) => {
        state.currentTrace.loading = false;
        state.currentTrace.error = action.error.message || 'Failed to fetch trace';
      });



    // Fetch tracing config
    builder
      .addCase(fetchTracingConfig.pending, (state) => {
        state.config.loading = true;
        state.config.error = null;
      })
      .addCase(fetchTracingConfig.fulfilled, (state, action) => {
        state.config.loading = false;
        state.config.data = action.payload;
      })
      .addCase(fetchTracingConfig.rejected, (state, action) => {
        state.config.loading = false;
        state.config.error = action.error.message || 'Failed to fetch tracing config';
      });

    // Update tracing config
    builder
      .addCase(updateTracingConfig.pending, (state) => {
        state.config.loading = true;
        state.config.error = null;
      })
      .addCase(updateTracingConfig.fulfilled, (state, action) => {
        state.config.loading = false;
        state.config.data = action.payload;
      })
      .addCase(updateTracingConfig.rejected, (state, action) => {
        state.config.loading = false;
        state.config.error = action.error.message || 'Failed to update tracing config';
      });

    // Fetch trace stats
    builder
      .addCase(fetchTraceStats.pending, (state) => {
        state.stats.loading = true;
        state.stats.error = null;
      })
      .addCase(fetchTraceStats.fulfilled, (state, action) => {
        state.stats.loading = false;
        state.stats.data = action.payload;
      })
      .addCase(fetchTraceStats.rejected, (state, action) => {
        state.stats.loading = false;
        state.stats.error = action.error.message || 'Failed to fetch trace stats';
      });
  },
});

export const { setFilters, clearFilters, clearCurrentTrace, clearTraces } = tracingSlice.actions;
export default tracingSlice.reducer;