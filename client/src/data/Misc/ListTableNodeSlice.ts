import { createSlice } from '@reduxjs/toolkit';
import { resetAllStates } from '@/redux/hooks';

type InitialState = {
  selectedNodes: string[];
};

const initialState: InitialState = {
  selectedNodes: []
};

const listTableNodeSlice = createSlice({
  name: 'listTableNode',
  initialState,
  reducers: {
    updateFilterNode: (state, action) => {
      state.selectedNodes = action.payload;
    },
    resetFilterNode: () => {
      return initialState;
    }
  },
  extraReducers: (builder) => {
    builder.addCase(resetAllStates, () => initialState);
  },
});

export default listTableNodeSlice.reducer;
const { updateFilterNode, resetFilterNode } = listTableNodeSlice.actions;
export { initialState, updateFilterNode, resetFilterNode };