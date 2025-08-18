import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import kwFetch, { RawRequestError } from '../../kwFetch';

import { API_VERSION } from '@/constants';
import { resetAllStates } from '@/redux/hooks';
import { serializeError } from 'serialize-error';

type InitialState = {
  loading: boolean;
  message: string;
  error: RawRequestError | null;
  jobName: string | null;
};

type CronJobTriggerParams = {
  name: string;
  namespace: string;
  queryParams: string;
};

const initialState: InitialState = {
  loading: false,
  message: '',
  error: null,
  jobName: null
};

const cronJobTrigger = createAsyncThunk('cronJobTrigger', ({ name, namespace, queryParams }: CronJobTriggerParams, thunkAPI) => {
  const url = `${API_VERSION}/cronjobs/${namespace}/${name}/trigger?${queryParams}`;

  return kwFetch(url, {
    method: 'POST',
    headers: {
      'content-type': 'application/json'
    }
  }).then((res) => {
    return res;
  })
    .catch((e: Error) => thunkAPI.rejectWithValue(serializeError(e)));
});

const cronJobTriggerSlice = createSlice({
  name: 'cronJobTrigger',
  initialState,
  reducers: {
    resetCronJobTrigger: () => {
      return initialState;
    }
  },
  extraReducers: (builder) => {
    builder.addCase(cronJobTrigger.pending, (state) => {
      state.loading = true;
      state.error = null;
      state.message = '';
      state.jobName = null;
    });
    builder.addCase(
      cronJobTrigger.fulfilled,
      (state, action) => {
        state.loading = false;
        state.message = action.payload.message || 'CronJob triggered successfully';
        state.jobName = action.payload.job?.name || null;
        state.error = null;
      },
    );
    builder.addCase(cronJobTrigger.rejected, (state, action) => {
      state.loading = false;
      state.error = action.payload as RawRequestError;
      state.message = '';
      state.jobName = null;
    });
    builder.addCase(resetAllStates, () => initialState);
  },
});

const { resetCronJobTrigger } = cronJobTriggerSlice.actions;
export default cronJobTriggerSlice.reducer;
export { initialState, cronJobTrigger, resetCronJobTrigger };
