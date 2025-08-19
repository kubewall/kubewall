import { ToolSet, experimental_createMCPClient } from "ai";
import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";

import { RawRequestError } from "../kwFetch";
import { serializeError } from "serialize-error";

// Module-level variable to store the full tools object (including functions)
let fullTools: ToolSet = {};

type InitialState = {
  loading: boolean;
  tools: ToolSet; // Only serializable data!
  error: RawRequestError | null;
};

const initialState: InitialState = {
  loading: false,
  tools: {},
  error: null,
};

const fetchKwAiTools = createAsyncThunk('kwAiTools', async ({isDev}: {isDev: boolean}, thunkAPI) => {
  try {
    const hostName = isDev ? 'http://localhost:7080' : window.location.origin;
    const client = await experimental_createMCPClient({
      transport: {
        type: 'sse',
        url: `${hostName}/api/v1/mcp/sse?cluster=orbstack&config=config`,
      },
    });
    const tools = await client.tools();

    // Store the full tools object (with functions) outside Redux
    fullTools = tools;

    // Only store serializable data in Redux
    const serializableTools: ToolSet = {};
    for (const [key, tool] of Object.entries(tools)) {
      serializableTools[key] = {} as typeof tool;
      for (const [prop, value] of Object.entries(tool)) {
        if (typeof value !== "function") {
          /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
          (serializableTools[key] as Record<string, any>)[prop] = value;
        }
      }
    }

    return serializableTools;
  } catch (e) {
    return thunkAPI.rejectWithValue(serializeError(e));
  }
});

const kwAiToolsSlice = createSlice({
  name: 'tools',
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder.addCase(fetchKwAiTools.pending, (state) => {
      state.loading = true;
    });
    builder.addCase(fetchKwAiTools.fulfilled, (state, action) => {
      state.loading = false;
      // TODO: fix this type error
      // @ts-expect-error: action.payload is ToolSet
      state.tools = action.payload;
      state.error = null;
    });
    builder.addCase(fetchKwAiTools.rejected, (state, action) => {
      state.loading = false;
      state.tools = {};
      state.error = action.payload as RawRequestError;
    });
  },
});

// Export a getter for the full tools object (with functions)
export const getFullTools = () => fullTools;

export default kwAiToolsSlice.reducer;
export { initialState, fetchKwAiTools };
