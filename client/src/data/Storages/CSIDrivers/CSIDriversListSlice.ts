import { CSIDriversHeaders } from '@/types';
import { createSlice } from '@reduxjs/toolkit';
import { resetAllStates, resetListSlices } from '@/redux/hooks';

type InitialState = {
  loading: boolean;
  csiDrivers: CSIDriversHeaders[];
};

const initialState: InitialState = {
  loading: true,
  csiDrivers: [] as CSIDriversHeaders[],
};

const csiDriversListSlice = createSlice({
  name: 'csiDrivers',
  initialState,
  reducers: {
    updateCSIDriversList: (state, action) => {
      state.csiDrivers = action.payload;
      state.loading = false;
    },
  },
  extraReducers: (builder) => {
    builder.addCase(resetAllStates, () => initialState);
    builder.addCase(resetListSlices, () => initialState);
  },
});
export default csiDriversListSlice.reducer;
const { updateCSIDriversList } = csiDriversListSlice.actions;
export { initialState, updateCSIDriversList };
