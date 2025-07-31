import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { PermissionError } from '@/components/app/Common/PermissionErrorBanner';

interface PermissionErrorsState {
  currentError: PermissionError | null;
  errorHistory: PermissionError[];
  isPermissionErrorVisible: boolean;
}

const initialState: PermissionErrorsState = {
  currentError: null,
  errorHistory: [],
  isPermissionErrorVisible: false,
};

const permissionErrorsSlice = createSlice({
  name: 'permissionErrors',
  initialState,
  reducers: {
    setPermissionError: (state, action: PayloadAction<PermissionError>) => {
      state.currentError = action.payload;
      state.isPermissionErrorVisible = true;
      
      // Add to history if not already present
      const errorExists = state.errorHistory.some(
        error => 
          error.resource === action.payload.resource && 
          error.verb === action.payload.verb &&
          error.apiGroup === action.payload.apiGroup
      );
      
      if (!errorExists) {
        state.errorHistory.push(action.payload);
      }
    },
    clearPermissionError: (state) => {
      state.currentError = null;
      state.isPermissionErrorVisible = false;
    },
    hidePermissionError: (state) => {
      state.isPermissionErrorVisible = false;
    },
    clearErrorHistory: (state) => {
      state.errorHistory = [];
    },
    removeFromErrorHistory: (state, action: PayloadAction<{ resource: string; verb: string; apiGroup?: string }>) => {
      state.errorHistory = state.errorHistory.filter(
        error => 
          !(error.resource === action.payload.resource && 
            error.verb === action.payload.verb &&
            error.apiGroup === action.payload.apiGroup)
      );
    },
  },
});

export const {
  setPermissionError,
  clearPermissionError,
  hidePermissionError,
  clearErrorHistory,
  removeFromErrorHistory,
} = permissionErrorsSlice.actions;

export default permissionErrorsSlice.reducer; 