import { CustomResources, CustomResourcesNavigation } from '../../types';

import { RawRequestError } from '../kwFetch';
import { createSlice } from '@reduxjs/toolkit';
import { formatCustomResources } from '@/utils';
import { resetAllStates } from '@/redux/hooks';

type InitialState = {
  loading: boolean;
  customResources: CustomResources[];
  customResourcesNavigation: CustomResourcesNavigation;
  error:  RawRequestError | null;
};

const initialState: InitialState = {
  loading: true,
  customResources: [] as CustomResources[],
  customResourcesNavigation: {} as CustomResourcesNavigation,
  error: null,
};

const customResourcesSlice = createSlice({
  name: 'customResources',
  initialState,
  reducers: {
    updateCustomResources: (state, action) => {
      state.customResources = action.payload;
      state.customResourcesNavigation = formatCustomResources(action.payload);
      state.loading = false;
    }
  },
  extraReducers: (builder) => {
    builder.addCase(resetAllStates, () => initialState);
  },
});

export default customResourcesSlice.reducer;
const { updateCustomResources } = customResourcesSlice.actions;
export { initialState, updateCustomResources };
