import { Pods } from '@/types';
import { RawRequestError } from '../../kwFetch';
import { createSlice } from '@reduxjs/toolkit';
import { resetAllStates } from '@/redux/hooks';

type InitialState = {
  loading: boolean;
  pods: Pods[];
  error: RawRequestError | null
};

const initialState: InitialState = {
  loading: true,
  pods: [] as Pods[],
  error: null
};

const podsSlice = createSlice({
  name: 'pods',
  initialState,
  reducers: {
    updatePodsList: (state, action) => {
      state.pods = action.payload.map((pod: Pods) => {
        return {
          ...pod,
          ...(pod.memory ? {memory: `${pod.memory} MiB`}: {})
        };
      });
      state.loading = false;
    }
  },
  extraReducers: (builder) => {
    builder.addCase(resetAllStates, () => initialState);
  },
});

export default podsSlice.reducer;
const { updatePodsList } = podsSlice.actions;
export { updatePodsList, initialState };
