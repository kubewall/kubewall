import { Namespaces } from '../../../types';
import { RawRequestError } from '../../kwFetch';
import { createSlice } from '@reduxjs/toolkit';
import { formatNamespace } from '@/utils';
import { resetAllStates } from '@/redux/hooks';

type InitialState = {
  loading: boolean;
  namespaces: Namespaces[];
  error:  RawRequestError | null;
};

const initialState: InitialState = {
  loading: true,
  namespaces: [] as Namespaces[],
  error: null,
};


const namespacesSlice = createSlice({
  name: 'namespaces',
  initialState,
  reducers: {
    updateNamspaces: (state, action) => {
      state.namespaces = formatNamespace(action.payload);
      state.loading = false;
    }
  },
  extraReducers: (builder) => {
    // Intentionally does NOT respond to resetListSlices (unlike other list
    // slices): TableToolbar reads this for the namespace-filter dropdown on
    // every resource list page, not just a dedicated "Namespaces" page, so
    // it must survive navigating between resourcekinds.
    builder.addCase(resetAllStates, () => initialState);
  },
});
export default namespacesSlice.reducer;
const { updateNamspaces } = namespacesSlice.actions;
export { initialState, updateNamspaces };
