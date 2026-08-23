import { RawRequestError } from '@/data/kwFetch';
import { VolumeAttributesClassDetails } from '@/types';
import { createSlice } from '@reduxjs/toolkit';
import { resetAllStates } from '@/redux/hooks';

type InitialState = {
  loading: boolean;
  volumeAttributesClassDetails: VolumeAttributesClassDetails;
  error: RawRequestError | null,
};

const initialState: InitialState = {
  loading: true,
  volumeAttributesClassDetails: {} as VolumeAttributesClassDetails,
  error: null,
};

const volumeAttributesClassDetailsSlice = createSlice({
  name: 'volumeAttributesClassDetails',
  initialState,
  reducers: {
    updateVolumeAttributesClassDetails: (state, action) => {
      state.volumeAttributesClassDetails = action.payload;
      state.loading = false;
    },
    resetVolumeAttributesClassDetails: () => {
      return initialState;
    }
  },
  extraReducers: (builder) => {
    builder.addCase(resetAllStates, () => initialState);
  },
});

export default volumeAttributesClassDetailsSlice.reducer;
const { resetVolumeAttributesClassDetails, updateVolumeAttributesClassDetails } = volumeAttributesClassDetailsSlice.actions;
export { initialState, resetVolumeAttributesClassDetails, updateVolumeAttributesClassDetails };
