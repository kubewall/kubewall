import { NamespaceDetails } from '@/types';
import { RawRequestError } from '@/data/kwFetch';
import { createSlice } from '@reduxjs/toolkit';
import { resetAllStates } from '@/redux/hooks';

type InitialState = {
  loading: boolean;
  namespaceDetails: NamespaceDetails;
  error: RawRequestError | null,
};

const initialState: InitialState = {
  loading: true,
  namespaceDetails: {} as NamespaceDetails,
  error: null,
};

const namespaceDetailsSlice = createSlice({
  name: 'namespaceDetails',
  initialState,
  reducers: {
    updateNamespaceDetails: (state, action) => {
      state.namespaceDetails = action.payload;
      state.loading = false;
    },
    resetNamespaceDetails: () => {
      return initialState;
    }
  },
  extraReducers: (builder) => {
    builder.addCase(resetAllStates, () => initialState);
  },
});

export default namespaceDetailsSlice.reducer;
const { resetNamespaceDetails, updateNamespaceDetails} = namespaceDetailsSlice.actions;
export { initialState, resetNamespaceDetails, updateNamespaceDetails };
