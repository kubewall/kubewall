import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { API_VERSION } from '@/constants';
import kwFetch from '@/data/kwFetch';
import { RawRequestError } from '@/data/kwFetch';

interface ScalePVCRequest {
  config: string;
  cluster: string;
  namespace: string;
  name: string;
  size: string;
}

interface ScalePVCResponse {
  message: string;
  pvc: Record<string, unknown>;
}

interface ScalePVCState {
  loading: boolean;
  response: ScalePVCResponse | null;
  error: RawRequestError | null;
}

const initialState: ScalePVCState = {
  loading: false,
  response: null,
  error: null,
};

export const scalePVC = createAsyncThunk(
  'persistentVolumeClaimScale/scale',
  async (request: ScalePVCRequest, { rejectWithValue }) => {
    try {
      const queryParams = new URLSearchParams({
        config: request.config,
        cluster: request.cluster,
      }).toString();

      const url = `${API_VERSION}/persistentvolumeclaims/${request.namespace}/${request.name}/scale?${queryParams}`;
      
      const response = await kwFetch(url, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ size: request.size }),
      });

      return response as ScalePVCResponse;
    } catch (error) {
      return rejectWithValue(error as RawRequestError);
    }
  }
);

const persistentVolumeClaimScaleSlice = createSlice({
  name: 'persistentVolumeClaimScale',
  initialState,
  reducers: {
    resetScalePVC: () => initialState,
  },
  extraReducers: (builder) => {
    builder
      .addCase(scalePVC.pending, (state) => {
        state.loading = true;
        state.error = null;
        state.response = null;
      })
      .addCase(scalePVC.fulfilled, (state, action) => {
        state.loading = false;
        state.response = action.payload;
        state.error = null;
      })
      .addCase(scalePVC.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as RawRequestError;
        state.response = null;
      });
  },
});

export const { resetScalePVC } = persistentVolumeClaimScaleSlice.actions;
export default persistentVolumeClaimScaleSlice.reducer;
