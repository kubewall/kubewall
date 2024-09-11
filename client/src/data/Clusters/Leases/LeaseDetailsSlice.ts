import { LeaseDetails } from '@/types';
import { RawRequestError } from '@/data/kwFetch';
import { createSlice } from '@reduxjs/toolkit';
import { resetAllStates } from '@/redux/hooks';

type InitialState = {
  loading: boolean;
  leaseDetails: LeaseDetails;
  error: RawRequestError | null,
};

const initialState: InitialState = {
  loading: true,
  leaseDetails: {} as LeaseDetails,
  error: null,
};

const leaseDetailsSlice = createSlice({
  name: 'leaseDetails',
  initialState,
  reducers: {
    updateLeaseDetails: (state, action) => {
      state.leaseDetails = action.payload;
      state.loading = false;
    },
    resetLeaseDetails: () => {
      return initialState;
    }
  },
  extraReducers: (builder) => {
    builder.addCase(resetAllStates, () => initialState);
  },
});

export default leaseDetailsSlice.reducer;
const { resetLeaseDetails, updateLeaseDetails} = leaseDetailsSlice.actions;
export { initialState, resetLeaseDetails, updateLeaseDetails };
