import { ClusterRolesListHeader } from '@/types';
import { createSlice } from '@reduxjs/toolkit';
import { formatClusterRolesResponse } from '@/utils';
import { resetAllStates, resetListSlices } from '@/redux/hooks';

type InitialState = {
  loading: boolean;
  clusterRoles: ClusterRolesListHeader[];
};

const initialState: InitialState = {
  loading: true,
  clusterRoles: [] as ClusterRolesListHeader[],
};

const clusterRolesListSlice = createSlice({
  name: 'clusterRoles',
  initialState,
  reducers: {
    updateClusterRolesList: (state, action) => {
      state.clusterRoles = formatClusterRolesResponse(action.payload);
      state.loading = false;
    },
  },
  extraReducers: (builder) => {
    builder.addCase(resetAllStates, () => initialState);
    builder.addCase(resetListSlices, () => initialState);
  },
});
export default clusterRolesListSlice.reducer;
const { updateClusterRolesList } = clusterRolesListSlice.actions;
export { initialState, updateClusterRolesList };
