import { API_VERSION, CONFIG_ENDPOINT } from "@/constants";
import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import kwFetch, { RawRequestError } from "../kwFetch";

import { resetAllStates } from "@/redux/hooks";
import { serializeError } from "serialize-error";

type InitialState = {
  loading: boolean;
  deleteConfigResponse: {
    message: string;
  };
  error: RawRequestError | null;
};

type DeleteConfigProps = {
  configId: string;
};

const initialState: InitialState = {
  loading: false,
  deleteConfigResponse: {
    message: ''
  },
  error: null,
};

const deleteConfig = createAsyncThunk('deleteConfig', ({ configId }: DeleteConfigProps, thunkAPI) => {
  const url = `${API_VERSION}${CONFIG_ENDPOINT}/kubeconfigs/${configId}`;
  
  return kwFetch(url, {
    method: 'DELETE'
  }).then((res) => {
      return res;
    })
    .catch((e: Error) => thunkAPI.rejectWithValue(serializeError(e)));
});

const deleteConfigSlice = createSlice({
  name: 'deleteConfig',
  initialState,
  reducers: {
    resetDeleteConfig: () => {
      return initialState;
    }
  },
  extraReducers: (builder) => {
    builder.addCase(deleteConfig.pending, (state) => {
      state.loading = true;
    });
    builder.addCase(
      deleteConfig.fulfilled,
      (state) => {
        state.loading = false;
        state.deleteConfigResponse = {
          message: 'Config Deleted'
        };
        state.error = null;
      },
    );
    builder.addCase(deleteConfig.rejected, (state, action) => {
      state.loading = false;
      state.error = action.payload as RawRequestError;
      state.deleteConfigResponse = {
        message: 'Failed to delete config'
      };
    });
    builder.addCase(resetAllStates, () => initialState);
  },
});
const { resetDeleteConfig } = deleteConfigSlice.actions;
export default deleteConfigSlice.reducer;
export { initialState, deleteConfig, resetDeleteConfig};
