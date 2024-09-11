import { ConfigMaps } from '@/types';
import { RawRequestError } from '@/data/kwFetch';
import { createSlice } from '@reduxjs/toolkit';
import { formatConfigMapsResponse } from '@/utils';
import { resetAllStates } from '@/redux/hooks';

type InitialState = {
  loading: boolean;
  configMaps: ConfigMaps[];
  error:  RawRequestError | null;
};

const initialState: InitialState = {
  loading: true,
  configMaps: [] as ConfigMaps[],
  error: null,
};

const configMapsSlice = createSlice({
  name: 'configMaps',
  initialState,
  reducers: {
    updateConfigMapsList: (state, action) => {
      state.configMaps = formatConfigMapsResponse(action.payload);
      state.loading = false;
    }
  },
  extraReducers: (builder) => {
    builder.addCase(resetAllStates, () => initialState);
  },
});

export default configMapsSlice.reducer;
const { updateConfigMapsList } = configMapsSlice.actions;
export { initialState, updateConfigMapsList };
