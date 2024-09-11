import { PersistentVolumeClaimDetails } from '@/types';
import { RawRequestError } from '@/data/kwFetch';
import { createSlice } from '@reduxjs/toolkit';
import { resetAllStates } from '@/redux/hooks';

type InitialState = {
  loading: boolean;
  persistentVolumeClaimDetails: PersistentVolumeClaimDetails;
  error: RawRequestError | null,
};

const initialState: InitialState = {
  loading: true,
  persistentVolumeClaimDetails: {} as PersistentVolumeClaimDetails,
  error: null,
};

const persistentVolumeClaimDetailsSlice = createSlice({
  name: 'persistentVolumeClaimDetails',
  initialState,
  reducers: {
    updatePersistentVolumeClaimDetails: (state, action) => {
      state.persistentVolumeClaimDetails = action.payload;
      state.loading = false;
    },
    resetPersistentVolumeClaimDetails: () => {
      return initialState;
    }
  },
  extraReducers: (builder) => {
    builder.addCase(resetAllStates, () => initialState);
  },
});

export default persistentVolumeClaimDetailsSlice.reducer;
const { resetPersistentVolumeClaimDetails, updatePersistentVolumeClaimDetails } = persistentVolumeClaimDetailsSlice.actions;
export { initialState, resetPersistentVolumeClaimDetails, updatePersistentVolumeClaimDetails };
