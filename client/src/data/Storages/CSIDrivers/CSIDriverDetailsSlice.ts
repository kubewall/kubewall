import { RawRequestError } from '@/data/kwFetch';
import { CSIDriverDetails } from '@/types';
import { createSlice } from '@reduxjs/toolkit';
import { resetAllStates } from '@/redux/hooks';

type InitialState = {
  loading: boolean;
  csiDriverDetails: CSIDriverDetails;
  error: RawRequestError | null,
};

const initialState: InitialState = {
  loading: true,
  csiDriverDetails: {} as CSIDriverDetails,
  error: null,
};

const csiDriverDetailsSlice = createSlice({
  name: 'csiDriverDetails',
  initialState,
  reducers: {
    updateCSIDriverDetails: (state, action) => {
      state.csiDriverDetails = action.payload;
      state.loading = false;
    },
    resetCSIDriverDetails: () => {
      return initialState;
    }
  },
  extraReducers: (builder) => {
    builder.addCase(resetAllStates, () => initialState);
  },
});

export default csiDriverDetailsSlice.reducer;
const { resetCSIDriverDetails, updateCSIDriverDetails } = csiDriverDetailsSlice.actions;
export { initialState, resetCSIDriverDetails, updateCSIDriverDetails };
