import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import kwFetch, { RawRequestError } from '../../kwFetch';

import { API_VERSION } from '@/constants';
import { resetAllStates } from '@/redux/hooks';
import { serializeError } from 'serialize-error';

type InitialState = {
  stoppingId: string;
  message: string;
  error: RawRequestError | null;
};

type StopPortForwardingParams = {
  id: string;
  queryParams: string;
};

const initialState: InitialState = {
  stoppingId: '',
  message: '',
  error: null
};

const stopPortForwarding = createAsyncThunk('stopPortForwarding', ({ id, queryParams }: StopPortForwardingParams, thunkAPI) => {
  const url = `${API_VERSION}/portforwards?${queryParams}`;

  return kwFetch(url, {
    body: JSON.stringify([{ id }]),
    method: 'DELETE',
    headers: {
      'content-type': 'application/json'
    }
  }).catch((e: Error) => thunkAPI.rejectWithValue(serializeError(e)));
});

const stopPortForwardingSlice = createSlice({
  name: 'stopPortForwarding',
  initialState,
  reducers: {
    resetStopPortForwarding: (state) => {
      state.message = '';
      state.error = null;
    }
  },
  extraReducers: (builder) => {
    builder.addCase(stopPortForwarding.pending, (state, action) => {
      state.stoppingId = action.meta.arg.id;
    });
    builder.addCase(stopPortForwarding.fulfilled, (state, action) => {
      const [failure] = action.payload?.failures || [];
      state.stoppingId = '';
      state.message = failure ? '' : 'Port Forwarding Stopped';
      state.error = failure ? { message: failure.message } : null;
    });
    builder.addCase(stopPortForwarding.rejected, (state, action) => {
      state.stoppingId = '';
      state.message = '';
      state.error = action.payload as RawRequestError;
    });
    builder.addCase(resetAllStates, () => initialState);
  },
});
const { resetStopPortForwarding } = stopPortForwardingSlice.actions;
export default stopPortForwardingSlice.reducer;
export { initialState, stopPortForwarding, resetStopPortForwarding };
