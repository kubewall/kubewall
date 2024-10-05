import { CustomResourcesDefinitionDetails } from '../../types';
import { RawRequestError } from '../kwFetch';
import { createSlice } from '@reduxjs/toolkit';
import { resetAllStates } from '@/redux/hooks';

type InitialState = {
  loading: boolean;
  customResourcesDefinitionDetails: CustomResourcesDefinitionDetails;
  error: RawRequestError | null;
};

const initialState: InitialState = {
  loading: true,
  customResourcesDefinitionDetails: {} as CustomResourcesDefinitionDetails,
  error: null,
};

const customResourcesDefinitionDetailsSlice = createSlice({
  name: 'customResourcesDefinitionDetails',
  initialState,
  reducers: {
    updateCustomResourcesDefinitionDetails: (state, action) => {
      state.customResourcesDefinitionDetails = action.payload;
      state.loading = false;
    },
    resetCustomResourcesDefinitionDetails: () => {
      return initialState;
    }
  },
  extraReducers: (builder) => {
    builder.addCase(resetAllStates, () => initialState);
  },
});

export default customResourcesDefinitionDetailsSlice.reducer;
const { resetCustomResourcesDefinitionDetails, updateCustomResourcesDefinitionDetails } = customResourcesDefinitionDetailsSlice.actions;
export { initialState, resetCustomResourcesDefinitionDetails, updateCustomResourcesDefinitionDetails };
