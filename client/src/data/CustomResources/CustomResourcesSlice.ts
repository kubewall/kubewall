import { CustomResourcesDefinitionsHeader, CustomResourcesNavigation } from '../../types';
import { formatCustomResources, formatCustomResourcesDefinitionsResponse } from '@/utils';

import { RawRequestError } from '../kwFetch';
import { createSlice } from '@reduxjs/toolkit';
import isEqual from 'lodash/isEqual';
import { resetAllStates, resetListSlices } from '@/redux/hooks';

type InitialState = {
  loading: boolean;
  customResourcesDefinitions: CustomResourcesDefinitionsHeader[];
  customResourcesNavigation: CustomResourcesNavigation;
  error:  RawRequestError | null;
};

const initialState: InitialState = {
  loading: true,
  customResourcesDefinitions: [] as CustomResourcesDefinitionsHeader[],
  customResourcesNavigation: {} as CustomResourcesNavigation,
  error: null,
};

const customResourcesSlice = createSlice({
  name: 'customResources',
  initialState,
  reducers: {
    updateCustomResources: (state, action) => {
      // The CRD list is fully re-broadcast on every informer event (150ms
      // batching), so this fires far more often than the navigation tree
      // actually changes. Skip the assignment when the derived navigation is
      // unchanged so the sidebar (which memoizes on this field's identity)
      // doesn't re-sort and re-render every group on unrelated cluster churn.
      state.customResourcesDefinitions = formatCustomResourcesDefinitionsResponse(action.payload);
      const nextNavigation = formatCustomResources(action.payload);
      if (!isEqual(state.customResourcesNavigation, nextNavigation)) {
        state.customResourcesNavigation = nextNavigation;
      }
      state.loading = false;
    }
  },
  extraReducers: (builder) => {
    builder.addCase(resetAllStates, () => initialState);
    builder.addCase(resetListSlices, () => initialState);
  },
});
export default customResourcesSlice.reducer;
const { updateCustomResources } = customResourcesSlice.actions;
export { initialState, updateCustomResources };
