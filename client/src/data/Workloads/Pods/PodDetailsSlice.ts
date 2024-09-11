import { PodDetails } from '../../../types';
import { RawRequestError } from '../../kwFetch';
import { createSlice } from '@reduxjs/toolkit';
import { resetAllStates } from '@/redux/hooks';

type InitialState = {
  loading: boolean;
  podDetails : PodDetails;
  error: RawRequestError | null,
};

const initialState: InitialState = {
  loading: true,
  podDetails : {} as PodDetails,
  error: null,
};

const podDetailsSlice = createSlice({
  name: 'podDetails',
  initialState,
  reducers: {
    updatePodDetails: (state, action) => {
      state.podDetails = action.payload;
      state.loading = false;
    },
    resetPodDetails: () => {
      return initialState;
    }
  },
  extraReducers: (builder) => {
    builder.addCase(resetAllStates, () => initialState);
  },
});

export default podDetailsSlice.reducer;
const { updatePodDetails, resetPodDetails } = podDetailsSlice.actions;
export { initialState, updatePodDetails, resetPodDetails };
