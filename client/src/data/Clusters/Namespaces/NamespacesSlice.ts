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
    builder.addCase(resetAllStates, () => initialState);
  },
});

export default namespacesSlice.reducer;
const { updateNamspaces } = namespacesSlice.actions;
export { initialState, updateNamspaces };
