import { LeasesListHeader } from '@/types';
import { createSlice } from '@reduxjs/toolkit';
import { resetAllStates } from '@/redux/hooks';

type InitialState = {
  loading: boolean;
  leases: LeasesListHeader[];
};

const initialState: InitialState = {
  loading: true,
  leases: [] as LeasesListHeader[],
};

const leasesListSlice = createSlice({
  name: 'leases',
  initialState,
  reducers: {
    updateLeasesList: (state, action) => {
      state.leases = action.payload;
      state.loading = false;
    }
  },
  extraReducers: (builder) => {
    builder.addCase(resetAllStates, () => initialState);
  },
});

export default leasesListSlice.reducer;
const { updateLeasesList } = leasesListSlice.actions;
export { initialState, updateLeasesList };
