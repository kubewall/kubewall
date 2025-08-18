import { createSlice } from '@reduxjs/toolkit';
import { resetAllStates } from '@/redux/hooks';

type InitialState = {
  selectedConditions: string[];
};

const initialState: InitialState = {
  selectedConditions: []
};

const listTableNodeConditionSlice = createSlice({
  name: 'listTableNodeCondition',
  initialState,
  reducers: {
    updateFilterNodeCondition: (state, action) => {
      state.selectedConditions = action.payload;
    },
    resetFilterNodeCondition: () => {
      return initialState;
    }
  },
  extraReducers: (builder) => {
    builder.addCase(resetAllStates, () => initialState);
  },
});

export default listTableNodeConditionSlice.reducer;
const { updateFilterNodeCondition, resetFilterNodeCondition } = listTableNodeConditionSlice.actions;
export { initialState, updateFilterNodeCondition, resetFilterNodeCondition };