import { IngressDetails } from '@/types';
import { RawRequestError } from '@/data/kwFetch';
import { createSlice } from '@reduxjs/toolkit';
import { resetAllStates } from '@/redux/hooks';

type InitialState = {
  loading: boolean;
  ingressDetails: IngressDetails;
  error: RawRequestError | null,
};

const initialState: InitialState = {
  loading: true,
  ingressDetails: {} as IngressDetails,
  error: null,
};

const ingressDetailsSlice = createSlice({
  name: 'ingressDetails',
  initialState,
  reducers: {
    updateIngressDetails: (state, action) => {
      state.ingressDetails = action.payload;
      state.loading = false;
    },
    resetIngressDetails: () => {
      return initialState;
    }
  },
  extraReducers: (builder) => {
    builder.addCase(resetAllStates, () => initialState);
  },
});

export default ingressDetailsSlice.reducer;
const { resetIngressDetails, updateIngressDetails} = ingressDetailsSlice.actions;
export { initialState, resetIngressDetails, updateIngressDetails };
