import { createSlice, PayloadAction, createAsyncThunk } from '@reduxjs/toolkit';
import { HelmReleaseResourcesResponse } from '@/types';
import kwFetch from '@/data/kwFetch';
import { API_VERSION } from '@/constants/ApiConstants';

interface HelmReleaseResourcesState {
  resources: HelmReleaseResourcesResponse | null;
  loading: boolean;
  error: string | null;
  lastUpdated: number | null;
}

const initialState: HelmReleaseResourcesState = {
  resources: null,
  loading: false,
  error: null,
  lastUpdated: null,
};

const helmReleaseResourcesSlice = createSlice({
  name: 'helmReleaseResources',
  initialState,
  reducers: {
    clearHelmReleaseResources: (state) => {
      state.resources = null;
      state.error = null;
      state.lastUpdated = null;
    },
    setHelmReleaseResourcesError: (state, action: PayloadAction<string>) => {
      state.error = action.payload;
      state.loading = false;
    },
    updateHelmReleaseResources: (state, action: PayloadAction<HelmReleaseResourcesResponse>) => {
      state.resources = action.payload;
      state.loading = false;
      state.error = null;
      state.lastUpdated = Date.now();
    },
    setHelmReleaseResourcesLoading: (state, action: PayloadAction<boolean>) => {
      state.loading = action.payload;
    },
  },
  extraReducers: (builder) => {
    builder.addCase(fetchHelmReleaseResources.pending, (state) => {
      state.loading = true;
      state.error = null;
    });
    builder.addCase(fetchHelmReleaseResources.fulfilled, (state, action) => {
      state.resources = action.payload;
      state.loading = false;
      state.error = null;
      state.lastUpdated = Date.now();
    });
    builder.addCase(fetchHelmReleaseResources.rejected, (state, action) => {
      state.loading = false;
      state.error = (action.payload as Error)?.message || 'Failed to fetch Helm release resources';
    });
  },
});

export const { 
  clearHelmReleaseResources, 
  setHelmReleaseResourcesError, 
  updateHelmReleaseResources, 
  setHelmReleaseResourcesLoading 
} = helmReleaseResourcesSlice.actions;

// Async thunk for fetching Helm release resources
export const fetchHelmReleaseResources = createAsyncThunk(
  'helmReleaseResources/fetch',
  async (params: { 
    config: string; 
    cluster: string; 
    releaseName: string; 
    namespace?: string 
  }, thunkAPI) => {
    const queryParams = new URLSearchParams({
      config: params.config,
      cluster: params.cluster,
      ...(params.namespace && { namespace: params.namespace }),
    });

    try {
      const response = await kwFetch(
        `${API_VERSION}/helmreleases/${params.releaseName}/resources?${queryParams}`
      );
      return response as HelmReleaseResourcesResponse;
    } catch (error) {
      return thunkAPI.rejectWithValue(error as Error);
    }
  }
);



export default helmReleaseResourcesSlice.reducer; 