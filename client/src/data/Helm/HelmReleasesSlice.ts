import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { HelmReleaseList, HelmRelease } from '@/types';

interface HelmReleasesState {
  releases: HelmRelease[];
  total: number;
  loading: boolean;
  error: string | null;
  lastUpdated: number | null;
}

const initialState: HelmReleasesState = {
  releases: [],
  total: 0,
  loading: false,
  error: null,
  lastUpdated: null,
};

const helmReleasesSlice = createSlice({
  name: 'helmReleases',
  initialState,
  reducers: {
    clearHelmReleases: (state) => {
      state.releases = [];
      state.total = 0;
      state.error = null;
      state.lastUpdated = null;
    },
    setHelmReleasesError: (state, action: PayloadAction<string>) => {
      state.error = action.payload;
      state.loading = false;
    },
    updateHelmReleases: (state, action: PayloadAction<HelmReleaseList | HelmRelease[]>) => {
      // Handle both old HelmReleaseList format and new array format
      if (Array.isArray(action.payload)) {
        // New format: direct array of releases
        state.releases = action.payload;
        state.total = action.payload.length;
      } else {
        // Old format: HelmReleaseList object
        state.releases = action.payload.releases;
        state.total = action.payload.total;
      }
      state.lastUpdated = Date.now();
      state.error = null;
      state.loading = false;
    },
    setHelmReleasesLoading: (state, action: PayloadAction<boolean>) => {
      state.loading = action.payload;
    },
  },
});

export const { clearHelmReleases, setHelmReleasesError, updateHelmReleases, setHelmReleasesLoading } = helmReleasesSlice.actions;
export default helmReleasesSlice.reducer; 