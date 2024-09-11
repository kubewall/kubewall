import { EndpointDetails } from '@/types';
import { RawRequestError } from '@/data/kwFetch';
import { createSlice } from '@reduxjs/toolkit';
import { resetAllStates } from '@/redux/hooks';

type InitialState = {
  loading: boolean;
  endpointDetails: EndpointDetails;
  error: RawRequestError | null,
};

const initialState: InitialState = {
  loading: true,
  endpointDetails: {} as EndpointDetails,
  error: null,
};

const endpointDetailsSlice = createSlice({
  name: 'endpointDetails',
  initialState,
  reducers: {
    updateEndpointDetails: (state, action) => {
      state.endpointDetails = action.payload;
      state.loading = false;
    },
    resetEndpointDetails: () => {
      return initialState;
    }
  },
  extraReducers: (builder) => {
    builder.addCase(resetAllStates, () => initialState);
  },
});

export default endpointDetailsSlice.reducer;
const { resetEndpointDetails, updateEndpointDetails} = endpointDetailsSlice.actions;
export { initialState, resetEndpointDetails, updateEndpointDetails };
