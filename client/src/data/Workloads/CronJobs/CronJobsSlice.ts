import { CronJobs } from '../../../types';
import { RawRequestError } from '../../kwFetch';
import { createSlice } from '@reduxjs/toolkit';
import { formatCronJobsResponse } from '@/utils';
import { resetAllStates } from '@/redux/hooks';

type InitialState = {
  loading: boolean;
  cronJobs: CronJobs[];
  error:  RawRequestError | null;
};

const initialState: InitialState = {
  loading: true,
  cronJobs: [] as CronJobs[],
  error: null,
};

const cronJobsSlice = createSlice({
  name: 'cronJobs',
  initialState,
  reducers: {
    updateCronJobs: (state, action) => {
      state.cronJobs = formatCronJobsResponse(action.payload);
      state.loading = false;
    }
  },
  extraReducers: (builder) => {
    builder.addCase(resetAllStates, () => initialState);
  },
});

export default cronJobsSlice.reducer;
const { updateCronJobs } = cronJobsSlice.actions;
export { initialState, updateCronJobs };
