import { RawRequestError } from '@/data/kwFetch';
import { CSINodeDetails } from '@/types';
import { createSlice } from '@reduxjs/toolkit';
import { resetAllStates } from '@/redux/hooks';

type InitialState = {
  loading: boolean;
  csiNodeDetails: CSINodeDetails;
  error: RawRequestError | null,
};

const initialState: InitialState = {
  loading: true,
  csiNodeDetails: {} as CSINodeDetails,
  error: null,
};

const csiNodeDetailsSlice = createSlice({
  name: 'csiNodeDetails',
  initialState,
  reducers: {
    updateCSINodeDetails: (state, action) => {
      state.csiNodeDetails = action.payload;
      state.loading = false;
    },
    resetCSINodeDetails: () => {
      return initialState;
    }
  },
  extraReducers: (builder) => {
    builder.addCase(resetAllStates, () => initialState);
  },
});

export default csiNodeDetailsSlice.reducer;
const { resetCSINodeDetails, updateCSINodeDetails } = csiNodeDetailsSlice.actions;
export { initialState, resetCSINodeDetails, updateCSINodeDetails };
