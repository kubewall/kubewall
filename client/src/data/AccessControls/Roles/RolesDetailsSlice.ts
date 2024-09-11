import { RawRequestError } from '@/data/kwFetch';
import { RoleDetails } from '@/types';
import { createSlice } from '@reduxjs/toolkit';
import { resetAllStates } from '@/redux/hooks';

type InitialState = {
  loading: boolean;
  roleDetails: RoleDetails;
  error: RawRequestError | null,
};

const initialState: InitialState = {
  loading: true,
  roleDetails: {} as RoleDetails,
  error: null,
};

const roleDetailsSlice = createSlice({
  name: 'roleDetails',
  initialState,
  reducers: {
    updateRoleDetails: (state, action) => {
      state.roleDetails = action.payload;
      state.loading = false;
    },
    resetRoleDetails: () => {
      return initialState;
    }
  },
  extraReducers: (builder) => {
    builder.addCase(resetAllStates, () => initialState);
  },
});

export default roleDetailsSlice.reducer;
const { resetRoleDetails, updateRoleDetails} = roleDetailsSlice.actions;
export { initialState, resetRoleDetails, updateRoleDetails };
