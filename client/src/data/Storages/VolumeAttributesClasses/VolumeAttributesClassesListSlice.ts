import { VolumeAttributesClassesHeaders } from '@/types';
import { createSlice } from '@reduxjs/toolkit';
import { resetAllStates, resetListSlices } from '@/redux/hooks';

type InitialState = {
  loading: boolean;
  volumeAttributesClasses: VolumeAttributesClassesHeaders[];
};

const initialState: InitialState = {
  loading: true,
  volumeAttributesClasses: [] as VolumeAttributesClassesHeaders[],
};

const volumeAttributesClassesListSlice = createSlice({
  name: 'volumeAttributesClasses',
  initialState,
  reducers: {
    updateVolumeAttributesClassesList: (state, action) => {
      state.volumeAttributesClasses = action.payload;
      state.loading = false;
    },
  },
  extraReducers: (builder) => {
    builder.addCase(resetAllStates, () => initialState);
    builder.addCase(resetListSlices, () => initialState);
  },
});
export default volumeAttributesClassesListSlice.reducer;
const { updateVolumeAttributesClassesList } = volumeAttributesClassesListSlice.actions;
export { initialState, updateVolumeAttributesClassesList };
