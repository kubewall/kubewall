import { CronJobDetails } from '../../../types';
import { RawRequestError } from '../../kwFetch';
import { createSlice } from '@reduxjs/toolkit';
import { resetAllStates } from '@/redux/hooks';

type InitialState = {
  loading: boolean;
  cronJobDetails : CronJobDetails;
  error: RawRequestError | null,
};

const initialState: InitialState = {
  loading: true,
  cronJobDetails : {} as CronJobDetails,
  error: null,
};

const cronJobDetailsSlice = createSlice({
  name: 'cronJobDetails',
  initialState,
  reducers: {
    updateCronJobDetails: (state, action) => {
      state.cronJobDetails = action.payload;
      state.loading = false;
    },
    resetCronJobDetails: () => {
      return initialState;
    }
  },
  extraReducers: (builder) => {
    builder.addCase(resetAllStates, () => initialState);
  },
});

export default cronJobDetailsSlice.reducer;
const { updateCronJobDetails, resetCronJobDetails } = cronJobDetailsSlice.actions;
export { initialState, updateCronJobDetails, resetCronJobDetails };
