import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import kwFetch, { RawRequestError } from '../../kwFetch';

import { API_VERSION } from '@/constants';
import { resetAllStates } from '@/redux/hooks';
import { serializeError } from 'serialize-error';

type InitialState = {
  loading: boolean;
  message: string;
  error: RawRequestError | null
};

type DeploymentRestartParams = {
  name: string;
  queryParams: string;
  restartType: 'rolling' | 'recreate';
};

const initialState: InitialState = {
  loading: false,
  message: '',
  error: null
};

const deploymentRestart = createAsyncThunk('deploymentRestart', ({ name, queryParams, restartType }: DeploymentRestartParams, thunkAPI) => {
  const url = `${API_VERSION}/deployments/${name}/restart?${queryParams}`;

  return kwFetch(url, {
    method: 'POST',
    headers: {
      'content-type': 'application/json'
    },
    body: JSON.stringify({ restartType })
  }).then((res) => {
    return res;
  })
    .catch((e: Error) => thunkAPI.rejectWithValue(serializeError(e)));
});

const deploymentRestartSlice = createSlice({
  name: 'deploymentRestart',
  initialState,
  reducers: {
    resetDeploymentRestart: () => {
      return initialState;
    }
  },
  extraReducers: (builder) => {
    builder.addCase(deploymentRestart.pending, (state) => {
      state.loading = true;
    });
    builder.addCase(
      deploymentRestart.fulfilled,
      (state, action) => {
        state.loading = false;
        // Use the message from the API response
        const response = action.payload as any;
        state.message = response?.message || 'Deployment restart initiated';
        state.error = null;
      },
    );
    builder.addCase(deploymentRestart.rejected, (state, action) => {
      state.loading = false;
      state.error = action.payload as RawRequestError;
      state.message = '';
    });
    builder.addCase(resetAllStates, () => initialState);
  },
});
const { resetDeploymentRestart } = deploymentRestartSlice.actions;
export default deploymentRestartSlice.reducer;
export { initialState, deploymentRestart, resetDeploymentRestart };
