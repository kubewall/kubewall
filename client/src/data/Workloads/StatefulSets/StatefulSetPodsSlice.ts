import { RawRequestError } from '../../kwFetch';
import { Pods } from '../../../types';
import { createSlice } from '@reduxjs/toolkit';
import { resetAllStates } from '@/redux/hooks';

type InitialState = {
  loading: boolean;
  statefulSetPodDetails: Pods[];
  error: RawRequestError | null;
};

const initialState: InitialState = {
  loading: true,
  statefulSetPodDetails: [] as Pods[],
  error: null,
};

const statefulSetPodsSlice = createSlice({
  name: 'statefulSetPods',
  initialState,
  reducers: {
    updateStatefulSetPods: (state, action) => {
      state.statefulSetPodDetails = action.payload;
      state.loading = false;
    }
  },
  extraReducers: (builder) => {
    builder.addCase(resetAllStates, () => initialState);
  },
});

export default statefulSetPodsSlice.reducer;
const { updateStatefulSetPods } = statefulSetPodsSlice.actions;
export { initialState, updateStatefulSetPods }; 