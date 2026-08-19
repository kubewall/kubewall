import { CSINodesHeaders } from '@/types';
import { createSlice } from '@reduxjs/toolkit';
import { resetAllStates, resetListSlices } from '@/redux/hooks';

type InitialState = {
  loading: boolean;
  csiNodes: CSINodesHeaders[];
};

const initialState: InitialState = {
  loading: true,
  csiNodes: [] as CSINodesHeaders[],
};

const csiNodesListSlice = createSlice({
  name: 'csiNodes',
  initialState,
  reducers: {
    updateCSINodesList: (state, action) => {
      state.csiNodes = action.payload;
      state.loading = false;
    },
  },
  extraReducers: (builder) => {
    builder.addCase(resetAllStates, () => initialState);
    builder.addCase(resetListSlices, () => initialState);
  },
});
export default csiNodesListSlice.reducer;
const { updateCSINodesList } = csiNodesListSlice.actions;
export { initialState, updateCSINodesList };
