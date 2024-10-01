import { createSlice } from '@reduxjs/toolkit';
import { resetAllStates } from '@/redux/hooks';

type InitialState = {
  selectedNamespace: string[];
};

const initialState: InitialState = {
  selectedNamespace: []
};

const listTableNamespaceSlice = createSlice({
  name: 'listTableNamespace',
  initialState,
  reducers: {
    updateFilterNamespace: (state, action) => {
      state.selectedNamespace = action.payload;
    },
    resetFilterNamespace: () => {
      return initialState;
    }
  },
  extraReducers: (builder) => {
    builder.addCase(resetAllStates, () => initialState);
  },
});

export default listTableNamespaceSlice.reducer;
const { updateFilterNamespace, resetFilterNamespace } = listTableNamespaceSlice.actions;
export { initialState, updateFilterNamespace, resetFilterNamespace };