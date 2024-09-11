import { PersistentVolumesHeaders } from '@/types';
import { createSlice } from '@reduxjs/toolkit';
import { formatPersistentVolumesResponse } from '@/utils';
import { resetAllStates } from '@/redux/hooks';

type InitialState = {
  loading: boolean;
  persistentVolumes: PersistentVolumesHeaders[];
};

const initialState: InitialState = {
  loading: true,
  persistentVolumes: [] as PersistentVolumesHeaders[],
};

const persistentVolumesListSlice = createSlice({
  name: 'persistentVolumes',
  initialState,
  reducers: {
    updatePersistentVolumesList: (state, action) => {
      state.persistentVolumes = formatPersistentVolumesResponse(action.payload);
      state.loading = false;
    },
  },
  extraReducers: (builder) => {
    builder.addCase(resetAllStates, () => initialState);
  },
});

export default persistentVolumesListSlice.reducer;
const { updatePersistentVolumesList } = persistentVolumesListSlice.actions;
export { initialState, updatePersistentVolumesList };
