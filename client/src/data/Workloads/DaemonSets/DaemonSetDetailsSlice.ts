import { DaemonSetDetails } from '../../../types';
import { RawRequestError } from '../../kwFetch';
import { createSlice } from '@reduxjs/toolkit';
import { resetAllStates } from '@/redux/hooks';

type InitialState = {
  loading: boolean;
  daemonSetDetails: DaemonSetDetails;
  error: RawRequestError | null,
};

const initialState: InitialState = {
  loading: true,
  daemonSetDetails: {} as DaemonSetDetails,
  error: null,
};

const daemonSetDetailsSlice = createSlice({
  name: 'daemonSetDetails',
  initialState,
  reducers: {
    updateDaemonSetDetails: (state, action) => {
      state.daemonSetDetails = action.payload;
      state.loading = false;
    },
    resetDaemonSetDetails: () => {
      return initialState;
    }
  },
  extraReducers: (builder) => {
    builder.addCase(resetAllStates, () => initialState);
  },
});

export default daemonSetDetailsSlice.reducer;
const { resetDaemonSetDetails, updateDaemonSetDetails} = daemonSetDetailsSlice.actions;
export { initialState, resetDaemonSetDetails, updateDaemonSetDetails };
