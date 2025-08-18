import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import kwFetch from '@/data/kwFetch';
import { API_VERSION } from '@/constants';
import { RawRequestError } from '@/data/kwFetch';
import { resetAllStates } from '@/redux/hooks';

// Helper function to serialize errors
const serializeError = (error: Error): RawRequestError => {
  return {
    message: error.message || 'An error occurred',
    code: 500,
    details: error.stack || '',
  };
};

// Types
export interface NodeActionRequest {
  force?: boolean;
  ignoreDaemonSets?: boolean;
  deleteEmptyDirData?: boolean;
  gracePeriod?: number;
}

export interface NodeActionResponse {
  message: string;
  evictedPods?: string[];
  failedPods?: string[];
  totalPods?: number;
  evictedCount?: number;
  failedCount?: number;
}

export interface NodeActionPermissionResponse {
  allowed: boolean;
  action: string;
  nodeName: string;
  permissions: Record<string, boolean>;
  podPermissions?: Record<string, boolean>;
}

interface NodeActionsState {
  loading: boolean;
  error: RawRequestError | null;
  response: NodeActionResponse | null;
  permissions: Record<string, NodeActionPermissionResponse>;
  checkingPermissions: boolean;
}

const initialState: NodeActionsState = {
  loading: false,
  error: null,
  response: null,
  permissions: {},
  checkingPermissions: false,
};

// Async thunks
export const cordonNode = createAsyncThunk(
  'nodeActions/cordonNode',
  async ({ nodeName, queryParams }: { nodeName: string; queryParams: string }, thunkAPI) => {
    const url = `${API_VERSION}/nodes/${nodeName}/cordon?${queryParams}`;
    return kwFetch(url, { method: 'POST' })
      .then((res: any) => res)
      .catch((e: Error) => thunkAPI.rejectWithValue(serializeError(e)));
  }
);

export const uncordonNode = createAsyncThunk(
  'nodeActions/uncordonNode',
  async ({ nodeName, queryParams }: { nodeName: string; queryParams: string }, thunkAPI) => {
    const url = `${API_VERSION}/nodes/${nodeName}/uncordon?${queryParams}`;
    return kwFetch(url, { method: 'POST' })
      .then((res: any) => res)
      .catch((e: Error) => thunkAPI.rejectWithValue(serializeError(e)));
  }
);

export const drainNode = createAsyncThunk(
  'nodeActions/drainNode',
  async ({ 
    nodeName, 
    queryParams, 
    options 
  }: { 
    nodeName: string; 
    queryParams: string; 
    options: NodeActionRequest;
  }, thunkAPI) => {
    const url = `${API_VERSION}/nodes/${nodeName}/drain?${queryParams}`;
    return kwFetch(url, { 
      method: 'POST',
      body: JSON.stringify(options),
      headers: {
        'Content-Type': 'application/json',
      },
    })
      .then((res: any) => res)
      .catch((e: Error) => thunkAPI.rejectWithValue(serializeError(e)));
  }
);

export const checkNodeActionPermission = createAsyncThunk(
  'nodeActions/checkNodeActionPermission',
  async ({ 
    action, 
    nodeName, 
    queryParams 
  }: { 
    action: string; 
    nodeName: string; 
    queryParams: string;
  }, thunkAPI) => {
    const url = `${API_VERSION}/nodes/actions/permissions?action=${action}&nodeName=${nodeName}&${queryParams}`;
    return kwFetch(url, { method: 'GET' })
      .then((res: any) => res)
      .catch((e: Error) => thunkAPI.rejectWithValue(serializeError(e)));
  }
);

// Slice
const nodeActionsSlice = createSlice({
  name: 'nodeActions',
  initialState,
  reducers: {
    resetNodeActions: (state) => {
      state.loading = false;
      state.error = null;
      state.response = null;
    },
    clearPermissions: (state) => {
      state.permissions = {};
    },
  },
  extraReducers: (builder) => {
    // Cordon Node
    builder.addCase(cordonNode.pending, (state) => {
      state.loading = true;
      state.error = null;
      state.response = null;
    });
    builder.addCase(cordonNode.fulfilled, (state, action) => {
      state.loading = false;
      state.response = action.payload as NodeActionResponse;
      state.error = null;
    });
    builder.addCase(cordonNode.rejected, (state, action) => {
      state.loading = false;
      state.error = action.payload as RawRequestError;
      state.response = null;
    });

    // Uncordon Node
    builder.addCase(uncordonNode.pending, (state) => {
      state.loading = true;
      state.error = null;
      state.response = null;
    });
    builder.addCase(uncordonNode.fulfilled, (state, action) => {
      state.loading = false;
      state.response = action.payload as NodeActionResponse;
      state.error = null;
    });
    builder.addCase(uncordonNode.rejected, (state, action) => {
      state.loading = false;
      state.error = action.payload as RawRequestError;
      state.response = null;
    });

    // Drain Node
    builder.addCase(drainNode.pending, (state) => {
      state.loading = true;
      state.error = null;
      state.response = null;
    });
    builder.addCase(drainNode.fulfilled, (state, action) => {
      state.loading = false;
      state.response = action.payload as NodeActionResponse;
      state.error = null;
    });
    builder.addCase(drainNode.rejected, (state, action) => {
      state.loading = false;
      state.error = action.payload as RawRequestError;
      state.response = null;
    });

    // Check Permission
    builder.addCase(checkNodeActionPermission.pending, (state) => {
      state.checkingPermissions = true;
    });
    builder.addCase(checkNodeActionPermission.fulfilled, (state, action) => {
      state.checkingPermissions = false;
      const response = action.payload as NodeActionPermissionResponse;
      const key = `${response.action}-${response.nodeName}`;
      state.permissions[key] = response;
    });
    builder.addCase(checkNodeActionPermission.rejected, (state) => {
      state.checkingPermissions = false;
    });

    // Reset all states
    builder.addCase(resetAllStates, () => initialState);
  },
});

export const { resetNodeActions, clearPermissions } = nodeActionsSlice.actions;
export default nodeActionsSlice.reducer;
