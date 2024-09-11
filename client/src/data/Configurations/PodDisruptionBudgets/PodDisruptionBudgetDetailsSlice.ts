import { PodDisruptionBudgetDetails } from '@/types';
import { RawRequestError } from '@/data/kwFetch';
import { createSlice } from '@reduxjs/toolkit';
import { resetAllStates } from '@/redux/hooks';

type InitialState = {
  loading: boolean;
  podDisruptionBudgetDetails: PodDisruptionBudgetDetails;
  error: RawRequestError | null,
};

const initialState: InitialState = {
  loading: true,
  podDisruptionBudgetDetails: {} as PodDisruptionBudgetDetails,
  error: null,
};

const podDisruptionBudgetDetailsSlice = createSlice({
  name: 'podDisruptionBudgetDetails',
  initialState,
  reducers: {
    updatePodDisruptionBudgetDetails: (state, action) => {
      state.podDisruptionBudgetDetails = action.payload;
      state.loading = false;
    },
    resetPodDisruptionBudgetDetails: () => {
      return initialState;
    }
  },
  extraReducers: (builder) => {
    builder.addCase(resetAllStates, () => initialState);
  },
});

export default podDisruptionBudgetDetailsSlice.reducer;
const { resetPodDisruptionBudgetDetails, updatePodDisruptionBudgetDetails} = podDisruptionBudgetDetailsSlice.actions;
export { initialState, resetPodDisruptionBudgetDetails, updatePodDisruptionBudgetDetails };
