import { Jobs } from '@/types';
import { RawRequestError } from '../../kwFetch';
import { createSlice } from '@reduxjs/toolkit';
import { formatJobsResponse } from '@/utils';
import { resetAllStates } from '@/redux/hooks';

type InitialState = {
  loading: boolean;
  cronJobJobDetails: Jobs[];
  error: RawRequestError | null,
};

const initialState: InitialState = {
  loading: true,
  cronJobJobDetails: [] as Jobs[],
  error: null,
};

const cronJobJobsSlice = createSlice({
  name: 'cronJobJobs',
  initialState,
  reducers: {
    updateCronJobJobs: (state, action) => {
      state.cronJobJobDetails = formatJobsResponse(action.payload);
      state.loading = false;
    },
    resetCronJobJobs: () => {
      return initialState;
    }
  },
  extraReducers: (builder) => {
    builder.addCase(resetAllStates, () => initialState);
  },
});

const { updateCronJobJobs, resetCronJobJobs } = cronJobJobsSlice.actions;
export default cronJobJobsSlice.reducer;
export { initialState, updateCronJobJobs, resetCronJobJobs };
