import { CustomResourceDetails } from '../../types';
import { RawRequestError } from '../kwFetch';
import { createSlice } from '@reduxjs/toolkit';
import { resetAllStates } from '@/redux/hooks';

type InitialState = {
  loading: boolean;
  customResourceDetails: CustomResourceDetails;
  error: RawRequestError | null,
};

const initialState: InitialState = {
  loading: true,
  customResourceDetails: {} as CustomResourceDetails,
  error: null,
};

const customResourceDetailsSlice = createSlice({
  name: 'customResourceDetails',
  initialState,
  reducers: {
    updateCustomResourceDetails: (state, action) => {
      state.customResourceDetails = action.payload;
      state.loading = false;
    },
    resetCustomResourceDetails: () => {
      return initialState;
    }
  },
  extraReducers: (builder) => {
    builder.addCase(resetAllStates, () => initialState);
  },
});

export default customResourceDetailsSlice.reducer;
const { resetCustomResourceDetails, updateCustomResourceDetails} = customResourceDetailsSlice.actions;
export { initialState, resetCustomResourceDetails, updateCustomResourceDetails };
