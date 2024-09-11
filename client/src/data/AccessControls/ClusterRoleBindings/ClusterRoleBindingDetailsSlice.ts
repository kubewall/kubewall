import { ClusterRoleBindingDetails } from '@/types';
import { RawRequestError } from '@/data/kwFetch';
import { createSlice } from '@reduxjs/toolkit';
import { resetAllStates } from '@/redux/hooks';

type InitialState = {
  loading: boolean;
  clusterRoleBindingDetails: ClusterRoleBindingDetails;
  error: RawRequestError | null,
};

const initialState: InitialState = {
  loading: true,
  clusterRoleBindingDetails: {} as ClusterRoleBindingDetails,
  error: null,
};

const clusterRoleBindingDetailsSlice = createSlice({
  name: 'clusterRoleBindingDetails',
  initialState,
  reducers: {
    updateClusterRoleBindingDetails: (state, action) => {
      state.clusterRoleBindingDetails = action.payload;
      state.loading = false;
    },
    resetClusterRoleBindingDetails: () => {
      return initialState;
    }
  },
  extraReducers: (builder) => {
    builder.addCase(resetAllStates, () => initialState);
  },
});

export default clusterRoleBindingDetailsSlice.reducer;
const { resetClusterRoleBindingDetails, updateClusterRoleBindingDetails} = clusterRoleBindingDetailsSlice.actions;
export { initialState, resetClusterRoleBindingDetails, updateClusterRoleBindingDetails };
