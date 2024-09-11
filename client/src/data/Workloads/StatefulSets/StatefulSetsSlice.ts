import { RawRequestError } from '../../kwFetch';
import { StatefulSet } from '../../../types';
import { createSlice } from '@reduxjs/toolkit';
import { formatStatefulSetsResponse } from '@/utils';
import { resetAllStates } from '@/redux/hooks';

type InitialState = {
  loading: boolean;
  statefulSets: StatefulSet[];
  error: RawRequestError | null;
};

const initialState: InitialState = {
  loading: true,
  statefulSets: [] as StatefulSet[],
  error: null,
};

const statefulSetsSlice = createSlice({
  name: 'statefulSets',
  initialState,
  reducers: {
    updateStatefulSets: (state, action) => {
      state.statefulSets = formatStatefulSetsResponse(action.payload);
      state.loading = false;
    }
  },
  extraReducers: (builder) => {
    builder.addCase(resetAllStates, () => initialState);
  },
});

export default statefulSetsSlice.reducer;
const { updateStatefulSets } = statefulSetsSlice.actions;
export { initialState , updateStatefulSets };

