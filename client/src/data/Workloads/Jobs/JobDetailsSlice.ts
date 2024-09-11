import { JobDetails } from '@/types/Workloads/jobs';
import { RawRequestError } from '../../kwFetch';
import { createSlice } from '@reduxjs/toolkit';
import { resetAllStates } from '@/redux/hooks';

type InitialState = {
  loading: boolean;
  jobDetails: JobDetails;
  error: RawRequestError | null,
};

const initialState: InitialState = {
  loading: true,
  jobDetails: {} as JobDetails,
  error: null,
};

const jobDetailsSlice = createSlice({
  name: 'jobDetails',
  initialState,
  reducers: {
    updateJobDetails: (state, action) => {
      state.jobDetails = action.payload;
      state.loading = false;
    },
    resetJobDetails: () => {
      return initialState;
    }
  },
  extraReducers: (builder) => {
    builder.addCase(resetAllStates, () => initialState);
  },
});

export default jobDetailsSlice.reducer;
const { resetJobDetails, updateJobDetails} = jobDetailsSlice.actions;
export { initialState, resetJobDetails, updateJobDetails };
