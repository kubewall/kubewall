import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { HelmChart } from '@/types/helm';
import { resetAllStates } from '@/redux/hooks';

type InitialState = {
  loading: boolean;
  charts: HelmChart[];
  totalCharts: number;
  currentPage: number;
  totalPages: number;
  searchQuery: string;
  error: string | null;
};

const initialState: InitialState = {
  loading: false,
  charts: [],
  totalCharts: 0,
  currentPage: 1,
  totalPages: 1,
  searchQuery: '',
  error: null,
};

const helmChartsSlice = createSlice({
  name: 'helmCharts',
  initialState,
  reducers: {
    setLoading: (state, action: PayloadAction<boolean>) => {
      state.loading = action.payload;
    },
    setCharts: (state, action: PayloadAction<{ charts: HelmChart[]; total: number; page: number; totalPages: number }>) => {
      state.charts = action.payload.charts;
      state.totalCharts = action.payload.total;
      state.currentPage = action.payload.page;
      state.totalPages = action.payload.totalPages;
      state.loading = false;
      state.error = null;
    },
    setSearchQuery: (state, action: PayloadAction<string>) => {
      state.searchQuery = action.payload;
    },
    setError: (state, action: PayloadAction<string>) => {
      state.error = action.payload;
      state.loading = false;
    },
    resetHelmCharts: () => {
      return initialState;
    },
  },
  extraReducers: (builder) => {
    builder.addCase(resetAllStates, () => initialState);
  },
});

export default helmChartsSlice.reducer;
const { setLoading, setCharts, setSearchQuery, setError, resetHelmCharts } = helmChartsSlice.actions;
export { initialState, setLoading, setCharts, setSearchQuery, setError, resetHelmCharts };