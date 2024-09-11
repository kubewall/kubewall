import { ClusterRoleDetails } from '@/types';
import { RawRequestError } from '@/data/kwFetch';
import { createSlice } from '@reduxjs/toolkit';
import { resetAllStates } from '@/redux/hooks';

type InitialState = {
  loading: boolean;
  clusterRoleDetails: ClusterRoleDetails;
  error: RawRequestError | null,
};

const initialState: InitialState = {
  loading: true,
  clusterRoleDetails: {} as ClusterRoleDetails,
  error: null,
};

const clusterRoleDetailsSlice = createSlice({
  name: 'clusterRoleDetails',
  initialState,
  reducers: {
    updateClusterRoleDetails: (state, action) => {
      state.clusterRoleDetails = action.payload;
      state.loading = false;
    },
    resetClusterRoleDetails: () => {
      return initialState;
    }
  },
  extraReducers: (builder) => {
    builder.addCase(resetAllStates, () => initialState);
  },
});

export default clusterRoleDetailsSlice.reducer;
const { resetClusterRoleDetails, updateClusterRoleDetails} = clusterRoleDetailsSlice.actions;
export { initialState, resetClusterRoleDetails, updateClusterRoleDetails };
