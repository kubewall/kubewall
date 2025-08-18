import { createSlice } from '@reduxjs/toolkit';
import { resetAllStates } from '@/redux/hooks';

type InitialState = {
  selectedQos: string[];
};

const initialState: InitialState = {
  selectedQos: []
};

const listTableQosSlice = createSlice({
  name: 'listTableQos',
  initialState,
  reducers: {
    updateFilterQos: (state, action) => {
      state.selectedQos = action.payload;
    },
    resetFilterQos: () => {
      return initialState;
    }
  },
  extraReducers: (builder) => {
    builder.addCase(resetAllStates, () => initialState);
  },
});

export default listTableQosSlice.reducer;
const { updateFilterQos, resetFilterQos } = listTableQosSlice.actions;
export { initialState, updateFilterQos, resetFilterQos };