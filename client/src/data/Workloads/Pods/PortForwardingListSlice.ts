import { PortForwardingListResponse } from '../../../types';
import { RawRequestError } from '../../kwFetch';
import { createSlice } from '@reduxjs/toolkit';
import { resetAllStates } from '@/redux/hooks';

type InitialState = {
  loading: boolean;
  portForwardingList: PortForwardingListResponse[];
  error:  RawRequestError | null;
};

const initialState: InitialState = {
  loading: true,
  portForwardingList: [] as PortForwardingListResponse[],
  error: null,
};

const portForwardingListSlice = createSlice({
  name: 'portForwardingList',
  initialState,
  reducers: {
    updatePortForwardingList: (state, action) => {
      state.portForwardingList = action.payload;
      state.loading = false;
    }
  },
  extraReducers: (builder) => {
    builder.addCase(resetAllStates, () => initialState);
  },
});

export default portForwardingListSlice.reducer;
const { updatePortForwardingList } = portForwardingListSlice.actions;
export { initialState, updatePortForwardingList };
