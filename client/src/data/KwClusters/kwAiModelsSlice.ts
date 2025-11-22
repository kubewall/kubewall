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
  apiKey: string;
  queryParams: string;
}

const kwAiModels = createAsyncThunk('kwAiModels', ({ apiKey, queryParams }: fetchKwAIModelsProps, thunkAPI) => {
  const formatedUrl = `${API_VERSION}${MCP_SERVER_ENDPOINT}`.replace('//', '/');
  
  console.log('Fetching models from:', `${formatedUrl}/models?${queryParams}`);
  
  return kwFetch(`${formatedUrl}/models?${queryParams}`, {
    headers: {
      'Authorization': apiKey ? `Bearer ${apiKey}` : '',
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'Anthropic-Version': '2023-06-01'
    }
  })
    .then((res: kwAIModelResponse) => {
      if (!res) {
        console.warn('Empty response received');
        return { data: [], object: 'list' };
      }
      
      return res || { data: [], object: 'list' };
    })
    .catch((e: Error) => {
      console.error('API Error:', e);
      return thunkAPI.rejectWithValue(serializeError(e));
    });
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
        try {
          const formattedModels = formatKwAIModels(action.payload);
          state.kwAiModel = formattedModels;
          state.error = null;
          
        } catch (error) {
          console.error('Error formatting models:', error);
          // Don't set default models, just keep the state empty
          state.kwAiModel = [];
          state.error = { message: 'Error formatting models' };
        }
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
