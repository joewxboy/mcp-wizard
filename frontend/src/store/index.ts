import { configureStore } from '@reduxjs/toolkit';
import { researchSlice } from './slices/researchSlice';
import { configSlice } from './slices/configSlice';
import { uiSlice } from './slices/uiSlice';

export const store = configureStore({
  reducer: {
    research: researchSlice.reducer,
    config: configSlice.reducer,
    ui: uiSlice.reducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        ignoredActions: ['persist/PERSIST', 'persist/REHYDRATE'],
      },
    }),
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;