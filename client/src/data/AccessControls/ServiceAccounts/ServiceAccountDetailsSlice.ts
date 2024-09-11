import { RawRequestError } from '@/data/kwFetch';
import { ServiceAccountDetails } from '@/types';
import { createSlice } from '@reduxjs/toolkit';
import { resetAllStates } from '@/redux/hooks';

type InitialState = {
  loading: boolean;
  serviceAccountDetails: ServiceAccountDetails;
  error: RawRequestError | null,
};

const initialState: InitialState = {
  loading: true,
  serviceAccountDetails: {} as ServiceAccountDetails,
  error: null,
};

const serviceAccountDetailsSlice = createSlice({
  name: 'serviceAccountDetails',
  initialState,
  reducers: {
    updateServiceAccountDetails: (state, action) => {
      state.serviceAccountDetails = action.payload;
      state.loading = false;
    },
    resetServiceAccountDetails: () => {
      return initialState;
    }
  },
  extraReducers: (builder) => {
    builder.addCase(resetAllStates, () => initialState);
  },
});

export default serviceAccountDetailsSlice.reducer;
const { resetServiceAccountDetails, updateServiceAccountDetails} = serviceAccountDetailsSlice.actions;
export { initialState, resetServiceAccountDetails, updateServiceAccountDetails };
