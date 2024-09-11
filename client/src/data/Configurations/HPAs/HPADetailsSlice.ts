import { HPADetails } from '@/types';
import { RawRequestError } from '@/data/kwFetch';
import { createSlice } from '@reduxjs/toolkit';
import { resetAllStates } from '@/redux/hooks';

type InitialState = {
  loading: boolean;
  hpaDetails: HPADetails;
  error: RawRequestError | null,
};

const initialState: InitialState = {
  loading: true,
  hpaDetails: {} as HPADetails,
  error: null,
};

const hpaDetailsSlice = createSlice({
  name: 'hpaDetails',
  initialState,
  reducers: {
    updateHPADetails: (state, action) => {
      state.hpaDetails = action.payload;
      state.loading = false;
    },
    resetHPADetails: () => {
      return initialState;
    }
  },
  extraReducers: (builder) => {
    builder.addCase(resetAllStates, () => initialState);
  },
});

export default hpaDetailsSlice.reducer;
const { resetHPADetails, updateHPADetails} = hpaDetailsSlice.actions;
export { initialState, resetHPADetails, updateHPADetails };
