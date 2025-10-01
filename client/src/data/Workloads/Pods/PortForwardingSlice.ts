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

type PortForwardingParams = {
  namespace: string;
  kind: "service" | "pod";
  name: string;
  localPort: number;
  containerPort: number;
  queryParams: string;
};

const initialState: InitialState = {
  loading: false,
  message: '',
  error: null
};

const portForwarding = createAsyncThunk('portForwarding', ({containerPort, kind, localPort, name, namespace, queryParams}: PortForwardingParams, thunkAPI) => {
  const url = `${API_VERSION}/portforwards?${queryParams}`;

  return kwFetch(url, {
    body: JSON.stringify({localPort, namespace, name, containerPort, kind}),
    method: 'POST',
    headers: {
      'content-type': 'application/json'
    }
  }).then((res) => {
    return res;
  })
    .catch((e: Error) => thunkAPI.rejectWithValue(serializeError(e)));
});

const portForwardingSlice = createSlice({
  name: 'portForwarding',
  initialState,
  reducers: {
    resetPortForwarding: () => {
      return initialState;
    }
  },
  extraReducers: (builder) => {
    builder.addCase(portForwarding.pending, (state) => {
      state.loading = true;
    });
    builder.addCase(
      portForwarding.fulfilled,
      (state) => {
        state.loading = false;
        state.message = 'Port Forwarding Established';
        state.error = null;
      },
    );
    builder.addCase(portForwarding.rejected, (state, action) => {
      state.loading = false;
      state.error = action.payload as RawRequestError;
      state.message = '';
    });
    builder.addCase(resetAllStates, () => initialState);
  },
});
const { resetPortForwarding } = portForwardingSlice.actions;
export default portForwardingSlice.reducer;
export { initialState, portForwarding, resetPortForwarding };
