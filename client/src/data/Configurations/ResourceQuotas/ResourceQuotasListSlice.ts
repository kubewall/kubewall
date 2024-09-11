import { ResourceQuotasResponse } from '@/types';
import { createSlice } from '@reduxjs/toolkit';
import { resetAllStates } from '@/redux/hooks';

type InitialState = {
  loading: boolean;
  resourceQuotas: ResourceQuotasResponse[];
};

const initialState: InitialState = {
  loading: true,
  resourceQuotas: [] as ResourceQuotasResponse[],
};

const resourceQuotasListSlice = createSlice({
  name: 'resourceQuotas',
  initialState,
  reducers: {
    updateResourceQuotasList: (state, action) => {
      state.resourceQuotas = action.payload;
      state.loading = false;
    }
  },
  extraReducers: (builder) => {
    builder.addCase(resetAllStates, () => initialState);
  },
});

export default resourceQuotasListSlice.reducer;
const { updateResourceQuotasList } = resourceQuotasListSlice.actions;
export { initialState, updateResourceQuotasList };
