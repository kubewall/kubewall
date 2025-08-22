import { RawRequestError } from '../../kwFetch';
import { Pods } from '../../../types';
import { createSlice } from '@reduxjs/toolkit';
import { resetAllStates } from '@/redux/hooks';

type InitialState = {
  loading: boolean;
  persistentVolumeClaimPodDetails: Pods[];
  error: RawRequestError | null;
};

const initialState: InitialState = {
  loading: true,
  persistentVolumeClaimPodDetails: [] as Pods[],
  error: null,
};

const persistentVolumeClaimPodsSlice = createSlice({
  name: 'persistentVolumeClaimPods',
  initialState,
  reducers: {
    updatePersistentVolumeClaimPods: (state, action) => {
      state.persistentVolumeClaimPodDetails = action.payload;
      state.loading = false;
    }
  },
  extraReducers: (builder) => {
    builder.addCase(resetAllStates, () => initialState);
  },
});

export default persistentVolumeClaimPodsSlice.reducer;
const { updatePersistentVolumeClaimPods } = persistentVolumeClaimPodsSlice.actions;
export { initialState, updatePersistentVolumeClaimPods };