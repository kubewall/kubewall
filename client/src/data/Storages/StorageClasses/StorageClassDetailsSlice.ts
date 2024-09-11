import { RawRequestError } from '@/data/kwFetch';
import { StorageClassDetails } from '@/types';
import { createSlice } from '@reduxjs/toolkit';
import { resetAllStates } from '@/redux/hooks';

type InitialState = {
  loading: boolean;
  storageClassDetails: StorageClassDetails;
  error: RawRequestError | null,
};

const initialState: InitialState = {
  loading: true,
  storageClassDetails: {} as StorageClassDetails,
  error: null,
};

const storageClassDetailsSlice = createSlice({
  name: 'storageClassDetails',
  initialState,
  reducers: {
    updateStorageClassDetails: (state, action) => {
      state.storageClassDetails = action.payload;
      state.loading = false;
    },
    resetStorageClassDetails: () => {
      return initialState;
    }
  },
  extraReducers: (builder) => {
    builder.addCase(resetAllStates, () => initialState);
  },
});

export default storageClassDetailsSlice.reducer;
const { resetStorageClassDetails, updateStorageClassDetails } = storageClassDetailsSlice.actions;
export { initialState, resetStorageClassDetails, updateStorageClassDetails };
