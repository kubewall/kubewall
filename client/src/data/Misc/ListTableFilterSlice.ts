import { createSlice } from '@reduxjs/toolkit';
import { resetAllStates } from '@/redux/hooks';

type InitialState = {
  searchString: string
};

const initialState: InitialState = {
  searchString: ''
};

const listTableFilterSlice = createSlice({
  name: 'listTableFilter',
  initialState,
  reducers: {
    updateListTableFilter: (state, action) => {
      state.searchString = action.payload;
    },
    resetListTableFilter: () => {
      return initialState;
    }
  },
  extraReducers: (builder) => {
    builder.addCase(resetAllStates, () => initialState);
  },
});

export default listTableFilterSlice.reducer;
const { updateListTableFilter, resetListTableFilter } = listTableFilterSlice.actions;
export { initialState, updateListTableFilter, resetListTableFilter };