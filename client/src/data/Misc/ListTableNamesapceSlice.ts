import { createSlice } from '@reduxjs/toolkit';
import { resetAllStates } from '@/redux/hooks';

type InitialState = {
  selectedNamespace: string[];
};

const NAMESPACE_STORAGE_KEY = 'kubewall_selected_namespace';

// Get initial namespace from localStorage, fallback to 'default'
const getInitialNamespace = (): string[] => {
  try {
    const stored = localStorage.getItem(NAMESPACE_STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      return Array.isArray(parsed) ? parsed : [parsed];
    }
  } catch (error) {
    console.error('Error reading namespace from localStorage:', error);
  }
  // Default to 'default' namespace
  return ['default'];
};

const initialState: InitialState = {
  selectedNamespace: getInitialNamespace()
};

const listTableNamespaceSlice = createSlice({
  name: 'listTableNamespace',
  initialState,
  reducers: {
    updateFilterNamespace: (state, action) => {
      state.selectedNamespace = action.payload;
      // Persist to localStorage
      try {
        localStorage.setItem(NAMESPACE_STORAGE_KEY, JSON.stringify(action.payload));
      } catch (error) {
        console.error('Error saving namespace to localStorage:', error);
      }
    },
    resetFilterNamespace: () => {
      // Clear from localStorage when reset
      try {
        localStorage.removeItem(NAMESPACE_STORAGE_KEY);
      } catch (error) {
        console.error('Error removing namespace from localStorage:', error);
      }
      return { selectedNamespace: [] };
    }
  },
  extraReducers: (builder) => {
    builder.addCase(resetAllStates, () => initialState);
  },
});

export default listTableNamespaceSlice.reducer;
const { updateFilterNamespace, resetFilterNamespace } = listTableNamespaceSlice.actions;
export { initialState, updateFilterNamespace, resetFilterNamespace };