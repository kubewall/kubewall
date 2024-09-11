import { Jobs } from '../../../types';
import { RawRequestError } from '../../kwFetch';
import { createSlice } from '@reduxjs/toolkit';
import { formatJobsResponse } from '@/utils';
import { resetAllStates } from '@/redux/hooks';

type InitialState = {
  loading: boolean;
  jobs: Jobs[];
  error:  RawRequestError | null;
};

const initialState: InitialState = {
  loading: true,
  jobs: [] as Jobs[],
  error: null,
};

const jobsSlice = createSlice({
  name: 'jobs',
  initialState,
  reducers: {
    updateJobs: (state, action) => {
      state.jobs = formatJobsResponse(action.payload);
      state.loading = false;
    }
  },
  extraReducers: (builder) => {
    builder.addCase(resetAllStates, () => initialState);
  },
});

export default jobsSlice.reducer;
const { updateJobs } = jobsSlice.actions;
export { initialState, updateJobs };
