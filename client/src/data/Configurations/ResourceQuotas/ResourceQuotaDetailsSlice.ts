import { RawRequestError } from '@/data/kwFetch';
import { ResourceQuotaDetails } from '@/types';
import { createSlice } from '@reduxjs/toolkit';
import { resetAllStates } from '@/redux/hooks';

type InitialState = {
  loading: boolean;
  resourceQuotaDetails: ResourceQuotaDetails;
  error: RawRequestError | null,
};

const initialState: InitialState = {
  loading: true,
  resourceQuotaDetails: {} as ResourceQuotaDetails,
  error: null,
};

const resourceQuotaDetailsSlice = createSlice({
  name: 'resourceQuotaDetails',
  initialState,
  reducers: {
    updateResourceQuotaDetails: (state, action) => {
      state.resourceQuotaDetails = action.payload;
      state.loading = false;
    },
    resetResourceQuotaDetails: () => {
      return initialState;
    }
  },
  extraReducers: (builder) => {
    builder.addCase(resetAllStates, () => initialState);
  },
});

export default resourceQuotaDetailsSlice.reducer;
const { resetResourceQuotaDetails, updateResourceQuotaDetails} = resourceQuotaDetailsSlice.actions;
export { initialState, resetResourceQuotaDetails, updateResourceQuotaDetails };
