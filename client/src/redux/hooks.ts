import type { AppDispatch, RootState } from './store';
import { TypedUseSelectorHook, useDispatch, useSelector } from 'react-redux';

import { createAction } from '@reduxjs/toolkit';

// Use throughout your app instead of plain `useDispatch` and `useSelector`
export const useAppDispatch = () => useDispatch<AppDispatch>();
export const useAppSelector: TypedUseSelectorHook<RootState> = useSelector;

export const resetAllStates = createAction('REVERT_ALL');

// Dispatched by KwList whenever the viewed resourcekind changes, so list
// slices (pods, deployments, ...) don't all stay resident in the store for
// the rest of the session just because the user browsed past them once.
export const resetListSlices = createAction('RESET_LIST_SLICES');

