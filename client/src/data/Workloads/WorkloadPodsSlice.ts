import { Pods } from '@/types';
import { RawRequestError } from '../kwFetch';
import { createSlice } from '@reduxjs/toolkit';
import { resetAllStates } from '@/redux/hooks';

type InitialState = {
  loading: boolean;
  workloadPodDetails: Pods[];
  error: RawRequestError | null,
};

const initialState: InitialState = {
  loading: true,
  workloadPodDetails: [] as Pods[],
  error: null,
};

// Backs the pod list on the Job, DaemonSet and StatefulSet details views. One
// slice serves all three because only one details view is mounted at a time, and
// the list it holds is scoped by the stream the mounted view subscribes to.
const workloadPodsSlice = createSlice({
  name: 'workloadPods',
  initialState,
  reducers: {
    updateWorkloadPods: (state, action) => {
      state.workloadPodDetails = action.payload.map((pod: Pods) => ({
        ...pod,
        ...(pod.memory ? { memory: `${pod.memory} MiB` } : {})
      }));
      state.loading = false;
    },
    resetWorkloadPods: () => {
      return initialState;
    }
  },
  extraReducers: (builder) => {
    builder.addCase(resetAllStates, () => initialState);
  },
});

const { updateWorkloadPods, resetWorkloadPods } = workloadPodsSlice.actions;
export default workloadPodsSlice.reducer;
export { initialState, updateWorkloadPods, resetWorkloadPods };
