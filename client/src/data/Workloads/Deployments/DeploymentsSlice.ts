import { Deployments } from '../../../types';
import { RawRequestError } from '../../kwFetch';
import { createSlice } from '@reduxjs/toolkit';
import { formatDeploymentsResponse } from '@/utils';
import { resetAllStates } from '@/redux/hooks';

type InitialState = {
  loading: boolean;
  deployments: Deployments[];
  error:  RawRequestError | null;
};

const initialState: InitialState = {
  loading: true,
  deployments: [] as Deployments[],
  error: null,
};

const deploymentSlice = createSlice({
  name: 'deployments',
  initialState,
  reducers: {
    updateDeployments: (state, action) => {
      state.deployments = formatDeploymentsResponse(action.payload);
      state.loading = false;
    }
  },
  extraReducers: (builder) => {
    builder.addCase(resetAllStates, () => initialState);
  },
});

export default deploymentSlice.reducer;
const { updateDeployments }  = deploymentSlice.actions;
export { initialState, updateDeployments };
