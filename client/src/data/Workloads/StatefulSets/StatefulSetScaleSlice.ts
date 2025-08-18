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

type StatefulSetScalesParams = {
  name: string;
  replicaCount: number;
  queryParams: string;
};

const initialState: InitialState = {
  loading: false,
  message: '',
  error: null
};

const statefulSetScale = createAsyncThunk('statefulSetScale', ({ name, replicaCount, queryParams }: StatefulSetScalesParams, thunkAPI) => {
  const url = `${API_VERSION}/statefulsets/${name}/scale?${queryParams}`;

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

const statefulSetScaleSlice = createSlice({
  name: 'statefulSetScale',
  initialState,
  reducers: {
    resetStatefulSetScale: () => {
      return initialState;
    }
  },
  extraReducers: (builder) => {
    builder.addCase(statefulSetScale.pending, (state) => {
      state.loading = true;
    });
    builder.addCase(
      statefulSetScale.fulfilled,
      (state) => {
        state.loading = false;
        state.message = 'StatefulSet Scaled';
        state.error = null;
      },
    );
    builder.addCase(statefulSetScale.rejected, (state, action) => {
      state.loading = false;
      state.error = action.payload as RawRequestError;
    });
    builder.addCase(resetAllStates, () => initialState);
  },
});

export default statefulSetScaleSlice.reducer;
const { resetStatefulSetScale } = statefulSetScaleSlice.actions;
export { initialState, resetStatefulSetScale, statefulSetScale };