import { createSlice } from '@reduxjs/toolkit';
import { resetAllStates } from '@/redux/hooks';

type InitialState = {
  selectedOperatingSystems: string[];
};

const initialState: InitialState = {
  selectedOperatingSystems: []
};

const listTableNodeOperatingSystemSlice = createSlice({
  name: 'listTableNodeOperatingSystem',
  initialState,
  reducers: {
    updateFilterNodeOperatingSystem: (state, action) => {
      state.selectedOperatingSystems = action.payload;
    },
    resetFilterNodeOperatingSystem: () => {
      return initialState;
    }
  },
  extraReducers: (builder) => {
    builder.addCase(resetAllStates, () => initialState);
  },
});

export default listTableNodeOperatingSystemSlice.reducer;
const { updateFilterNodeOperatingSystem, resetFilterNodeOperatingSystem } = listTableNodeOperatingSystemSlice.actions;
export { initialState, updateFilterNodeOperatingSystem, resetFilterNodeOperatingSystem };