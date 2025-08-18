import { createSlice } from '@reduxjs/toolkit';
import { resetAllStates } from '@/redux/hooks';

type InitialState = {
  selectedStatuses: string[];
};

const initialState: InitialState = {
  selectedStatuses: []
};

const listTableStatusSlice = createSlice({
  name: 'listTableStatus',
  initialState,
  reducers: {
    updateFilterStatus: (state, action) => {
      state.selectedStatuses = action.payload;
    },
    resetFilterStatus: () => {
      return initialState;
    }
  },
  extraReducers: (builder) => {
    builder.addCase(resetAllStates, () => initialState);
  },
});

export default listTableStatusSlice.reducer;
const { updateFilterStatus, resetFilterStatus } = listTableStatusSlice.actions;
export { initialState, updateFilterStatus, resetFilterStatus };