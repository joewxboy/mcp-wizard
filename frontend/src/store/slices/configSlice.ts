import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { UserConfig } from '@mcp-wizard/shared';

export interface ConfigState {
  configs: UserConfig[];
  selectedConfig: UserConfig | null;
  isLoading: boolean;
  error: string | null;
  exportFormats: Array<{
    value: string;
    label: string;
    description: string;
  }>;
}

const initialState: ConfigState = {
  configs: [],
  selectedConfig: null,
  isLoading: false,
  error: null,
  exportFormats: [],
};

// Async thunks for configuration operations
export const fetchUserConfigs = createAsyncThunk(
  'config/fetchUserConfigs',
  async (_, { rejectWithValue }) => {
    try {
      const response = await fetch('/api/configs');
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to fetch configurations');
      }

      return data.configs as UserConfig[];
    } catch (error) {
      return rejectWithValue(error instanceof Error ? error.message : 'Unknown error');
    }
  }
);

export const createConfig = createAsyncThunk(
  'config/createConfig',
  async (configData: any, { rejectWithValue }) => {
    try {
      const response = await fetch('/api/configs', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(configData),
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to create configuration');
      }

      return data.config as UserConfig;
    } catch (error) {
      return rejectWithValue(error instanceof Error ? error.message : 'Unknown error');
    }
  }
);

export const updateConfig = createAsyncThunk(
  'config/updateConfig',
  async ({ id, updates }: { id: string; updates: any }, { rejectWithValue }) => {
    try {
      const response = await fetch(`/api/configs/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updates),
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to update configuration');
      }

      return data.config as UserConfig;
    } catch (error) {
      return rejectWithValue(error instanceof Error ? error.message : 'Unknown error');
    }
  }
);

export const deleteConfig = createAsyncThunk(
  'config/deleteConfig',
  async (id: string, { rejectWithValue }) => {
    try {
      const response = await fetch(`/api/configs/${id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || 'Failed to delete configuration');
      }

      return id;
    } catch (error) {
      return rejectWithValue(error instanceof Error ? error.message : 'Unknown error');
    }
  }
);

export const validateConfig = createAsyncThunk(
  'config/validateConfig',
  async (id: string, { rejectWithValue }) => {
    try {
      const response = await fetch(`/api/configs/${id}/validate`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to validate configuration');
      }

      return {
        configId: id,
        valid: data.valid,
        errors: data.errors,
      };
    } catch (error) {
      return rejectWithValue(error instanceof Error ? error.message : 'Unknown error');
    }
  }
);

export const exportConfig = createAsyncThunk(
  'config/exportConfig',
  async ({ id, format, template }: { id: string; format: string; template?: string }, { rejectWithValue }) => {
    try {
      const params = new URLSearchParams({ format });
      if (template) params.append('template', template);

      const response = await fetch(`/api/configs/${id}/export?${params}`);

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || 'Failed to export configuration');
      }

      const blob = await response.blob();
      const filename = response.headers.get('content-disposition')?.split('filename=')[1]?.replace(/"/g, '') ||
                      `config-${format}`;

      return {
        blob,
        filename,
        contentType: response.headers.get('content-type') || 'application/octet-stream',
      };
    } catch (error) {
      return rejectWithValue(error instanceof Error ? error.message : 'Unknown error');
    }
  }
);

export const fetchExportFormats = createAsyncThunk(
  'config/fetchExportFormats',
  async (_, { rejectWithValue }) => {
    try {
      const response = await fetch('/api/configs/export/formats');
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to fetch export formats');
      }

      return data.formats;
    } catch (error) {
      return rejectWithValue(error instanceof Error ? error.message : 'Unknown error');
    }
  }
);

export const configSlice = createSlice({
  name: 'config',
  initialState,
  reducers: {
    setSelectedConfig: (state, action: PayloadAction<UserConfig | null>) => {
      state.selectedConfig = action.payload;
    },
    clearError: (state) => {
      state.error = null;
    },
    updateConfigInList: (state, action: PayloadAction<UserConfig>) => {
      const index = state.configs.findIndex(c => c.id === action.payload.id);
      if (index !== -1) {
        state.configs[index] = action.payload;
      }
    },
  },
  extraReducers: (builder) => {
    builder
      // Fetch user configs
      .addCase(fetchUserConfigs.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(fetchUserConfigs.fulfilled, (state, action) => {
        state.isLoading = false;
        state.configs = action.payload;
        state.error = null;
      })
      .addCase(fetchUserConfigs.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      })
      // Create config
      .addCase(createConfig.pending, (state) => {
        state.isLoading = true;
      })
      .addCase(createConfig.fulfilled, (state, action) => {
        state.isLoading = false;
        state.configs.unshift(action.payload);
        state.error = null;
      })
      .addCase(createConfig.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      })
      // Update config
      .addCase(updateConfig.pending, (state) => {
        state.isLoading = true;
      })
      .addCase(updateConfig.fulfilled, (state, action) => {
        state.isLoading = false;
        const index = state.configs.findIndex(c => c.id === action.payload.id);
        if (index !== -1) {
          state.configs[index] = action.payload;
        }
        if (state.selectedConfig?.id === action.payload.id) {
          state.selectedConfig = action.payload;
        }
        state.error = null;
      })
      .addCase(updateConfig.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      })
      // Delete config
      .addCase(deleteConfig.fulfilled, (state, action) => {
        state.configs = state.configs.filter(c => c.id !== action.payload);
        if (state.selectedConfig?.id === action.payload) {
          state.selectedConfig = null;
        }
      })
      // Fetch export formats
      .addCase(fetchExportFormats.fulfilled, (state, action) => {
        state.exportFormats = action.payload;
      });
  },
});

export const {
  setSelectedConfig,
  clearError,
  updateConfigInList,
} = configSlice.actions;

export default configSlice.reducer;