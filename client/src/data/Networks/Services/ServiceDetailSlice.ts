import { RawRequestError } from '@/data/kwFetch';
import { ServiceDetails } from '@/types';
import { createSlice } from '@reduxjs/toolkit';
import { resetAllStates } from '@/redux/hooks';

type InitialState = {
  loading: boolean;
  serviceDetails: ServiceDetails;
  error: RawRequestError | null,
};

const initialState: InitialState = {
  loading: true,
  serviceDetails: {} as ServiceDetails,
  error: null,
};

const serviceDetailsSlice = createSlice({
  name: 'serviceDetails',
  initialState,
  reducers: {
    updateServiceDetails: (state, action) => {
      state.serviceDetails = action.payload;
      state.loading = false;
    },
    resetServiceDetails: () => {
      return initialState;
    }
  },
  extraReducers: (builder) => {
    builder.addCase(resetAllStates, () => initialState);
  },
});

export default serviceDetailsSlice.reducer;
const { resetServiceDetails, updateServiceDetails} = serviceDetailsSlice.actions;
export { initialState, resetServiceDetails, updateServiceDetails };
