import { createSlice } from '@reduxjs/toolkit';
import { resetAllStates } from '@/redux/hooks';
import { RawRequestError } from '../../kwFetch';

type DependencyResource = {
  name: string;
  namespace: string;
  kind: string;
  [key: string]: any;
};

type ConfigMapDependencies = {
  pods?: DependencyResource[];
  deployments?: DependencyResource[];
  jobs?: DependencyResource[];
  cronjobs?: DependencyResource[];
};

type InitialState = {
  loading: boolean;
  configMapDependencies: ConfigMapDependencies;
  error: RawRequestError | null;
};

const initialState: InitialState = {
  loading: true,
  configMapDependencies: {},
  error: null,
};

const configMapDependenciesSlice = createSlice({
  name: 'configMapDependencies',
  initialState,
  reducers: {
    updateConfigMapDependencies: (state, action) => {
      state.configMapDependencies = action.payload || {};
      state.loading = false;
    },
    resetConfigMapDependencies: () => {
      return initialState;
    }
  },
  extraReducers: (builder) => {
    builder.addCase(resetAllStates, () => initialState);
  },
});

const { updateConfigMapDependencies, resetConfigMapDependencies } = configMapDependenciesSlice.actions;
export default configMapDependenciesSlice.reducer;
export { initialState, updateConfigMapDependencies, resetConfigMapDependencies };
export type { ConfigMapDependencies, DependencyResource };