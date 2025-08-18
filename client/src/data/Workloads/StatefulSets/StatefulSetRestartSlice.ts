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

type StatefulSetRestartParams = {
  name: string;
  queryParams: string;
  restartType: 'rolling' | 'recreate';
};

const initialState: InitialState = {
  loading: false,
  message: '',
  error: null
};

const statefulSetRestart = createAsyncThunk('statefulSetRestart', ({ name, queryParams, restartType }: StatefulSetRestartParams, thunkAPI) => {
  const url = `${API_VERSION}/statefulsets/${name}/restart?${queryParams}`;

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

const statefulSetRestartSlice = createSlice({
  name: 'statefulSetRestart',
  initialState,
  reducers: {
    resetStatefulSetRestart: () => {
      return initialState;
    }
  },
  extraReducers: (builder) => {
    builder.addCase(statefulSetRestart.pending, (state) => {
      state.loading = true;
    });
    builder.addCase(
      statefulSetRestart.fulfilled,
      (state, action) => {
        state.loading = false;
        state.message = action.payload?.message || 'StatefulSet Restarted';
        state.error = null;
      },
    );
    builder.addCase(statefulSetRestart.rejected, (state, action) => {
      state.loading = false;
      state.error = action.payload as RawRequestError;
    });
    builder.addCase(resetAllStates, () => initialState);
  },
});

export default statefulSetRestartSlice.reducer;
const { resetStatefulSetRestart } = statefulSetRestartSlice.actions;
export { initialState, resetStatefulSetRestart, statefulSetRestart };