import { ConfigMapDetails } from '@/types';
import { RawRequestError } from '@/data/kwFetch';
import { createSlice } from '@reduxjs/toolkit';
import { resetAllStates } from '@/redux/hooks';

type InitialState = {
  loading: boolean;
  configMapDetails: ConfigMapDetails;
  error: RawRequestError | null,
};

const initialState: InitialState = {
  loading: true,
  configMapDetails: {} as ConfigMapDetails,
  error: null,
};

const configMapDetailsSlice = createSlice({
  name: 'configMapDetails',
  initialState,
  reducers: {
    updateConfigMapDetails: (state, action) => {
      state.configMapDetails = action.payload;
      state.loading = false;
    },
    resetConfigMapDetails: () => {
      return initialState;
    }
  },
  extraReducers: (builder) => {
    builder.addCase(resetAllStates, () => initialState);
  },
});

export default configMapDetailsSlice.reducer;
const { resetConfigMapDetails, updateConfigMapDetails} = configMapDetailsSlice.actions;
export { initialState, resetConfigMapDetails, updateConfigMapDetails };
