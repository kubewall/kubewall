import { RawRequestError } from '../../kwFetch';
import { StatefulSetDetails } from '../../../types';
import { createSlice } from '@reduxjs/toolkit';
import { resetAllStates } from '@/redux/hooks';

type InitialState = {
  loading: boolean;
  statefulSetDetails: StatefulSetDetails;
  error: RawRequestError | null,
};

const initialState: InitialState = {
  loading: true,
  statefulSetDetails: {} as StatefulSetDetails,
  error: null,
};

const statefulSetDetailsSlice = createSlice({
  name: 'statefulSetDetails',
  initialState,
  reducers: {
    updateStatefulSetDetails: (state, action) => {
      state.statefulSetDetails = action.payload;
      state.loading = false;
    },
    resetStatefulSetDetails: () => {
      return initialState;
    }
  },
  extraReducers: (builder) => {
    builder.addCase(resetAllStates, () => initialState);
  },
});

export default statefulSetDetailsSlice.reducer;
const { resetStatefulSetDetails, updateStatefulSetDetails } = statefulSetDetailsSlice.actions;
export { initialState, resetStatefulSetDetails, updateStatefulSetDetails };
