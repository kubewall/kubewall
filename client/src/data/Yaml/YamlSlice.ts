import { RawRequestError } from '../kwFetch';
import { createSlice } from '@reduxjs/toolkit';
import { resetAllStates } from '@/redux/hooks';

type InitialState = {
  loading: boolean;
  yamlData: string;
  error: RawRequestError | null;
};


const initialState: InitialState = {
  loading: true,
  yamlData: '',
  error: null,
};

const yamlSlice = createSlice({
  name: 'yaml',
  initialState,
  reducers: {
    updateYamlDetails: (state, action) => {
      state.yamlData = atob(action.payload.data);
      state.loading = false;
    },
    resetYamlDetails: () => {
      return initialState;
    }
  },
  extraReducers: (builder) => {
    builder.addCase(resetAllStates, () => initialState);
  },
});

const { updateYamlDetails, resetYamlDetails } = yamlSlice.actions;
export default yamlSlice.reducer;
export { initialState, updateYamlDetails, resetYamlDetails};
