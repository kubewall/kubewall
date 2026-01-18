import { API_VERSION, MCP_SERVER_ENDPOINT } from "@/constants";
import { PayloadAction, createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import { kwAIModel, kwAIModelResponse } from "@/types/kwAI/addConfiguration";
import kwFetch, { RawRequestError } from "../kwFetch";

import { formatKwAIModels } from "@/utils/kwAI/CreateConfig";
import { serializeError } from "serialize-error";

type InitialState = {
  loading: boolean;
  kwAiModel: kwAIModel[];
  error: RawRequestError | null;
};

const initialState: InitialState = {
  loading: false,
  kwAiModel: [] as kwAIModel[],
  error: null,
};

type fetchKwAIModelsProps = {
  url: string;
  apiKey: string;
  queryParams: string;
}

const kwAiModels = createAsyncThunk('kwAiModels', ({ apiKey, url, queryParams }: fetchKwAIModelsProps, thunkAPI) => {
  const formatedUrl = `${API_VERSION}/${MCP_SERVER_ENDPOINT}`.replace('//', '/');
  const encodedUrl = encodeURIComponent(url);
  return kwFetch(`${formatedUrl}/${encodedUrl}/models?${queryParams}`, {
    headers: {
      'X-KW-AI-API-Key': apiKey
    }
  })
    .then((res: kwAIModelResponse) => res ?? {})
    .catch((e: Error) => thunkAPI.rejectWithValue(serializeError(e)));
});

const kwAiModelsSlices = createSlice({
  name: 'kwAiModel',
  initialState,
  reducers: {
    resetKwAiModels: () => {
      return initialState;
    }
  },
  extraReducers: (builder) => {
    builder.addCase(kwAiModels.pending, (state) => {
      state.loading = true;
    });
    builder.addCase(
      kwAiModels.fulfilled,
      (state, action: PayloadAction<kwAIModelResponse>) => {
        state.loading = false;
        state.kwAiModel = formatKwAIModels(action.payload);
        state.error = null;
      },
    );
    builder.addCase(kwAiModels.rejected, (state, action) => {
      state.loading = false;
      state.kwAiModel = [] as kwAIModel[];
      state.error = action.payload as RawRequestError;
    });
  },
});

export default kwAiModelsSlices.reducer;
const { resetKwAiModels } = kwAiModelsSlices.actions;
export { initialState, kwAiModels, resetKwAiModels };
