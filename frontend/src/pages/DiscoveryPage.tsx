import React, { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { RootState, AppDispatch } from '../store';
import { MCPServer } from '@mcp-wizard/shared';
import {
  discoverMCPServers,
  analyzeRepository,
  getRateLimitStatus,
  setSelectedServer,
} from '../store/slices/researchSlice';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Loading } from '../components/ui/Loading';
import { ErrorMessage } from '../components/ui/ErrorMessage';

export const DiscoveryPage: React.FC = () => {
  const dispatch = useDispatch<AppDispatch>();
  const navigate = useNavigate();
  const { servers, isLoading, error, rateLimit } = useSelector(
    (state: RootState) => state.research,
  );
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    // Load initial data
    dispatch(getRateLimitStatus());
  }, [dispatch]);

  // Utility function to detect if input is a URL
  const isUrl = (str: string): boolean => {
    try {
      new URL(str);
      return true;
    } catch {
      return false;
    }
  };

  const handleSearch = () => {
    if (isUrl(searchQuery)) {
      // If it's a URL, analyze the specific repository
      dispatch(analyzeRepository(searchQuery));
    } else {
      // Otherwise, do a general search
      dispatch(discoverMCPServers({ query: searchQuery || 'MCP server', limit: 20 }));
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  const handleServerClick = async (server: MCPServer) => {
    // If this is a GitHub server, analyze it first to ensure it's saved to the database
    if (server.source === 'github' && server.sourceUrl) {
      try {
        await fetch('/api/research/analyze', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ url: server.sourceUrl }),
        });
      } catch (error) {
        console.warn('Failed to analyze server before configuration:', error);
        // Continue anyway - the config creation will handle missing servers
      }
    }

    dispatch(setSelectedServer(server));
    navigate('/wizard');
  };

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Discover MCP Servers</h1>
        <p className="text-gray-600 mb-8">
          Search and discover Model Context Protocol servers from GitHub and npm
        </p>
      </div>

      {/* Search Section */}
      <Card className="max-w-2xl mx-auto">
        <div className="space-y-4">
          <Input
            label="Search for MCP servers"
            placeholder="e.g., file system, git, database, or paste a GitHub URL..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyPress={handleKeyPress}
            helperText="Search by functionality, technology, server name, or paste a GitHub repository URL"
          />

          <div className="flex items-center justify-between">
            <Button onClick={handleSearch} loading={isLoading} disabled={isLoading}>
              {isLoading ? 'Searching...' : 'Search'}
            </Button>

            {rateLimit && (
              <div className="text-sm text-gray-500">
                GitHub API: {rateLimit.remaining} requests remaining
                {rateLimit.isLimited && <span className="text-red-500 ml-2">(Rate limited)</span>}
              </div>
            )}
          </div>
        </div>
      </Card>

      {/* Error Display */}
      {error && <ErrorMessage title="Search Error" message={error} onRetry={handleSearch} />}

      {/* Loading State */}
      {isLoading && (
        <div className="text-center py-12">
          <Loading size="lg" text="Searching for MCP servers..." />
        </div>
      )}

      {/* Results */}
      {!isLoading && servers.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-gray-900">
              Found {servers.length} MCP Servers
            </h2>
          </div>

          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {servers.map((server) => (
              <Card
                key={server.id}
                hover
                className="cursor-pointer"
                onClick={() => handleServerClick(server)}
              >
                <div className="space-y-3">
                  <div>
                    <h3 className="font-semibold text-gray-900 truncate">{server.name}</h3>
                    <p className="text-sm text-gray-600 line-clamp-2">{server.description}</p>
                  </div>

                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-500">⭐ {server.popularity}</span>
                    <span className="px-2 py-1 text-xs rounded-full bg-blue-100 text-blue-800">
                      {server.source}
                    </span>
                  </div>

                  {server.tags && server.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {server.tags.slice(0, 3).map((tag) => (
                        <span
                          key={tag}
                          className="px-2 py-1 text-xs rounded bg-gray-100 text-gray-600"
                        >
                          {tag}
                        </span>
                      ))}
                      {server.tags.length > 3 && (
                        <span className="px-2 py-1 text-xs rounded bg-gray-100 text-gray-600">
                          +{server.tags.length - 3} more
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Empty State */}
      {!isLoading && servers.length === 0 && !error && (
        <div className="text-center py-12">
          <div className="text-gray-400 mb-4">
            <svg
              className="mx-auto h-12 w-12"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">No MCP servers found</h3>
          <p className="text-gray-600 mb-6">
            Try searching for specific functionality like &quot;file system&quot;, &quot;git&quot;,
            or &quot;database&quot;
          </p>
          <Button onClick={handleSearch}>Search for Popular Servers</Button>
        </div>
      )}
    </div>
  );
};
