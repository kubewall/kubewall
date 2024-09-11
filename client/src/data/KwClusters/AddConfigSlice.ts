import { API_VERSION, CONFIG_ENDPOINT } from "@/constants";
import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import kwFetch, { RawRequestError } from "../kwFetch";

import { resetAllStates } from "@/redux/hooks";
import { serializeError } from "serialize-error";

type InitialState = {
  loading: boolean;
  addConfigResponse: {
    message: string;
  };
  error: RawRequestError | null;
};

type AddConfigProps = {
  route: string;
  formData: FormData;
};

const initialState: InitialState = {
  loading: false,
  addConfigResponse: {
    message: ''
  },
  error: null,
};

const addConfig = createAsyncThunk('addConfig', ({ route, formData }: AddConfigProps, thunkAPI) => {
  const url = `${API_VERSION}${CONFIG_ENDPOINT}/${route}`;
  
  return kwFetch(url, {
    body: formData,
    method: 'POST'
  }).then((res) => {
      return res;
    })
    .catch((e: Error) => thunkAPI.rejectWithValue(serializeError(e)));
});

const addConfigSlice = createSlice({
  name: 'addConfig',
  initialState,
  reducers: {
    resetAddConfig: () => {
      return initialState;
    }
  },
  extraReducers: (builder) => {
    builder.addCase(addConfig.pending, (state) => {
      state.loading = true;
    });
    builder.addCase(
      addConfig.fulfilled,
      (state) => {
        state.loading = false;
        state.addConfigResponse = {
          message: 'Config added'
        };
        state.error = null;
      },
    );
    builder.addCase(addConfig.rejected, (state, action) => {
      state.loading = false;
      state.error = action.payload as RawRequestError;
      state.addConfigResponse = {
        message: 'Failed to add config'
      };
    });
    builder.addCase(resetAllStates, () => initialState);
  },
});
const { resetAddConfig } = addConfigSlice.actions;
export default addConfigSlice.reducer;
export { initialState, addConfig, resetAddConfig};
