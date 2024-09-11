import { HPAsListHeader } from '@/types';
import { createSlice } from '@reduxjs/toolkit';
import { formatHPAResponse } from '@/utils';
import { resetAllStates } from '@/redux/hooks';

type InitialState = {
  loading: boolean;
  hpas: HPAsListHeader[];
};

const initialState: InitialState = {
  loading: true,
  hpas: [] as HPAsListHeader[],
};

const hpasListSlice = createSlice({
  name: 'secrets',
  initialState,
  reducers: {
    updateHPAsList: (state, action) => {
      state.hpas = formatHPAResponse(action.payload);
      state.loading = false;
    }
  },
  extraReducers: (builder) => {
    builder.addCase(resetAllStates, () => initialState);
  },
});

export default hpasListSlice.reducer;
const { updateHPAsList } = hpasListSlice.actions;
export { initialState, updateHPAsList };
