import { RoleBindingsListHeader } from '@/types';
import { createSlice } from '@reduxjs/toolkit';
import { formatRoleBindingsResponse } from '@/utils';
import { resetAllStates } from '@/redux/hooks';

type InitialState = {
  loading: boolean;
  roleBindings: RoleBindingsListHeader[];
};

const initialState: InitialState = {
  loading: true,
  roleBindings: [] as RoleBindingsListHeader[],
};

const roleBindingsListSlice = createSlice({
  name: 'roleBindings',
  initialState,
  reducers: {
    updateRoleBindingList: (state, action) => {
      state.roleBindings = formatRoleBindingsResponse(action.payload);
      state.loading = false;
    },
  },
  extraReducers: (builder) => {
    builder.addCase(resetAllStates, () => initialState);
  },
});

export default roleBindingsListSlice.reducer;
const { updateRoleBindingList } = roleBindingsListSlice.actions;
export { initialState, updateRoleBindingList };
