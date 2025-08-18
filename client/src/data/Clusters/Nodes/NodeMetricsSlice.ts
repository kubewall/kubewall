import { createSlice } from '@reduxjs/toolkit';
import { resetAllStates } from '@/redux/hooks';

// Types for node metrics data
export interface MetricPoint {
  t: number;
  v: number;
}

export interface MetricSeries {
  metric: string;
  points: MetricPoint[];
}

export interface InstantMetrics {
  pods?: {
    used: any;
    capacity: any;
  };
  cpu_utilization?: any;
  memory_utilization?: any;
  disk_used?: any;
  disk_available?: any;
}

type InitialState = {
  loading: boolean;
  series: MetricSeries[];
  instant: InstantMetrics | null;
  range: string;
  step: string;
  error: string | null;
  lastUpdated: number | null;
};

const initialState: InitialState = {
  loading: true,
  series: [],
  instant: null,
  range: '1d',
  step: '1h',
  error: null,
  lastUpdated: null,
};

const nodeMetricsSlice = createSlice({
  name: 'nodeMetrics',
  initialState,
  reducers: {
    updateNodeMetrics: (state, action) => {
      state.series = action.payload.series || [];
      state.instant = action.payload.instant || null;
      state.loading = false;
      state.error = null;
      state.lastUpdated = Date.now();
    },
    setNodeMetricsLoading: (state, action) => {
      state.loading = action.payload;
    },
    setNodeMetricsError: (state, action) => {
      state.error = action.payload;
      state.loading = false;
    },
    setNodeMetricsRange: (state, action) => {
      state.range = action.payload;
      state.loading = true; // Trigger reload when range changes
    },
    setNodeMetricsStep: (state, action) => {
      state.step = action.payload;
      state.loading = true; // Trigger reload when step changes
    },
    clearNodeMetrics: (state) => {
      state.series = [];
      state.instant = null;
      state.error = null;
      state.lastUpdated = null;
    },
  },
  extraReducers: (builder) => {
    builder.addCase(resetAllStates, () => initialState);
  },
});

export const {
  updateNodeMetrics,
  setNodeMetricsLoading,
  setNodeMetricsError,
  setNodeMetricsRange,
  setNodeMetricsStep,
  clearNodeMetrics,
} = nodeMetricsSlice.actions;

export default nodeMetricsSlice.reducer;