import { SecretsListHeader } from '@/types';
import { createSlice } from '@reduxjs/toolkit';
import { formatSecretsResponse } from '@/utils';
import { resetAllStates } from '@/redux/hooks';

type InitialState = {
  loading: boolean;
  secrets: SecretsListHeader[];
};

const initialState: InitialState = {
  loading: true,
  secrets: [] as SecretsListHeader[],
};

const secretsListSlice = createSlice({
  name: 'secrets',
  initialState,
  reducers: {
    updateSecretsList: (state, action) => {
      state.secrets = formatSecretsResponse(action.payload);
      state.loading = false;
    }
  },
  extraReducers: (builder) => {
    builder.addCase(resetAllStates, () => initialState);
  },
});

export default secretsListSlice.reducer;
const { updateSecretsList } = secretsListSlice.actions;
export { initialState, updateSecretsList };
