import { NodeDetails } from '@/types';
import { RawRequestError } from '@/data/kwFetch';
import { createSlice } from '@reduxjs/toolkit';
import { resetAllStates } from '@/redux/hooks';

type InitialState = {
  loading: boolean;
  nodeDetails: NodeDetails;
  error: RawRequestError | null,
};

const initialState: InitialState = {
  loading: true,
  nodeDetails: {} as NodeDetails,
  error: null,
};

const nodeDetailsSlice = createSlice({
  name: 'nodeDetails',
  initialState,
  reducers: {
    updateNodeDetails: (state, action) => {
      state.nodeDetails = action.payload;
      state.loading = false;
    },
    resetNodeDetails: () => {
      return initialState;
    }
  },
  extraReducers: (builder) => {
    builder.addCase(resetAllStates, () => initialState);
  },
});

export default nodeDetailsSlice.reducer;
const { resetNodeDetails, updateNodeDetails} = nodeDetailsSlice.actions;
export { initialState, resetNodeDetails, updateNodeDetails };
