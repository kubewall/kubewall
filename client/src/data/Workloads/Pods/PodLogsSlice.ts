import { PodSocketResponse } from "@/types";
import { createSlice } from "@reduxjs/toolkit";

type InitialState = {
  logs: PodSocketResponse[];
  selectedContainer: string;
  isFollowingLogs: boolean;
};

const initialState: InitialState = {
  logs: [],
  selectedContainer: '',
  isFollowingLogs: false
};

const podLogsSlice = createSlice({
  name: 'podLogsSlice',
  initialState,
  reducers: {
    addLog: (state, action) => {
      state.logs.push(...action.payload);
    },
    clearLogs: () => {
      return initialState;
    },
    setSelectedContainer: (state, action) => {
      state.selectedContainer = action.payload;
    },
    setIsFollowingLogs: (state, action) => {
      state.isFollowingLogs = action.payload;
    },
  },
});

export default podLogsSlice.reducer;
const { addLog, clearLogs, setSelectedContainer, setIsFollowingLogs } = podLogsSlice.actions;
export { addLog, clearLogs, setSelectedContainer, setIsFollowingLogs };