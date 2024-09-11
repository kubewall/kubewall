import { ServicesListHeaders } from '@/types';
import { createSlice } from '@reduxjs/toolkit';
import { formatServicesResponse } from '@/utils/Networks';
import { resetAllStates } from '@/redux/hooks';

type InitialState = {
  loading: boolean;
  services: ServicesListHeaders[];
};

const initialState: InitialState = {
  loading: true,
  services: [] as ServicesListHeaders[],
};

const servicesListSlice = createSlice({
  name: 'services',
  initialState,
  reducers: {
    updateServicesList: (state, action) => {
      state.services = formatServicesResponse(action.payload);
      state.loading = false;
    }
  },
  extraReducers: (builder) => {
    builder.addCase(resetAllStates, () => initialState);
  },
});

export default servicesListSlice.reducer;
const { updateServicesList } = servicesListSlice.actions;
export { initialState, updateServicesList };
