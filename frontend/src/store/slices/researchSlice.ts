import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { MCPServer } from '@mcp-wizard/shared';

export interface ResearchState {
  servers: MCPServer[];
  searchQuery: string;
  isLoading: boolean;
  error: string | null;
  totalCount: number;
  currentPage: number;
  hasMore: boolean;
  selectedServer: MCPServer | null;
  serverDetails: Record<string, MCPServer>;
  rateLimit: {
    remaining: number;
    reset: Date | null;
    isLimited: boolean;
  } | null;
}

const initialState: ResearchState = {
  servers: [],
  searchQuery: '',
  isLoading: false,
  error: null,
  totalCount: 0,
  currentPage: 1,
  hasMore: false,
  selectedServer: null,
  serverDetails: {},
  rateLimit: null,
};

// Async thunks for API calls
export const discoverMCPServers = createAsyncThunk(
  'research/discoverMCPServers',
  async ({ query, limit }: { query?: string; limit?: number }, { rejectWithValue }) => {
    try {
      const response = await fetch('/api/research/discover', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query: query || 'MCP server',
          limit: limit || 30,
        }),
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to start discovery');
      }

      // Wait for completion (in a real app, you'd poll or use websockets)
      const jobId = data.jobId;
      let attempts = 0;
      const maxAttempts = 30; // 30 seconds max

      while (attempts < maxAttempts) {
        await new Promise((resolve) => setTimeout(resolve, 1000));

        const statusResponse = await fetch(`/api/research/status/${jobId}`);
        const statusData = await statusResponse.json();

        if (statusData.status === 'completed') {
          return {
            servers: statusData.results,
            totalCount: statusData.resultCount,
            query: query || '',
          };
        }

        if (statusData.status === 'failed') {
          throw new Error(statusData.error || 'Discovery failed');
        }

        attempts++;
      }

      throw new Error('Discovery timed out');
    } catch (error) {
      return rejectWithValue(error instanceof Error ? error.message : 'Unknown error');
    }
  },
);

export const getMCPServerDetails = createAsyncThunk(
  'research/getMCPServerDetails',
  async (serverId: string, { rejectWithValue }) => {
    try {
      const response = await fetch(`/api/catalog/servers/${serverId}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to fetch server details');
      }

      return data.server as MCPServer;
    } catch (error) {
      return rejectWithValue(error instanceof Error ? error.message : 'Unknown error');
    }
  },
);

export const analyzeRepository = createAsyncThunk(
  'research/analyzeRepository',
  async (url: string, { rejectWithValue }) => {
    try {
      const response = await fetch('/api/research/analyze', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ url }),
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to analyze repository');
      }

      return {
        server: data.server,
        analyzed: data.analyzed,
      };
    } catch (error) {
      return rejectWithValue(error instanceof Error ? error.message : 'Unknown error');
    }
  },
);

export const getRateLimitStatus = createAsyncThunk(
  'research/getRateLimitStatus',
  async (_, { rejectWithValue }) => {
    try {
      const response = await fetch('/api/research/status');
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to get rate limit status');
      }

      return data.apis;
    } catch (error) {
      return rejectWithValue(error instanceof Error ? error.message : 'Unknown error');
    }
  },
);

export const researchSlice = createSlice({
  name: 'research',
  initialState,
  reducers: {
    setSearchQuery: (state, action: PayloadAction<string>) => {
      state.searchQuery = action.payload;
    },
    clearSearchResults: (state) => {
      state.servers = [];
      state.totalCount = 0;
      state.currentPage = 1;
      state.hasMore = false;
      state.error = null;
    },
    setSelectedServer: (state, action: PayloadAction<MCPServer | null>) => {
      state.selectedServer = action.payload;
    },
    clearError: (state) => {
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      // Discover MCP servers
      .addCase(discoverMCPServers.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(discoverMCPServers.fulfilled, (state, action) => {
        state.isLoading = false;
        state.servers = action.payload.servers;
        state.totalCount = action.payload.totalCount;
        state.searchQuery = action.payload.query;
        state.error = null;
      })
      .addCase(discoverMCPServers.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      })
      // Get server details
      .addCase(getMCPServerDetails.pending, (state) => {
        state.isLoading = true;
      })
      .addCase(getMCPServerDetails.fulfilled, (state, action) => {
        state.isLoading = false;
        state.selectedServer = action.payload;
        state.serverDetails[action.payload.id] = action.payload;
      })
      .addCase(getMCPServerDetails.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      })
      // Analyze repository
      .addCase(analyzeRepository.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(analyzeRepository.fulfilled, (state, action) => {
        state.isLoading = false;
        if (action.payload.server) {
          state.servers = [action.payload.server];
          state.totalCount = 1;
          state.error = null;
        } else {
          state.servers = [];
          state.totalCount = 0;
          state.error =
            'Repository could not be analyzed. It may not exist or may not be a valid MCP server.';
        }
      })
      .addCase(analyzeRepository.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      })
      // Get rate limit status
      .addCase(getRateLimitStatus.fulfilled, (state, action) => {
        state.rateLimit = {
          remaining: action.payload.github.rateLimit.remaining,
          reset: new Date(action.payload.github.rateLimit.reset * 1000),
          isLimited: action.payload.github.rateLimit.isLimited,
        };
      });
  },
});

export const { setSearchQuery, clearSearchResults, setSelectedServer, clearError } =
  researchSlice.actions;

export default researchSlice.reducer;
