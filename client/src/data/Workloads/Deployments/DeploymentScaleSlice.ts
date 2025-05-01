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

type DeploymentScalesParams = {
  name: string;
  replicaCount: number;
  queryParams: string;
};

const initialState: InitialState = {
  loading: false,
  message: '',
  error: null
};

const deploymentScale = createAsyncThunk('deploymentScale', ({ name, replicaCount, queryParams }: DeploymentScalesParams, thunkAPI) => {
  const url = `${API_VERSION}/deployments/${name}/scale?${queryParams}`;

  return kwFetch(url, {
    body: JSON.stringify({replicas: replicaCount}),
    method: 'POST',
    headers: {
      'content-type': 'application/json'
    }
  }).then((res) => {
    return res;
  })
    .catch((e: Error) => thunkAPI.rejectWithValue(serializeError(e)));
});

const deploymentScaleSlice = createSlice({
  name: 'deploymentScale',
  initialState,
  reducers: {
    resetDeploymentScale: () => {
      return initialState;
    }
  },
  extraReducers: (builder) => {
    builder.addCase(deploymentScale.pending, (state) => {
      state.loading = true;
    });
    builder.addCase(
      deploymentScale.fulfilled,
      (state) => {
        state.loading = false;
        state.message = 'Deployment Scaled';
        state.error = null;
      },
    );
    builder.addCase(deploymentScale.rejected, (state, action) => {
      state.loading = false;
      state.error = action.payload as RawRequestError;
      state.message = '';
    });
    builder.addCase(resetAllStates, () => initialState);
  },
});
const { resetDeploymentScale } = deploymentScaleSlice.actions;
export default deploymentScaleSlice.reducer;
export { initialState, deploymentScale, resetDeploymentScale };
