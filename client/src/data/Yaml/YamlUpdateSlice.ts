import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import kwFetch, { RawRequestError } from "../kwFetch";

import { API_VERSION } from "@/constants";
import { resetAllStates } from "@/redux/hooks";
import { serializeError } from "serialize-error";

type InitialState = {
  loading: boolean;
  yamlUpdateResponse: {
    message: string;
  };
  error: RawRequestError | null;
};

type UpdateYamlParams = {
  data: string;
  queryParams: string;
};

const initialState: InitialState = {
  loading: false,
  yamlUpdateResponse: {
    message: ''
  },
  error: null,
};

const updateYaml = createAsyncThunk('yaml/updateYaml', ({ data, queryParams }: UpdateYamlParams, thunkAPI) => {
  const url = `${API_VERSION}/app/apply?${queryParams}`;
  const formdata = new FormData();
  formdata.append('yaml', data);
  
  return kwFetch(url, {
    body: formdata,
    method: 'POST'
  }).then((res) => {
      return res;
    })
    .catch((e: Error) => thunkAPI.rejectWithValue(serializeError(e)));
});

const updateYamlSlice = createSlice({
  name: 'updateYaml',
  initialState,
  reducers: {
    resetUpdateYaml: () => {
      return initialState;
    }
  },
  extraReducers: (builder) => {
    builder.addCase(updateYaml.pending, (state) => {
      state.loading = true;
    });
    builder.addCase(
      updateYaml.fulfilled,
      (state) => {
        state.loading = false;
        state.yamlUpdateResponse = {
          message: 'Yaml Updated.'
        };
        state.error = null;
      },
    );
    builder.addCase(updateYaml.rejected, (state, action) => {
      state.loading = false;
      state.error = action.payload as RawRequestError;
      state.yamlUpdateResponse = {
        message: ''
      };
    });
    builder.addCase(resetAllStates, () => initialState);
  },
});
const { resetUpdateYaml } = updateYamlSlice.actions;
export default updateYamlSlice.reducer;
export { initialState, updateYaml, resetUpdateYaml};
