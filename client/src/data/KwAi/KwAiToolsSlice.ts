import { ToolSet, experimental_createMCPClient } from "ai";
import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";

import { RawRequestError } from "../kwFetch";
import { serializeError } from "serialize-error";

type InitialState = {
  loading: boolean;
  tools: ToolSet;
  error:  RawRequestError | null;
};

const initialState: InitialState = {
  loading: false,
  tools: {},
  error: null,
};

const fetchKwAiTools = createAsyncThunk('kwAiTools',(_, thunkAPI) => {
  return experimental_createMCPClient({
      transport: {
        type: 'sse',
        url: 'http://localhost:7080/api/v1/mcp/sse?cluster=orbstack&config=config',
      },
    })
  .then((res) => res.tools())
  .catch((e: Error) => thunkAPI.rejectWithValue(serializeError(e)));
});

const kwAiToolsSlice = createSlice({
  name: 'tools',
  initialState,
  reducers: {
  },
  extraReducers: (builder) => {
    builder.addCase(fetchKwAiTools.pending, (state) => {
      state.loading = true;
    });
    builder.addCase(
      fetchKwAiTools.fulfilled,
      (state, action) => {
        state.loading = false;
        state.tools = action.payload;
        state.error = null;
      },
    );
    builder.addCase(fetchKwAiTools.rejected, (state, action) => {
      state.loading = false;
      state.tools = {};
      state.error = action.payload as RawRequestError;
    });
  },
});

export default kwAiToolsSlice.reducer;
export { initialState, fetchKwAiTools };
