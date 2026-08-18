import { createSlice } from '@reduxjs/toolkit';
import { resetAllStates } from '@/redux/hooks';

const SEARCH_STORAGE_KEY = 'kw.listTableSearch';

// The store is torn down by a reload and by anything that remounts the list
// route, which is why what you typed used to vanish on refresh and on the way
// back from a details page. sessionStorage keeps it for the life of the tab -
// long enough to survive both - without leaking an old search into a new one.
const readSearchString = () => {
  try {
    return sessionStorage.getItem(SEARCH_STORAGE_KEY) ?? '';
  } catch {
    return '';
  }
};

const writeSearchString = (searchString: string) => {
  try {
    if (searchString) {
      sessionStorage.setItem(SEARCH_STORAGE_KEY, searchString);
    } else {
      sessionStorage.removeItem(SEARCH_STORAGE_KEY);
    }
  } catch {
    // Storage being unavailable (private mode, quota) only costs us the
    // remembered search, so there is nothing useful to do here.
  }
};

type InitialState = {
  searchString: string
};

const initialState: InitialState = {
  searchString: ''
};

const listTableFilterSlice = createSlice({
  name: 'listTableFilter',
  initialState: { ...initialState, searchString: readSearchString() },
  reducers: {
    updateListTableFilter: (state, action) => {
      state.searchString = action.payload;
      writeSearchString(action.payload);
    },
    resetListTableFilter: () => {
      writeSearchString('');
      return initialState;
    }
  },
  extraReducers: (builder) => {
    builder.addCase(resetAllStates, () => {
      writeSearchString('');
      return initialState;
    });
  },
});

export default listTableFilterSlice.reducer;
const { updateListTableFilter, resetListTableFilter } = listTableFilterSlice.actions;
export { initialState, updateListTableFilter, resetListTableFilter };
