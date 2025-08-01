import { RawRequestError } from '../../kwFetch';
import { Pods } from '../../../types';
import { createSlice } from '@reduxjs/toolkit';
import { resetAllStates } from '@/redux/hooks';

type InitialState = {
  loading: boolean;
  replicaSetPodDetails: Pods[];
  error: RawRequestError | null,
};

const initialState: InitialState = {
  loading: true,
  replicaSetPodDetails: [],
  error: null,
};

const replicaSetPodsSlice = createSlice({
  name: 'replicaSetPods',
  initialState,
  reducers: {
    updateReplicaSetPods: (state, action) => {
      state.replicaSetPodDetails = action.payload || [];
      state.loading = false;
    },
    resetReplicaSetPods: () => {
      return initialState;
    }
  },
  extraReducers: (builder) => {
    builder.addCase(resetAllStates, () => initialState);
  },
});

export default replicaSetPodsSlice.reducer;
const { resetReplicaSetPods, updateReplicaSetPods} = replicaSetPodsSlice.actions;
export { initialState, resetReplicaSetPods, updateReplicaSetPods }; 