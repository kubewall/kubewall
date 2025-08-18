import { createSlice } from '@reduxjs/toolkit';
import { resetAllStates } from '@/redux/hooks';
import { RawRequestError } from '../../kwFetch';

type DependencyResource = {
  name: string;
  namespace: string;
  kind: string;
  [key: string]: any;
};

type SecretDependencies = {
  pods?: DependencyResource[];
  deployments?: DependencyResource[];
  jobs?: DependencyResource[];
  cronjobs?: DependencyResource[];
};

type InitialState = {
  loading: boolean;
  secretDependencies: SecretDependencies;
  error: RawRequestError | null;
};

const initialState: InitialState = {
  loading: true,
  secretDependencies: {},
  error: null,
};

const secretDependenciesSlice = createSlice({
  name: 'secretDependencies',
  initialState,
  reducers: {
    updateSecretDependencies: (state, action) => {
      state.secretDependencies = action.payload || {};
      state.loading = false;
    },
    resetSecretDependencies: () => {
      return initialState;
    }
  },
  extraReducers: (builder) => {
    builder.addCase(resetAllStates, () => initialState);
  },
});

const { updateSecretDependencies, resetSecretDependencies } = secretDependenciesSlice.actions;
export default secretDependenciesSlice.reducer;
export { initialState, updateSecretDependencies, resetSecretDependencies };
export type { SecretDependencies, DependencyResource };