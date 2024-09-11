import { Event } from '../../types';
import  { RawRequestError } from '../kwFetch';
import { createSlice } from '@reduxjs/toolkit';
import { resetAllStates } from '@/redux/hooks';

type InitialState = {
  loading: boolean;
  name: string;
  instanceType: string;
  namespace: string;
  events: Event[];
  error: RawRequestError | null;
};


const initialState: InitialState = {
  loading: false,
  name: '',
  namespace: '',
  instanceType: '',
  events: [],
  error: null,
};

const eventSlice = createSlice({
  name: 'events',
  initialState,
  reducers: {
    updateEventsDetails: (state, action) => {
      state.events = action.payload;
      state.loading = false;
    },
    resetJobDetails: () => {
      return initialState;
    }
  },
  extraReducers: (builder) => {
    builder.addCase(resetAllStates, () => initialState);
  },
});

const { resetJobDetails, updateEventsDetails } = eventSlice.actions;
export default eventSlice.reducer;
export { initialState, resetJobDetails, updateEventsDetails};