import { EndpointsHeaders } from '@/types';
import { createSlice } from '@reduxjs/toolkit';
import { formatEndpointsResponse } from '@/utils/Networks';
import { resetAllStates } from '@/redux/hooks';

type InitialState = {
  loading: boolean;
  endpoints: EndpointsHeaders[];
};

const initialState: InitialState = {
  loading: true,
  endpoints: [] as EndpointsHeaders[],
};

const endpointsListSlice = createSlice({
  name: 'endpoints',
  initialState,
  reducers: {
    updateEndpointsList: (state, action) => {
      state.endpoints = formatEndpointsResponse(action.payload);
      state.loading = false;
    }
  },
  extraReducers: (builder) => {
    builder.addCase(resetAllStates, () => initialState);
  },
});

export default endpointsListSlice.reducer;
const { updateEndpointsList } = endpointsListSlice.actions;
export { initialState, updateEndpointsList };
