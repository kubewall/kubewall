import { IngressesHeaders } from '@/types';
import { createSlice } from '@reduxjs/toolkit';
import { formatIngressesResponse } from '@/utils/Networks';
import { resetAllStates } from '@/redux/hooks';

type InitialState = {
  loading: boolean;
  ingresses: IngressesHeaders[];
};

const initialState: InitialState = {
  loading: true,
  ingresses: [] as IngressesHeaders[],
};

const ingressesListSlice = createSlice({
  name: 'ingresses',
  initialState,
  reducers: {
    updateIngressesList: (state, action) => {
      state.ingresses = formatIngressesResponse(action.payload);
      state.loading = false;
    }
  },
  extraReducers: (builder) => {
    builder.addCase(resetAllStates, () => initialState);
  },
});

export default ingressesListSlice.reducer;
const { updateIngressesList } = ingressesListSlice.actions;
export { initialState, updateIngressesList };
