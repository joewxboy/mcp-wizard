import { createSlice, PayloadAction } from '@reduxjs/toolkit';

export interface UiState {
  loading: {
    global: boolean;
    operations: Record<string, boolean>;
  };
  modals: {
    [key: string]: boolean;
  };
  notifications: Array<{
    id: string;
    type: 'success' | 'error' | 'warning' | 'info';
    title: string;
    message?: string;
    duration?: number;
  }>;
  sidebar: {
    open: boolean;
  };
}

const initialState: UiState = {
  loading: {
    global: false,
    operations: {},
  },
  modals: {},
  notifications: [],
  sidebar: {
    open: false,
  },
};

export const uiSlice = createSlice({
  name: 'ui',
  initialState,
  reducers: {
    setGlobalLoading: (state, action: PayloadAction<boolean>) => {
      state.loading.global = action.payload;
    },
    setOperationLoading: (state, action: PayloadAction<{ key: string; loading: boolean }>) => {
      const { key, loading } = action.payload;
      state.loading.operations[key] = loading;
    },
    clearOperationLoading: (state, action: PayloadAction<string>) => {
      delete state.loading.operations[action.payload];
    },
    openModal: (state, action: PayloadAction<string>) => {
      state.modals[action.payload] = true;
    },
    closeModal: (state, action: PayloadAction<string>) => {
      state.modals[action.payload] = false;
    },
    toggleModal: (state, action: PayloadAction<string>) => {
      state.modals[action.payload] = !state.modals[action.payload];
    },
    addNotification: (state, action: PayloadAction<Omit<UiState['notifications'][0], 'id'>>) => {
      const notification = {
        ...action.payload,
        id: `notification-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      };
      state.notifications.push(notification);
    },
    removeNotification: (state, action: PayloadAction<string>) => {
      state.notifications = state.notifications.filter(n => n.id !== action.payload);
    },
    clearNotifications: (state) => {
      state.notifications = [];
    },
    toggleSidebar: (state) => {
      state.sidebar.open = !state.sidebar.open;
    },
    setSidebarOpen: (state, action: PayloadAction<boolean>) => {
      state.sidebar.open = action.payload;
    },
  },
});

export const {
  setGlobalLoading,
  setOperationLoading,
  clearOperationLoading,
  openModal,
  closeModal,
  toggleModal,
  addNotification,
  removeNotification,
  clearNotifications,
  toggleSidebar,
  setSidebarOpen,
} = uiSlice.actions;

export default uiSlice.reducer;