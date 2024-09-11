import { ServiceAccountsListHeader } from '@/types';
import { createSlice } from '@reduxjs/toolkit';
import { formatServiceAccountsResponse } from '@/utils';
import { resetAllStates } from '@/redux/hooks';

type InitialState = {
  loading: boolean;
  serviceAccounts: ServiceAccountsListHeader[];
};

const initialState: InitialState = {
  loading: true,
  serviceAccounts: [] as ServiceAccountsListHeader[],
};

const serviceAccountsListSlice = createSlice({
  name: 'serviceAccounts',
  initialState,
  reducers: {
    updateServiceAccountsList: (state, action) => {
      state.serviceAccounts = formatServiceAccountsResponse(action.payload);
      state.loading = false;
    },
  },
  extraReducers: (builder) => {
    builder.addCase(resetAllStates, () => initialState);
  },
});

export default serviceAccountsListSlice.reducer;
const { updateServiceAccountsList } = serviceAccountsListSlice.actions;
export { initialState, updateServiceAccountsList };
