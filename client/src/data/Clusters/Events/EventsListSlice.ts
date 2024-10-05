import { ClusterEventsHeaders } from '@/types';
import { createSlice } from '@reduxjs/toolkit';
import { formatClusterEvents } from '@/utils';
import { resetAllStates } from '@/redux/hooks';

type InitialState = {
  loading: boolean;
  clusterEvents: ClusterEventsHeaders[];
};

const initialState: InitialState = {
  loading: true,
  clusterEvents: [] as ClusterEventsHeaders[],
};

const clusterEventsListSlice = createSlice({
  name: 'clusterEvents',
  initialState,
  reducers: {
    updateClusterEventsList: (state, action) => {
      state.clusterEvents = formatClusterEvents(action.payload);
      state.loading = false;
    }
  },
  extraReducers: (builder) => {
    builder.addCase(resetAllStates, () => initialState);
  },
});

export default clusterEventsListSlice.reducer;
const { updateClusterEventsList } = clusterEventsListSlice.actions;
export { initialState, updateClusterEventsList };
