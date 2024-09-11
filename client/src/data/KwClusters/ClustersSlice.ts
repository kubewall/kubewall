import { API_VERSION, CONFIG_ENDPOINT } from "@/constants";
import { PayloadAction, createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import kwFetch, { RawRequestError } from "../kwFetch";

import { Clusters } from "@/types";
import { serializeError } from "serialize-error";

type InitialState = {
  loading: boolean;
  clusters: Clusters;
  error:  RawRequestError | null;
};

const initialState: InitialState = {
  loading: false,
  clusters: {} as Clusters,
  error: null,
};

const fetchClusters = createAsyncThunk('config',(_, thunkAPI) => {
  return kwFetch(`${API_VERSION}${CONFIG_ENDPOINT}`)
  .then((res: Clusters) => res ?? {})
  .catch((e: Error) => thunkAPI.rejectWithValue(serializeError(e)));
});

const clustersSlices = createSlice({
  name: 'clusters',
  initialState,
  reducers: {
  },
  extraReducers: (builder) => {
    builder.addCase(fetchClusters.pending, (state) => {
      state.loading = true;
    });
    builder.addCase(
      fetchClusters.fulfilled,
      (state, action: PayloadAction<Clusters>) => {
        state.loading = false;
        state.clusters = action.payload;
        state.error = null;
      },
    );
    builder.addCase(fetchClusters.rejected, (state, action) => {
      state.loading = false;
      state.clusters = {} as Clusters;
      state.error = action.payload as RawRequestError;
    });
  },
});

export default clustersSlices.reducer;
export { initialState, fetchClusters };
