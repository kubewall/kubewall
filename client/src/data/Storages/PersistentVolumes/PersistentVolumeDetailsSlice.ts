import { PersistentVolumeDetails } from '@/types';
import { RawRequestError } from '@/data/kwFetch';
import { createSlice } from '@reduxjs/toolkit';
import { resetAllStates } from '@/redux/hooks';

type InitialState = {
  loading: boolean;
  persistentVolumeDetails: PersistentVolumeDetails;
  error: RawRequestError | null,
};

const initialState: InitialState = {
  loading: true,
  persistentVolumeDetails: {} as PersistentVolumeDetails,
  error: null,
};

const persistentVolumeDetailsSlice = createSlice({
  name: 'persistentVolumeDetails',
  initialState,
  reducers: {
    updatePersistentVolumeDetails: (state, action) => {
      state.persistentVolumeDetails = action.payload;
      state.loading = false;
    },
    resetPersistentVolumeDetails: () => {
      return initialState;
    }
  },
  extraReducers: (builder) => {
    builder.addCase(resetAllStates, () => initialState);
  },
});

export default persistentVolumeDetailsSlice.reducer;
const { resetPersistentVolumeDetails, updatePersistentVolumeDetails } = persistentVolumeDetailsSlice.actions;
export { initialState, resetPersistentVolumeDetails, updatePersistentVolumeDetails };
