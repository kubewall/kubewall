import { Pods } from '../../../types';
import { RawRequestError } from '../../kwFetch';
import { createSlice } from '@reduxjs/toolkit';
import { resetAllStates } from '@/redux/hooks';

type InitialState = {
  loading: boolean;
  nodePodDetails: Pods[];
  error: RawRequestError | null,
};

const initialState: InitialState = {
  loading: true,
  nodePodDetails: {} as Pods[],
  error: null,
};

const nodePodDetailsSlice = createSlice({
  name: 'nodePodDetails',
  initialState,
  reducers: {
    updateNodePods: (state, action) => {
      state.nodePodDetails = action.payload;
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

const { updateNodePods, resetNodePods } = nodePodDetailsSlice.actions;
export default nodePodDetailsSlice.reducer;
export { initialState, updateNodePods, resetNodePods };
