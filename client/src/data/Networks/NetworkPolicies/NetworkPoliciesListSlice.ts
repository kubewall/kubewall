import { NetworkPoliciesHeaders } from '@/types';
import { createSlice } from '@reduxjs/toolkit';
import { resetAllStates, resetListSlices } from '@/redux/hooks';

type InitialState = {
  loading: boolean;
  networkPolicies: NetworkPoliciesHeaders[];
};

const initialState: InitialState = {
  loading: true,
  networkPolicies: [] as NetworkPoliciesHeaders[],
};

const networkPoliciesListSlice = createSlice({
  name: 'networkPolicies',
  initialState,
  reducers: {
    updateNetworkPoliciesList: (state, action) => {
      state.networkPolicies = action.payload;
      state.loading = false;
    },
  },
  extraReducers: (builder) => {
    builder.addCase(resetAllStates, () => initialState);
    builder.addCase(resetListSlices, () => initialState);
  },
});
export default networkPoliciesListSlice.reducer;
const { updateNetworkPoliciesList } = networkPoliciesListSlice.actions;
export { initialState, updateNetworkPoliciesList };
