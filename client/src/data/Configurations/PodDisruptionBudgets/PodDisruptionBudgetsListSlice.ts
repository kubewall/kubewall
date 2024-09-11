import { PodDisruptionBudgetsHeader } from '@/types';
import { createSlice } from '@reduxjs/toolkit';
import { formatPodDisruptionBudgetsResponse } from '@/utils';
import { resetAllStates } from '@/redux/hooks';

type InitialState = {
  loading: boolean; 
  podDisruptionBudgets: PodDisruptionBudgetsHeader[];
};

const initialState: InitialState = {
  loading: true,
  podDisruptionBudgets: [] as PodDisruptionBudgetsHeader[],
};

const podDisruptionBudgetsListSlice = createSlice({
  name: 'podDisruptionBudgets',
  initialState,
  reducers: {
    updatePodDisruptionBudgetsList: (state, action) => {
      state.podDisruptionBudgets = formatPodDisruptionBudgetsResponse(action.payload);
      state.loading = false;
    }
  },
  extraReducers: (builder) => {
    builder.addCase(resetAllStates, () => initialState);
  },
});

export default podDisruptionBudgetsListSlice.reducer;
const { updatePodDisruptionBudgetsList } = podDisruptionBudgetsListSlice.actions;
export { initialState, updatePodDisruptionBudgetsList };
