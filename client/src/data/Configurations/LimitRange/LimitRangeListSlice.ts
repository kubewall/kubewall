import { LimitRangesListHeader } from '@/types';
import { createSlice } from '@reduxjs/toolkit';
import { formatLimitRangesResponse } from '@/utils';
import { resetAllStates } from '@/redux/hooks';

type InitialState = {
  loading: boolean;
  limitRanges: LimitRangesListHeader[];
};

const initialState: InitialState = {
  loading: true,
  limitRanges: [] as LimitRangesListHeader[],
};

const limitRangesListSlice = createSlice({
  name: 'limitRange',
  initialState,
  reducers: {
    updateLimitRangesList: (state, action) => {
      state.limitRanges = formatLimitRangesResponse(action.payload);
      state.loading = false;
    }
  },
  extraReducers: (builder) => {
    builder.addCase(resetAllStates, () => initialState);
  },
});

export default limitRangesListSlice.reducer;
const { updateLimitRangesList } = limitRangesListSlice.actions;
export { initialState, updateLimitRangesList };
