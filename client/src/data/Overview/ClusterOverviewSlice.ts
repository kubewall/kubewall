import { createSlice } from '@reduxjs/toolkit';
import { resetAllStates } from '@/redux/hooks';

type Series = {
  metric: string;
  points: Array<{ t: number; v: number }>;
};

type InitialState = {
  loading: boolean;
  series: Series[];
  instant: any;
  hasProm: boolean;
  error: string | null;
  range: string;
};

const initialState: InitialState = {
  loading: true,
  series: [],
  instant: null,
  hasProm: false,
  error: null,
  range: '24h',
};

const clusterOverviewSlice = createSlice({
  name: 'clusterOverview',
  initialState,
  reducers: {
    updateClusterOverview: (state, action) => {
      const { series, instant } = action.payload;
      state.series = Array.isArray(series) ? series : [];
      state.instant = instant || null;
      state.loading = false;
      state.error = null;
    },
    setClusterOverviewLoading: (state, action) => {
      state.loading = action.payload;
    },
    setPrometheusAvailability: (state, action) => {
      state.hasProm = action.payload;
    },
    setClusterOverviewError: (state, action) => {
      state.error = action.payload;
      state.loading = false;
    },
    setClusterOverviewRange: (state, action) => {
      state.range = action.payload;
    },
    resetClusterOverview: (state) => {
      state.series = [];
      state.instant = null;
      state.loading = true;
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder.addCase(resetAllStates, () => initialState);
  },
});

export const {
  updateClusterOverview,
  setClusterOverviewLoading,
  setPrometheusAvailability,
  setClusterOverviewError,
  setClusterOverviewRange,
  resetClusterOverview,
} = clusterOverviewSlice.actions;

export default clusterOverviewSlice.reducer;