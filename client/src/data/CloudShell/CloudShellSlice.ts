import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import kwFetch from '../kwFetch';
import { CloudShellSession, CloudShellCreateRequest, CloudShellCreateResponse, CloudShellListResponse, CloudShellDeleteResponse } from '@/types/cloudshell';

interface CloudShellState {
  sessions: CloudShellSession[];
  currentSession: CloudShellSession | null;
  loading: boolean;
  error: string | null;
  lastUpdated: number | null;
}

const initialState: CloudShellState = {
  sessions: [],
  currentSession: null,
  loading: false,
  error: null,
  lastUpdated: null,
};

// Async thunks
export const createCloudShell = createAsyncThunk(
  'cloudShell/createCloudShell',
  async (request: CloudShellCreateRequest): Promise<CloudShellCreateResponse> => {
    const queryParams = new URLSearchParams({
      config: request.config,
      cluster: request.cluster,
      ...(request.namespace && { namespace: request.namespace }),
    });

    try {
      const response = await kwFetch(`/api/v1/cloudshell?${queryParams}`, {
        method: 'POST',
      });

      // Handle the response properly
      if (response && typeof response === 'object' && 'session' in response) {
        return response as CloudShellCreateResponse;
      } else {
        throw new Error('Invalid response format from server');
      }
    } catch (error) {
      console.error('Cloud shell creation error:', error);
      if (error instanceof Error) {
        throw new Error(`Failed to create cloud shell: ${error.message}`);
      } else {
        throw new Error('Failed to create cloud shell: Unknown error');
      }
    }
  }
);

export const listCloudShellSessions = createAsyncThunk(
  'cloudShell/listCloudShellSessions',
  async (params: { config: string; cluster: string; namespace?: string }): Promise<CloudShellListResponse> => {
    const queryParams = new URLSearchParams({
      config: params.config,
      cluster: params.cluster,
      ...(params.namespace && { namespace: params.namespace }),
    });

    try {
      const response = await kwFetch(`/api/v1/cloudshell?${queryParams}`);
      
      // Handle the response properly
      if (response && typeof response === 'object' && 'sessions' in response) {
        return response as CloudShellListResponse;
      } else {
        throw new Error('Invalid response format from server');
      }
    } catch (error) {
      console.error('List cloud shell sessions error:', error);
      if (error instanceof Error) {
        throw new Error(`Failed to list cloud shell sessions: ${error.message}`);
      } else {
        throw new Error('Failed to list cloud shell sessions: Unknown error');
      }
    }
  }
);

export const deleteCloudShell = createAsyncThunk(
  'cloudShell/deleteCloudShell',
  async (params: { name: string; config: string; cluster: string; namespace?: string }): Promise<CloudShellDeleteResponse> => {
    const queryParams = new URLSearchParams({
      config: params.config,
      cluster: params.cluster,
      ...(params.namespace && { namespace: params.namespace }),
    });

    const response = await kwFetch(`/api/v1/cloudshell/${params.name}?${queryParams}`, {
      method: 'DELETE',
    });

    if (!response.ok) {
      throw new Error(`Failed to delete cloud shell: ${response.statusText}`);
    }

    return await response.json();
  }
);

// Slice
const cloudShellSlice = createSlice({
  name: 'cloudShell',
  initialState,
  reducers: {
    setCurrentSession: (state, action: PayloadAction<CloudShellSession | null>) => {
      state.currentSession = action.payload;
    },
    clearError: (state) => {
      state.error = null;
    },
    updateSessionStatus: (state, action: PayloadAction<{ id: string; status: CloudShellSession['status'] }>) => {
      const session = state.sessions.find(s => s.id === action.payload.id);
      if (session) {
        session.status = action.payload.status;
      }
      if (state.currentSession?.id === action.payload.id) {
        state.currentSession.status = action.payload.status;
      }
    },
  },
  extraReducers: (builder) => {
    builder
      // Create Cloud Shell
      .addCase(createCloudShell.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(createCloudShell.fulfilled, (state, action) => {
        state.loading = false;
        state.currentSession = action.payload.session;
        state.sessions.push(action.payload.session);
        state.lastUpdated = Date.now();
      })
      .addCase(createCloudShell.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || 'Failed to create cloud shell';
      })
      // List Cloud Shell Sessions
      .addCase(listCloudShellSessions.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(listCloudShellSessions.fulfilled, (state, action) => {
        state.loading = false;
        state.sessions = action.payload.sessions;
        state.lastUpdated = Date.now();
      })
      .addCase(listCloudShellSessions.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || 'Failed to list cloud shell sessions';
      })
      // Delete Cloud Shell
      .addCase(deleteCloudShell.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(deleteCloudShell.fulfilled, (state, action) => {
        state.loading = false;
        // Remove the deleted session from the list
        state.sessions = state.sessions.filter(s => s.id !== action.meta.arg.name);
        if (state.currentSession?.id === action.meta.arg.name) {
          state.currentSession = null;
        }
        state.lastUpdated = Date.now();
      })
      .addCase(deleteCloudShell.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || 'Failed to delete cloud shell';
      });
  },
});

export const { setCurrentSession, clearError, updateSessionStatus } = cloudShellSlice.actions;
export default cloudShellSlice.reducer; 