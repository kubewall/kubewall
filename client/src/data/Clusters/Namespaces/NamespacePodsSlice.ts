import { createSlice } from '@reduxjs/toolkit';
import { Pods } from '@/types';
import { resetAllStates } from '@/redux/hooks';

interface InitialState {
  loading: boolean;
  namespacePodDetails: Pods[];
  error: string | null;
}

const initialState: InitialState = {
  loading: true,
  namespacePodDetails: [] as Pods[],
  error: null,
};

const namespacePodsSlice = createSlice({
  name: 'namespacePods',
  initialState,
  reducers: {
    updateNamespacePods: (state, action) => {
      state.namespacePodDetails = action.payload || [];
      state.loading = false;
    },
    resetNamespacePods: () => {
      return initialState;
    }
  },
  extraReducers: (builder) => {
    builder.addCase(resetAllStates, () => initialState);
  },
});

export const { updateNamespacePods, resetNamespacePods } = namespacePodsSlice.actions;
export default namespacePodsSlice.reducer; 