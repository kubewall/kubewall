import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import kwFetch, { RawRequestError } from '../kwFetch';

import { API_VERSION } from '@/constants';
import { resetAllStates } from '@/redux/hooks';
import { serializeError } from 'serialize-error';

type DeleteResourceResponse = {
  failures: {
    name: string;
    message: string;
    namespace?: string;
  }[];
}

type InitialState = {
  loading: boolean;
  message: DeleteResourceResponse;
  error: RawRequestError | null
};

type DeleteResourcesParams = {
  data: object;
  resourcekind: string;
  queryParams: string;
};

const initialState: InitialState = {
  loading: false,
  message: {} as DeleteResourceResponse,
  error: null
};

const deleteResources = createAsyncThunk('deleteResources', ({ data, resourcekind, queryParams }: DeleteResourcesParams, thunkAPI) => {
  const url = `${API_VERSION}/${resourcekind}?${queryParams}`;

  return kwFetch(url, {
    body: JSON.stringify(data),
    method: 'DELETE',
    headers: {
      'content-type': 'application/json'
    }
  }).then((res) => {
    return res;
  })
    .catch((e: Error) => thunkAPI.rejectWithValue(serializeError(e)));
});

const deleteResourcesSlice = createSlice({
  name: 'deleteResources',
  initialState,
  reducers: {
    resetDeleteResource: () => {
      return initialState;
    }
  },
  extraReducers: (builder) => {
    builder.addCase(deleteResources.pending, (state) => {
      state.loading = true;
    });
    builder.addCase(
      deleteResources.fulfilled,
      (state, action) => {
        state.loading = false;
        state.message = action.payload;
        state.error = null;
      },
    );
    builder.addCase(deleteResources.rejected, (state, action) => {
      state.loading = false;
      state.error = action.payload as RawRequestError;
      state.message = {
        failures: []
      };
    });
    builder.addCase(resetAllStates, () => initialState);
  },
});
const { resetDeleteResource } = deleteResourcesSlice.actions;
export default deleteResourcesSlice.reducer;
export { initialState, deleteResources, resetDeleteResource };
