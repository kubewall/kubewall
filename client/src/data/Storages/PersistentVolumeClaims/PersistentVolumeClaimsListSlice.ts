import { PersistentVolumeClaimsHeaders } from '@/types';
import { createSlice } from '@reduxjs/toolkit';
import { formatPersistentVolumeClaimsResponse } from '@/utils';
import { resetAllStates } from '@/redux/hooks';

type InitialState = {
  loading: boolean;
  persistentVolumeClaims: PersistentVolumeClaimsHeaders[];
};

const initialState: InitialState = {
  loading: true,
  persistentVolumeClaims: [] as PersistentVolumeClaimsHeaders[],
};

const persistentVolumeClaimsListSlice = createSlice({
  name: 'persistentVolumeClaims',
  initialState,
  reducers: {
    updatePersistentVolumeClaimsList: (state, action) => {
      state.persistentVolumeClaims = formatPersistentVolumeClaimsResponse(action.payload);
      state.loading = false;
    },
  },
  extraReducers: (builder) => {
    builder.addCase(resetAllStates, () => initialState);
  },
});

export default persistentVolumeClaimsListSlice.reducer;
const { updatePersistentVolumeClaimsList } = persistentVolumeClaimsListSlice.actions;
export { initialState, updatePersistentVolumeClaimsList };
