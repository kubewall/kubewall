import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { HelmReleaseDetails } from '@/types';

interface HelmReleaseDetailsState {
  details: HelmReleaseDetails | null;
  history: any[];
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
    updateHelmReleaseDetails: (state, action: PayloadAction<HelmReleaseDetails>) => {
      state.details = action.payload;
      state.loading = false;
      state.error = null;
      state.lastUpdated = Date.now();
    },
    setHelmReleaseDetailsLoading: (state, action: PayloadAction<boolean>) => {
      state.loading = action.payload;
    },
  },
});

export const { clearHelmReleaseDetails, setHelmReleaseDetailsError, updateHelmReleaseDetails, setHelmReleaseDetailsLoading } = helmReleaseDetailsSlice.actions;
export default helmReleaseDetailsSlice.reducer; 