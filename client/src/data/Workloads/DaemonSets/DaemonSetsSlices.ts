import { DaemonSets } from '../../../types';
import { RawRequestError } from '../../kwFetch';
import { createSlice } from '@reduxjs/toolkit';
import { formatDaemonSetsResponse } from '@/utils';
import { resetAllStates } from '@/redux/hooks';

type InitialState = {
  loading: boolean;
  daemonsets: DaemonSets[];
  error:  RawRequestError | null;
};

const initialState: InitialState = {
  loading: true,
  daemonsets: [] as DaemonSets[],
  error: null,
};

const daemonSetsSlice = createSlice({
  name: 'daemonsets',
  initialState,
  reducers: {
    updateDaemonSets: (state, action) => {
      state.daemonsets = formatDaemonSetsResponse(action.payload);
      state.loading = false;
    }
  },
  extraReducers: (builder) => {
    builder.addCase(resetAllStates, () => initialState);
  },
});

export default daemonSetsSlice.reducer;
const { updateDaemonSets } = daemonSetsSlice.actions;
export { initialState, updateDaemonSets };

