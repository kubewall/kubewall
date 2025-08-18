import { CustomResources, CustomResourcesDefinitionsHeader, CustomResourcesNavigation } from '../../types';
import { formatCustomResources } from '@/utils';

import { RawRequestError } from '../kwFetch';
import { createSlice } from '@reduxjs/toolkit';
import { resetAllStates } from '@/redux/hooks';

type InitialState = {
  loading: boolean;
  customResources: CustomResources[];
  customResourcesDefinitions: CustomResourcesDefinitionsHeader[];
  customResourcesNavigation: CustomResourcesNavigation;
  error:  RawRequestError | null;
};

const initialState: InitialState = {
  loading: true,
  customResources: [] as CustomResources[],
  customResourcesDefinitions: [] as CustomResourcesDefinitionsHeader[],
  customResourcesNavigation: {} as CustomResourcesNavigation,
  error: null,
};

const customResourcesSlice = createSlice({
  name: 'customResources',
  initialState,
  reducers: {
    updateCustomResources: (state, action) => {
      state.customResources = action.payload;
      // The backend now returns transformed data, so we need to map it to the expected format
      state.customResourcesDefinitions = action.payload.map((crd: any) => ({
        name: crd.name,
        icon: crd.spec.icon,
        resource: crd.spec.names.kind,
        group: crd.spec.group,
        version: crd.activeVersion,
        scope: crd.scope,
        age: crd.age,
        uid: crd.uid
      }));
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
