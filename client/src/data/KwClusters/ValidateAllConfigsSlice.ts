import { API_VERSION, CONFIG_ENDPOINT, KUBECONFIGS_VALIDATE_ALL_URL } from "@/constants";
import { PayloadAction, createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import kwFetch from "../kwFetch";
import { serializeError } from "serialize-error";

type ClusterStatus = {
  name: string;
  cluster: string;
  reachable: boolean;
  error?: string;
};

type ConfigValidationResult = {
  name: string;
  valid: boolean;
  clusterStatus: { [key: string]: ClusterStatus };
  hasReachableClusters: boolean;
  totalClusters: number;
  error?: string;
};

type ValidationAllResponse = {
  validationResults: { [configId: string]: ConfigValidationResult };
  totalConfigs: number;
};

type ValidationAllError = {
  error: string;
  details?: string;
};

type InitialState = {
  loading: boolean;
  validationResponse: ValidationAllResponse | null;
  error: ValidationAllError | null;
};

const initialState: InitialState = {
  loading: false,
  validationResponse: null,
  error: null,
};

const validateAllConfigs = createAsyncThunk('validateAllConfigs', (_, thunkAPI) => {
  const url = `${API_VERSION}${CONFIG_ENDPOINT}/${KUBECONFIGS_VALIDATE_ALL_URL}`;
  
  return kwFetch(url, {
    method: 'GET'
  }).then((res) => {
      return res;
    })
    .catch((e: Error) => thunkAPI.rejectWithValue(serializeError(e)));
});

const validateAllConfigsSlice = createSlice({
  name: 'validateAllConfigs',
  initialState,
  reducers: {
    resetValidateAllConfigs: () => {
      return initialState;
    }
  },
  extraReducers: (builder) => {
    builder.addCase(validateAllConfigs.pending, (state) => {
      state.loading = true;
      state.error = null;
    });
    builder.addCase(
      validateAllConfigs.fulfilled,
      (state, action: PayloadAction<ValidationAllResponse>) => {
        state.loading = false;
        state.validationResponse = action.payload;
        state.error = null;
      },
    );
    builder.addCase(validateAllConfigs.rejected, (state, action) => {
      state.loading = false;
      state.error = action.payload as ValidationAllError;
      state.validationResponse = null;
    });
  },
});

const { resetValidateAllConfigs } = validateAllConfigsSlice.actions;
export default validateAllConfigsSlice.reducer;
export { validateAllConfigs, resetValidateAllConfigs }; 