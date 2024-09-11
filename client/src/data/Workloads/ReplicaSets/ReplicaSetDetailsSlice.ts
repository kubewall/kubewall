import { RawRequestError } from '../../kwFetch';
import { ReplicaSetDetails } from '../../../types';
import { createSlice } from '@reduxjs/toolkit';
import { resetAllStates } from '@/redux/hooks';

type InitialState = {
  loading: boolean;
  replicaSetDetails: ReplicaSetDetails;
  error: RawRequestError | null,
};

const initialState: InitialState = {
  loading: true,
  replicaSetDetails: {} as ReplicaSetDetails,
  error: null,
};

const replicaSetDetailsSlice = createSlice({
  name: 'replicaSetDetails',
  initialState,
  reducers: {
    updateReplicaSetDetails: (state, action) => {
      state.replicaSetDetails = action.payload;
      state.loading = false;
    },
    resetReplicaSetDetails: () => {
      return initialState;
    }
  },
  extraReducers: (builder) => {
    builder.addCase(resetAllStates, () => initialState);
  },
});

export default replicaSetDetailsSlice.reducer;
const { resetReplicaSetDetails, updateReplicaSetDetails} = replicaSetDetailsSlice.actions;
export { initialState, resetReplicaSetDetails, updateReplicaSetDetails };
