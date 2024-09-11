import { RawRequestError } from '@/data/kwFetch';
import { SecretDetails } from '@/types';
import { createSlice } from '@reduxjs/toolkit';
import { resetAllStates } from '@/redux/hooks';

type InitialState = {
  loading: boolean;
  secretsDetails: SecretDetails;
  error: RawRequestError | null,
};

const initialState: InitialState = {
  loading: true,
  secretsDetails: {} as SecretDetails,
  error: null,
};

const secretsDetailsSlice = createSlice({
  name: 'secretsDetails',
  initialState,
  reducers: {
    updateSecretDetails: (state, action) => {
      state.secretsDetails = action.payload;
      state.loading = false;
    },
    resetSecretDetails: () => {
      return initialState;
    }
  },
  extraReducers: (builder) => {
    builder.addCase(resetAllStates, () => initialState);
  },
});

export default secretsDetailsSlice.reducer;
const { resetSecretDetails, updateSecretDetails} = secretsDetailsSlice.actions;
export { initialState, resetSecretDetails, updateSecretDetails };
