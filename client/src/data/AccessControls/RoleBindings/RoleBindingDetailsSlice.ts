import { RawRequestError } from '@/data/kwFetch';
import { RoleBindingDetails } from '@/types';
import { createSlice } from '@reduxjs/toolkit';
import { resetAllStates } from '@/redux/hooks';

type InitialState = {
  loading: boolean;
  roleBindingDetails: RoleBindingDetails;
  error: RawRequestError | null,
};

const initialState: InitialState = {
  loading: true,
  roleBindingDetails: {} as RoleBindingDetails,
  error: null,
};

const roleBindingDetailsSlice = createSlice({
  name: 'roleBindingDetails',
  initialState,
  reducers: {
    updateRoleBindingDetails: (state, action) => {
      state.roleBindingDetails = action.payload;
      state.loading = false;
    },
    resetRoleBindingDetails: () => {
      return initialState;
    }
  },
  extraReducers: (builder) => {
    builder.addCase(resetAllStates, () => initialState);
  },
});

export default roleBindingDetailsSlice.reducer;
const { resetRoleBindingDetails, updateRoleBindingDetails} = roleBindingDetailsSlice.actions;
export { initialState, resetRoleBindingDetails, updateRoleBindingDetails };
