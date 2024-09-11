import { RawRequestError } from '../../kwFetch';
import { ReplicaSet } from '../../../types';
import { createSlice } from '@reduxjs/toolkit';
import { formatReplicaSetsResponse } from '@/utils';
import { resetAllStates } from '@/redux/hooks';

type InitialState = {
  loading: boolean;
  replicaSets: ReplicaSet[];
  error:  RawRequestError | null;
};

const initialState: InitialState = {
  loading: true,
  replicaSets: [] as ReplicaSet[],
  error: null,
};

const replicaSetsSlice = createSlice({
  name: 'replicaSets',
  initialState,
  reducers: {
    updateReplicaSets: (state, action) => {
      state.replicaSets = formatReplicaSetsResponse(action.payload);
      state.loading = false;
    }
  },
  extraReducers: (builder) => {
    builder.addCase(resetAllStates, () => initialState);
  },
});

export default replicaSetsSlice.reducer;
const { updateReplicaSets } = replicaSetsSlice.actions;
export { initialState, updateReplicaSets };

