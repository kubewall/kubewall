import { ClusterRoleBindingsListHeader } from '@/types';
import { createSlice } from '@reduxjs/toolkit';
import { formatClusterRoleBindingsResponse } from '@/utils';
import { resetAllStates } from '@/redux/hooks';

type InitialState = {
  loading: boolean;
  clusterRoleBindings: ClusterRoleBindingsListHeader[];
};

const initialState: InitialState = {
  loading: true,
  clusterRoleBindings: [] as ClusterRoleBindingsListHeader[],
};

const clusterRoleBindingsListSlice = createSlice({
  name: 'clusterRoleBindings',
  initialState,
  reducers: {
    updateClusterRoleBindingList: (state, action) => {
      state.clusterRoleBindings = formatClusterRoleBindingsResponse(action.payload);
      state.loading = false;
    },
  },
  extraReducers: (builder) => {
    builder.addCase(resetAllStates, () => initialState);
  },
});

export default clusterRoleBindingsListSlice.reducer;
const { updateClusterRoleBindingList } = clusterRoleBindingsListSlice.actions;
export { initialState, updateClusterRoleBindingList };
