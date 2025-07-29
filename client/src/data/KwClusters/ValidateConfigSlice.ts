import { API_VERSION, CONFIG_ENDPOINT, KUBECONFIGS_VALIDATE_URL } from "@/constants";
import { PayloadAction, createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import kwFetch from "../kwFetch";
import { serializeError } from "serialize-error";

type ClusterStatus = {
  name: string;
  cluster: string;
  reachable: boolean;
  error?: string;
};

type ValidationResponse = {
  valid: boolean;
  filename: string;
  clusterStatus: { [key: string]: ClusterStatus };
  hasReachableClusters: boolean;
  totalClusters: number;
};

type ValidationError = {
  error: string;
  details?: string;
};

type InitialState = {
  loading: boolean;
  validationResponse: ValidationResponse | null;
  error: ValidationError | null;
};

const initialState: InitialState = {
  loading: false,
  validationResponse: null,
  error: null,
};

type ValidateConfigProps = {
  formData: FormData;
};

const validateConfig = createAsyncThunk('validateConfig', ({ formData }: ValidateConfigProps, thunkAPI) => {
  const url = `${API_VERSION}${CONFIG_ENDPOINT}/${KUBECONFIGS_VALIDATE_URL}`;
  
  return kwFetch(url, {
    body: formData,
    method: 'POST'
  }).then((res) => {
      return res;
    })
    .catch((e: Error) => thunkAPI.rejectWithValue(serializeError(e)));
});

const validateConfigSlice = createSlice({
  name: 'validateConfig',
  initialState,
  reducers: {
    resetValidateConfig: () => {
      return initialState;
    }
  },
  extraReducers: (builder) => {
    builder.addCase(validateConfig.pending, (state) => {
      state.loading = true;
      state.error = null;
    });
    builder.addCase(
      validateConfig.fulfilled,
      (state, action: PayloadAction<ValidationResponse>) => {
        state.loading = false;
        state.validationResponse = action.payload;
        state.error = null;
      },
    );
    builder.addCase(validateConfig.rejected, (state, action) => {
      state.loading = false;
      state.error = action.payload as ValidationError;
      state.validationResponse = null;
    });
  },
});

const { resetValidateConfig } = validateConfigSlice.actions;
export default validateConfigSlice.reducer;
export { validateConfig, resetValidateConfig }; 