import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { HelmReleaseDetails, HelmReleaseHistoryResponse } from '@/types';
import kwFetch from '../kwFetch';

interface HelmReleaseDetailsState {
  details: HelmReleaseDetails | null;
  history: HelmReleaseHistoryResponse[];
  loading: boolean;
  error: string | null;
  lastUpdated: number | null;
}

const initialState: HelmReleaseDetailsState = {
  details: null,
  history: [],
  loading: false,
  error: null,
  lastUpdated: null,
};

export const fetchHelmReleaseDetails = createAsyncThunk(
  'helmReleaseDetails/fetchHelmReleaseDetails',
  async (params: { config: string; cluster: string; name: string; namespace?: string }) => {
    const queryParams = new URLSearchParams({
      config: params.config,
      cluster: params.cluster,
      ...(params.namespace && { namespace: params.namespace }),
    });

    const response = await kwFetch(`/api/v1/helmreleases/${params.name}?${queryParams}`);
    if (!response.ok) {
      throw new Error(`Failed to fetch Helm release details: ${response.statusText}`);
    }

    const data: HelmReleaseDetails = await response.json();
    return data;
  }
);

export const fetchHelmReleaseHistory = createAsyncThunk(
  'helmReleaseDetails/fetchHelmReleaseHistory',
  async (params: { config: string; cluster: string; name: string; namespace?: string }) => {
    const queryParams = new URLSearchParams({
      config: params.config,
      cluster: params.cluster,
      ...(params.namespace && { namespace: params.namespace }),
    });

    const response = await kwFetch(`/api/v1/helmreleases/${params.name}/history?${queryParams}`);
    if (!response.ok) {
      throw new Error(`Failed to fetch Helm release history: ${response.statusText}`);
    }

    const data: HelmReleaseHistoryResponse[] = await response.json();
    return data;
  }
);

const helmReleaseDetailsSlice = createSlice({
  name: 'helmReleaseDetails',
  initialState,
  reducers: {
    clearHelmReleaseDetails: (state) => {
      state.details = null;
      state.history = [];
      state.error = null;
      state.lastUpdated = null;
    },
    setHelmReleaseDetailsError: (state, action: PayloadAction<string>) => {
      state.error = action.payload;
      state.loading = false;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchHelmReleaseDetails.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchHelmReleaseDetails.fulfilled, (state, action) => {
        state.loading = false;
        state.details = action.payload;
        state.lastUpdated = Date.now();
        state.error = null;
      })
      .addCase(fetchHelmReleaseDetails.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || 'Failed to fetch Helm release details';
      })
      .addCase(fetchHelmReleaseHistory.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchHelmReleaseHistory.fulfilled, (state, action) => {
        state.loading = false;
        state.history = action.payload;
        state.lastUpdated = Date.now();
        state.error = null;
      })
      .addCase(fetchHelmReleaseHistory.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || 'Failed to fetch Helm release history';
      });
  },
});

export const { clearHelmReleaseDetails, setHelmReleaseDetailsError } = helmReleaseDetailsSlice.actions;
export default helmReleaseDetailsSlice.reducer; 