import { RolesListHeader } from '@/types';
import { createSlice } from '@reduxjs/toolkit';
import { formatRolesResponse } from '@/utils';
import { resetAllStates } from '@/redux/hooks';

type InitialState = {
  loading: boolean;
  roles: RolesListHeader[];
};

const initialState: InitialState = {
  loading: true,
  roles: [] as RolesListHeader[],
};

const rolesListSlice = createSlice({
  name: 'roles',
  initialState,
  reducers: {
    updateRolesList: (state, action) => {
      state.roles = formatRolesResponse(action.payload);
      state.loading = false;
    },
  },
  extraReducers: (builder) => {
    builder.addCase(resetAllStates, () => initialState);
  },
});

export default rolesListSlice.reducer;
const { updateRolesList } = rolesListSlice.actions;
export { initialState, updateRolesList };
