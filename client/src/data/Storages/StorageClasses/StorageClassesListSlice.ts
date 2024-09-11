import { StorageClassesHeaders } from '@/types';
import { createSlice } from '@reduxjs/toolkit';
import { resetAllStates } from '@/redux/hooks';

type InitialState = {
  loading: boolean;
  storageClasses: StorageClassesHeaders[];
};

const initialState: InitialState = {
  loading: true,
  storageClasses: [] as StorageClassesHeaders[],
};

const storageClassesListSlice = createSlice({
  name: 'storageClasses',
  initialState,
  reducers: {
    updateStorageClassesList: (state, action) => {
      state.storageClasses = action.payload;
      state.loading = false;
    },
  },
  extraReducers: (builder) => {
    builder.addCase(resetAllStates, () => initialState);
  },
});

export default storageClassesListSlice.reducer;
const { updateStorageClassesList } = storageClassesListSlice.actions;
export { initialState, updateStorageClassesList };
