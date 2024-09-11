import { CustomResourcesList } from '../../types';
import { RawRequestError } from '../kwFetch';
import { createSlice } from '@reduxjs/toolkit';
import { resetAllStates } from '@/redux/hooks';

type InitialState = {
  loading: boolean;
  customResourcesList: CustomResourcesList;
  error:  RawRequestError | null;
};

const initialState: InitialState = {
  loading: true,
  customResourcesList: {
    additionalPrinterColumns: [],
    list: []
  } as CustomResourcesList,
  error: null,
};

const customResourcesListSlice = createSlice({
  name: 'customResourcesList',
  initialState,
  reducers: {
    updateCustomResourcesList: (state, action) => {
      state.customResourcesList = Array.isArray(action.payload) && action.payload.length === 0 ? {
        additionalPrinterColumns: [],
        list: []
      } : action.payload;
      state.loading = false;
    },
    resetCustomResourcesList: () => {
      return initialState;
    }
  },
  extraReducers: (builder) => {
    builder.addCase(resetAllStates, () => initialState);
  },
});

export default customResourcesListSlice.reducer;
const { updateCustomResourcesList, resetCustomResourcesList } = customResourcesListSlice.actions;
export { initialState, updateCustomResourcesList, resetCustomResourcesList };

