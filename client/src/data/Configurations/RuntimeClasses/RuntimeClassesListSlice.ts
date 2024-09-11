import { RuntimeClassesHeader } from '@/types';
import { createSlice } from '@reduxjs/toolkit';
import { resetAllStates } from '@/redux/hooks';

type InitialState = {
  loading: boolean;
  runtimeClasses: RuntimeClassesHeader[];
};

const initialState: InitialState = {
  loading: true,
  runtimeClasses: [] as RuntimeClassesHeader[],
};

const runtimeClassesListSlice = createSlice({
  name: 'runtimeClasses',
  initialState,
  reducers: {
    updateRuntimeClassesList: (state, action) => {
      state.runtimeClasses = action.payload;
      state.loading = false;
    }
  },
  extraReducers: (builder) => {
    builder.addCase(resetAllStates, () => initialState);
  },
});

export default runtimeClassesListSlice.reducer;
const { updateRuntimeClassesList } = runtimeClassesListSlice.actions;
export { initialState, updateRuntimeClassesList };
