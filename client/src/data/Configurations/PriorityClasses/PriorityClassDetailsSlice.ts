import { PriorityClassDetails } from '@/types';
import { RawRequestError } from '@/data/kwFetch';
import { createSlice } from '@reduxjs/toolkit';
import { resetAllStates } from '@/redux/hooks';

type InitialState = {
  loading: boolean;
  priorityClassDetails: PriorityClassDetails;
  error: RawRequestError | null,
};

const initialState: InitialState = {
  loading: true,
  priorityClassDetails: {} as PriorityClassDetails,
  error: null,
};

const priorityClassDetailsSlice = createSlice({
  name: 'priorityClassDetails',
  initialState,
  reducers: {
    updatePriorityClassDetails: (state, action) => {
      state.priorityClassDetails = action.payload;
      state.loading = false;
    },
    resetPriorityClassDetails: () => {
      return initialState;
    }
  },
  extraReducers: (builder) => {
    builder.addCase(resetAllStates, () => initialState);
  },
});

export default priorityClassDetailsSlice.reducer;
const { resetPriorityClassDetails, updatePriorityClassDetails} = priorityClassDetailsSlice.actions;
export { initialState, resetPriorityClassDetails, updatePriorityClassDetails };
