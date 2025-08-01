import { createSlice } from '@reduxjs/toolkit';
import { Pods } from '@/types';
import { resetAllStates } from '@/redux/hooks';

interface InitialState {
  loading: boolean;
  nodePodDetails: Pods[];
  error: string | null;
}

const initialState: InitialState = {
  loading: true,
  nodePodDetails: [] as Pods[],
  error: null,
};

const nodePodsSlice = createSlice({
  name: 'nodePods',
  initialState,
  reducers: {
    updateNodePods: (state, action) => {
      state.nodePodDetails = action.payload || [];
      state.loading = false;
    },
    resetNodePods: () => {
      return initialState;
    }
  },
  extraReducers: (builder) => {
    builder.addCase(resetAllStates, () => initialState);
  },
});

export const { updateNodePods, resetNodePods } = nodePodsSlice.actions;
export default nodePodsSlice.reducer; 