import { Pods } from '../../../types';
import { RawRequestError } from '../../kwFetch';
import { createSlice } from '@reduxjs/toolkit';
import { resetAllStates } from '@/redux/hooks';

type InitialState = {
  loading: boolean;
  deploymentPodDetails: Pods[];
  error: RawRequestError | null,
};

const initialState: InitialState = {
  loading: true,
  deploymentPodDetails: {} as Pods[],
  error: null,
};

const deploymentPodDetailsSlice = createSlice({
  name: 'deploymentPodDetails',
  initialState,
  reducers: {
    updateDeploymentPods: (state, action) => {
      state.deploymentPodDetails = action.payload;
      state.loading = false;
    },
    resetDeploymentPods: () => {
      return initialState;
    }
  },
  extraReducers: (builder) => {
    builder.addCase(resetAllStates, () => initialState);
  },
});

const { updateDeploymentPods, resetDeploymentPods } = deploymentPodDetailsSlice.actions;
export default deploymentPodDetailsSlice.reducer;
export { initialState, updateDeploymentPods, resetDeploymentPods };
