import axios, { AxiosInstance } from 'axios';
import { config } from '../../config';
import { logger } from '../../utils/logger';

// GitHub API response types
export interface GitHubRepo {
  id: number;
  name: string;
  full_name: string;
  description: string | null;
  html_url: string;
  clone_url: string;
  language: string | null;
  stargazers_count: number;
  forks_count: number;
  updated_at: string;
  created_at: string;
  owner: {
    login: string;
    id: number;
    avatar_url: string;
  };
  topics: string[];
  license?: {
    name: string;
    key: string;
  } | null;
}

export interface GitHubSearchResponse {
  total_count: number;
  incomplete_results: boolean;
  items: GitHubRepo[];
}

export interface GitHubFile {
  name: string;
  path: string;
  sha: string;
  size: number;
  url: string;
  html_url: string;
  git_url: string;
  download_url: string;
  type: 'file' | 'dir';
  _links: {
    self: string;
    git: string;
    html: string;
  };
}

export class GitHubAPIClient {
  private client: AxiosInstance;
  private rateLimitRemaining: number = 5000; // GitHub allows 5000 requests per hour for authenticated users
  private rateLimitReset: number = 0;

  constructor() {
    this.client = axios.create({
      baseURL: 'https://api.github.com',
      timeout: 10000,
      headers: {
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'MCP-Wizard/1.0.0',
      },
    });

    // Add authentication if token is available
    if (config.githubToken) {
      this.client.defaults.headers.common['Authorization'] = `token ${config.githubToken}`;
    }

    // Add response interceptor to handle rate limits
    this.client.interceptors.response.use(
      (response) => {
        // Update rate limit info
        const remaining = response.headers['x-ratelimit-remaining'];
        const reset = response.headers['x-ratelimit-reset'];

        if (remaining) {
          this.rateLimitRemaining = parseInt(remaining, 10);
        }
        if (reset) {
          this.rateLimitReset = parseInt(reset, 10);
        }

        return response;
      },
      (error) => {
        if (error.response?.status === 403 && error.response?.headers['x-ratelimit-remaining'] === '0') {
          logger.warn('GitHub API rate limit exceeded');
          throw new Error('GitHub API rate limit exceeded. Please try again later or provide a GitHub token.');
        }
        throw error;
      }
    );
  }

  /**
   * Search for repositories containing MCP-related keywords
   */
  async searchRepositories(
    query: string,
    options: {
      sort?: 'stars' | 'forks' | 'updated';
      order?: 'asc' | 'desc';
      per_page?: number;
      page?: number;
    } = {}
  ): Promise<GitHubSearchResponse> {
    try {
      const params = new URLSearchParams({
        q: `${query} MCP OR "Model Context Protocol"`,
        sort: options.sort || 'stars',
        order: options.order || 'desc',
        per_page: (options.per_page || 30).toString(),
        page: (options.page || 1).toString(),
      });

      logger.debug(`Searching GitHub for: ${query}`);

      const response = await this.client.get<GitHubSearchResponse>(
        `/search/repositories?${params}`
      );

      logger.info(`Found ${response.data.total_count} repositories for query: ${query}`);

      return response.data;
    } catch (error) {
      logger.error('Error searching GitHub repositories:', error);
      throw new Error(`Failed to search GitHub repositories: ${error}`);
    }
  }

  /**
   * Get detailed information about a specific repository
   */
  async getRepository(owner: string, repo: string): Promise<GitHubRepo> {
    try {
      logger.debug(`Fetching repository: ${owner}/${repo}`);

      const response = await this.client.get<GitHubRepo>(`/repos/${owner}/${repo}`);

      return response.data;
    } catch (error) {
      logger.error(`Error fetching repository ${owner}/${repo}:`, error);
      throw new Error(`Failed to fetch repository ${owner}/${repo}`);
    }
  }

  /**
   * Get the contents of a repository directory or file
   */
  async getRepositoryContents(
    owner: string,
    repo: string,
    path: string = ''
  ): Promise<GitHubFile[]> {
    try {
      logger.debug(`Fetching contents: ${owner}/${repo}/${path}`);

      const response = await this.client.get<GitHubFile[]>(
        `/repos/${owner}/${repo}/contents/${path}`
      );

      return response.data;
    } catch (error) {
      logger.error(`Error fetching contents ${owner}/${repo}/${path}:`, error);
      throw new Error(`Failed to fetch repository contents: ${owner}/${repo}/${path}`);
    }
  }

  /**
   * Download a file from a repository
   */
  async downloadFile(owner: string, repo: string, path: string): Promise<string> {
    try {
      logger.debug(`Downloading file: ${owner}/${repo}/${path}`);

      const response = await this.client.get(
        `https://raw.githubusercontent.com/${owner}/${repo}/main/${path}`
      );

      return response.data;
    } catch (error) {
      // Try with 'master' branch if 'main' fails
      try {
        const response = await this.client.get(
          `https://raw.githubusercontent.com/${owner}/${repo}/master/${path}`
        );
        return response.data;
      } catch (fallbackError) {
        logger.error(`Error downloading file ${owner}/${repo}/${path}:`, error);
        throw new Error(`Failed to download file: ${owner}/${repo}/${path}`);
      }
    }
  }

  /**
   * Get rate limit status
   */
  getRateLimitStatus() {
    return {
      remaining: this.rateLimitRemaining,
      reset: new Date(this.rateLimitReset * 1000),
      isLimited: this.rateLimitRemaining <= 0,
    };
  }

  /**
   * Check if we can make API calls
   */
  canMakeRequest(): boolean {
    return this.rateLimitRemaining > 0;
  }
}

// Export singleton instance
export const githubClient = new GitHubAPIClient();