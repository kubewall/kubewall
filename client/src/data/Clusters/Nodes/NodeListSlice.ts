import { NodeList } from '../../../types';
import { RawRequestError } from '../../kwFetch';
import { createSlice } from '@reduxjs/toolkit';
import { formatNodeList } from '@/utils';
import { resetAllStates } from '@/redux/hooks';

type InitialState = {
  loading: boolean;
  nodes: NodeList[];
  error:  RawRequestError | null;
};

const initialState: InitialState = {
  loading: true,
  nodes: [] as NodeList[],
  error: null,
};


const nodeListSlice = createSlice({
  name: 'nodeList',
  initialState,
  reducers: {
    updateNodesList: (state, action) => {
      state.nodes = formatNodeList(action.payload);
      state.loading = false;
    }
  },
  extraReducers: (builder) => {
    builder.addCase(resetAllStates, () => initialState);
  },
});

export default nodeListSlice.reducer;
const { updateNodesList } = nodeListSlice.actions;
export { initialState, updateNodesList };
