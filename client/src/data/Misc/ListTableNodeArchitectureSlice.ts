import { createSlice } from '@reduxjs/toolkit';
import { resetAllStates } from '@/redux/hooks';

type InitialState = {
  selectedArchitectures: string[];
};

const initialState: InitialState = {
  selectedArchitectures: []
};

const listTableNodeArchitectureSlice = createSlice({
  name: 'listTableNodeArchitecture',
  initialState,
  reducers: {
    updateFilterNodeArchitecture: (state, action) => {
      state.selectedArchitectures = action.payload;
    },
    resetFilterNodeArchitecture: () => {
      return initialState;
    }
  },
  extraReducers: (builder) => {
    builder.addCase(resetAllStates, () => initialState);
  },
});

export default listTableNodeArchitectureSlice.reducer;
const { updateFilterNodeArchitecture, resetFilterNodeArchitecture } = listTableNodeArchitectureSlice.actions;
export { initialState, updateFilterNodeArchitecture, resetFilterNodeArchitecture };