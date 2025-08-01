import { createSlice } from '@reduxjs/toolkit';
import { Pods } from '@/types';
import { resetAllStates } from '@/redux/hooks';

interface InitialState {
  loading: boolean;
  daemonSetPodDetails: Pods[];
  error: string | null;
}

const initialState: InitialState = {
  loading: true,
  daemonSetPodDetails: [] as Pods[],
  error: null,
};

const daemonSetPodsSlice = createSlice({
  name: 'daemonSetPods',
  initialState,
  reducers: {
    updateDaemonSetPods: (state, action) => {
      state.daemonSetPodDetails = action.payload || [];
      state.loading = false;
    },
    resetDaemonSetPods: () => {
      return initialState;
    }
  },
  extraReducers: (builder) => {
    builder.addCase(resetAllStates, () => initialState);
  },
});

export const { updateDaemonSetPods, resetDaemonSetPods } = daemonSetPodsSlice.actions;
export default daemonSetPodsSlice.reducer; 