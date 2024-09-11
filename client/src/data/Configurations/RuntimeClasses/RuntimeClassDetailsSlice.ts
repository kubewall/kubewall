import { RawRequestError } from '@/data/kwFetch';
import { RuntimeClassDetails } from '@/types';
import { createSlice } from '@reduxjs/toolkit';
import { resetAllStates } from '@/redux/hooks';

type InitialState = {
  loading: boolean;
  runtimeClassDetails: RuntimeClassDetails;
  error: RawRequestError | null,
};

const initialState: InitialState = {
  loading: true,
  runtimeClassDetails: {} as RuntimeClassDetails,
  error: null,
};

const runtimeClassDetailsSlice = createSlice({
  name: 'runtimeClassDetails',
  initialState,
  reducers: {
    updateRuntimeClassDetails: (state, action) => {
      state.runtimeClassDetails = action.payload;
      state.loading = false;
    },
    resetRuntimeClassDetails: () => {
      return initialState;
    }
  },
  extraReducers: (builder) => {
    builder.addCase(resetAllStates, () => initialState);
  },
});

export default runtimeClassDetailsSlice.reducer;
const { resetRuntimeClassDetails, updateRuntimeClassDetails} = runtimeClassDetailsSlice.actions;
export { initialState, resetRuntimeClassDetails, updateRuntimeClassDetails };
