import { DeploymentDetails } from '../../../types';
import { RawRequestError } from '../../kwFetch';
import { createSlice } from '@reduxjs/toolkit';
import { resetAllStates } from '@/redux/hooks';

type InitialState = {
  loading: boolean;
  deploymentDetails: DeploymentDetails;
  error: RawRequestError | null,
};

const initialState: InitialState = {
  loading: true,
  deploymentDetails: {} as DeploymentDetails,
  error: null,
};

const deploymentDetailsSlice = createSlice({
  name: 'deploymentDetails',
  initialState,
  reducers: {
    updateDeploymentsDetails: (state, action) => {
      state.deploymentDetails = action.payload;
      state.loading = false;
    },
    resetDeploymentsDetails: () => {
      return initialState;
    }
  },
  extraReducers: (builder) => {
    builder.addCase(resetAllStates, () => initialState);
  },
});

export default deploymentDetailsSlice.reducer;
const { resetDeploymentsDetails, updateDeploymentsDetails } = deploymentDetailsSlice.actions;
export { initialState, resetDeploymentsDetails, updateDeploymentsDetails };
