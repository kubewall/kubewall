import { PriorityClassesHeaders } from '@/types';
import { createSlice } from '@reduxjs/toolkit';
import { resetAllStates, resetListSlices } from '@/redux/hooks';

type InitialState = {
  loading: boolean;
  priorityClasses: PriorityClassesHeaders[];
};

const initialState: InitialState = {
  loading: true,
  priorityClasses: [] as PriorityClassesHeaders[],
};

const priorityClassesListSlice = createSlice({
  name: 'priorityClasses',
  initialState,
  reducers: {
    updatePriorityClassesList: (state, action) => {
      state.priorityClasses = action.payload;
      state.loading = false;
    }
  },
  extraReducers: (builder) => {
    builder.addCase(resetAllStates, () => initialState);
    builder.addCase(resetListSlices, () => initialState);
  },
});
export default priorityClassesListSlice.reducer;
const { updatePriorityClassesList } = priorityClassesListSlice.actions;
export { initialState, updatePriorityClassesList };
