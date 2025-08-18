import { Pods } from '../../../types';
import { RawRequestError } from '../../kwFetch';
import { createSlice } from '@reduxjs/toolkit';
import { resetAllStates } from '@/redux/hooks';

type InitialState = {
  loading: boolean;
  jobPodDetails: Pods[];
  error: RawRequestError | null;
};

const initialState: InitialState = {
  loading: true,
  jobPodDetails: [],
  error: null,
};

const jobPodsSlice = createSlice({
  name: 'jobPods',
  initialState,
  reducers: {
    updateJobPods: (state, action) => {
      state.jobPodDetails = action.payload;
      state.loading = false;
      state.error = null;
    },
    resetJobPods: () => {
      return initialState;
    }
  },
  extraReducers: (builder) => {
    builder.addCase(resetAllStates, () => initialState);
  },
});

const { updateJobPods, resetJobPods } = jobPodsSlice.actions;
export default jobPodsSlice.reducer;
export { initialState, updateJobPods, resetJobPods };
