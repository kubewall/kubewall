import { createSlice } from '@reduxjs/toolkit';

type ListTableRefreshState = {
  refreshNonce: number;
};

const initialState: ListTableRefreshState = {
  refreshNonce: 0,
};

const listTableRefreshSlice = createSlice({
  name: 'listTableRefresh',
  initialState,
  reducers: {
    bumpListRefresh: (state) => {
      // Increment nonce; wrap to avoid overflow in long sessions
      state.refreshNonce = (state.refreshNonce + 1) % Number.MAX_SAFE_INTEGER;
    },
    resetListRefresh: () => initialState,
  },
});

export const { bumpListRefresh, resetListRefresh } = listTableRefreshSlice.actions;
export default listTableRefreshSlice.reducer;


