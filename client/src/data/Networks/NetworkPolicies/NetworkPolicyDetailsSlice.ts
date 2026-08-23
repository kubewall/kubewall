import { NetworkPolicyDetails } from '@/types';
import { RawRequestError } from '@/data/kwFetch';
import { createSlice } from '@reduxjs/toolkit';
import { resetAllStates } from '@/redux/hooks';

type InitialState = {
  loading: boolean;
  networkPolicyDetails: NetworkPolicyDetails;
  error: RawRequestError | null,
};

const initialState: InitialState = {
  loading: true,
  networkPolicyDetails: {} as NetworkPolicyDetails,
  error: null,
};

const networkPolicyDetailsSlice = createSlice({
  name: 'networkPolicyDetails',
  initialState,
  reducers: {
    updateNetworkPolicyDetails: (state, action) => {
      state.networkPolicyDetails = action.payload;
      state.loading = false;
    },
    resetNetworkPolicyDetails: () => {
      return initialState;
    }
  },
  extraReducers: (builder) => {
    builder.addCase(resetAllStates, () => initialState);
  },
});

export default networkPolicyDetailsSlice.reducer;
const { resetNetworkPolicyDetails, updateNetworkPolicyDetails } = networkPolicyDetailsSlice.actions;
export { initialState, resetNetworkPolicyDetails, updateNetworkPolicyDetails };
