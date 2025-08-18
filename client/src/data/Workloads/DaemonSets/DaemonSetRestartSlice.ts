import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import kwFetch, { RawRequestError } from '../../kwFetch';
import { API_VERSION } from '@/constants';
import { resetAllStates } from '@/redux/hooks';
import { serializeError } from 'serialize-error';

type InitialState = {
  loading: boolean;
  error: RawRequestError | null;
  message: string;
};

const initialState: InitialState = {
  loading: false,
  error: null,
  message: '',
};

type DaemonSetRestartParams = {
  name: string;
  queryParams: string;
  restartType: 'rolling';
};

const daemonSetRestart = createAsyncThunk('daemonSetRestart', ({ name, queryParams, restartType }: DaemonSetRestartParams, thunkAPI) => {
  const url = `${API_VERSION}/daemonsets/${name}/restart?${queryParams}`;

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

const daemonSetRestartSlice = createSlice({
  name: 'daemonSetRestart',
  initialState,
  reducers: {
    resetDaemonSetRestart: () => {
      return initialState;
    }
  },
  extraReducers: (builder) => {
    builder.addCase(daemonSetRestart.pending, (state) => {
      state.loading = true;
      state.error = null;
      state.message = '';
    });
    builder.addCase(
      daemonSetRestart.fulfilled,
      (state, action) => {
        state.loading = false;
        // Use the message from the API response
        const response = action.payload as any;
        state.message = response?.message || 'DaemonSet restart initiated';
        state.error = null;
      },
    );
    builder.addCase(daemonSetRestart.rejected, (state, action) => {
      state.loading = false;
      state.error = action.payload as RawRequestError;
      state.message = '';
    });
    builder.addCase(resetAllStates, () => initialState);
  },
});

const { resetDaemonSetRestart } = daemonSetRestartSlice.actions;
export default daemonSetRestartSlice.reducer;
export { initialState, daemonSetRestart, resetDaemonSetRestart };