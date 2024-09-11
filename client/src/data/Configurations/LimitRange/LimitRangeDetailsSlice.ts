import { LimitRangeDetails } from '@/types';
import { RawRequestError } from '@/data/kwFetch';
import { createSlice } from '@reduxjs/toolkit';
import { resetAllStates } from '@/redux/hooks';

type InitialState = {
  loading: boolean;
  limitRangeDetails: LimitRangeDetails;
  error: RawRequestError | null,
};

const initialState: InitialState = {
  loading: true,
  limitRangeDetails: {} as LimitRangeDetails,
  error: null,
};

const limitRangeDetailsSlice = createSlice({
  name: 'limitRangeDetails',
  initialState,
  reducers: {
    updateLimitRangeDetails: (state, action) => {
      state.limitRangeDetails = action.payload;
      state.loading = false;
    },
    resetLimitRangeDetails: () => {
      return initialState;
    }
  },
  extraReducers: (builder) => {
    builder.addCase(resetAllStates, () => initialState);
  },
});

export default limitRangeDetailsSlice.reducer;
const { resetLimitRangeDetails, updateLimitRangeDetails} = limitRangeDetailsSlice.actions;
export { initialState, resetLimitRangeDetails, updateLimitRangeDetails };
