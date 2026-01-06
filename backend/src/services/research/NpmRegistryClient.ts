import axios, { AxiosInstance } from 'axios';
import { logger } from '../../utils/logger';

// npm Registry API response types
export interface NpmPackageInfo {
  name: string;
  description?: string;
  'dist-tags': {
    latest: string;
    [tag: string]: string;
  };
  versions: Record<string, NpmPackageVersion>;
  time: {
    created: string;
    modified: string;
    [version: string]: string;
  };
  maintainers: Array<{
    name: string;
    email: string;
  }>;
  keywords?: string[];
  repository?: {
    type: string;
    url: string;
  };
  homepage?: string;
  bugs?: {
    url: string;
  };
  license?: string;
  author?: string | {
    name: string;
    email?: string;
    url?: string;
  };
}

export interface NpmPackageVersion {
  name: string;
  version: string;
  description?: string;
  main?: string;
  scripts?: Record<string, string>;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
  keywords?: string[];
  author?: string | {
    name: string;
    email?: string;
    url?: string;
  };
  license?: string;
  repository?: string | {
    type: string;
    url: string;
  };
  homepage?: string;
  bugs?: string | {
    url: string;
  };
  bin?: Record<string, string>;
  engines?: Record<string, string>;
  dist: {
    shasum: string;
    tarball: string;
    integrity: string;
    fileCount: number;
    unpackedSize: number;
  };
}

export interface NpmSearchResult {
  total: number;
  objects: Array<{
    package: {
      name: string;
      version: string;
      description?: string;
      keywords?: string[];
      date: string;
      links: {
        npm: string;
        homepage?: string;
        repository?: string;
        bugs?: string;
      };
      author?: {
        name: string;
        email?: string;
      };
      publisher: {
        username: string;
        email: string;
      };
      maintainers: Array<{
        username: string;
        email: string;
      }>;
    };
    score: {
      final: number;
      detail: {
        quality: number;
        popularity: number;
        maintenance: number;
      };
    };
    searchScore: number;
  }>;
}

export interface NpmDownloadStats {
  downloads: number;
  start: string;
  end: string;
  package: string;
}

export class NpmRegistryClient {
  private client: AxiosInstance;
  private baseUrl = 'https://registry.npmjs.org';

  constructor() {
    this.client = axios.create({
      baseURL: this.baseUrl,
      timeout: 10000,
      headers: {
        'Accept': 'application/vnd.npm.install-v1+json',
        'User-Agent': 'MCP-Wizard/1.0.0',
      },
    });

    // Add response interceptor for logging
    this.client.interceptors.response.use(
      (response) => {
        logger.debug(`npm API call: ${response.config.method?.toUpperCase()} ${response.config.url}`);
        return response;
      },
      (error) => {
        logger.error(`npm API error: ${error.config?.method?.toUpperCase()} ${error.config?.url}`, error.message);
        throw error;
      }
    );
  }

  /**
   * Search for packages in the npm registry
   */
  async searchPackages(
    query: string,
    options: {
      size?: number;
      from?: number;
      quality?: number;
      popularity?: number;
      maintenance?: number;
    } = {}
  ): Promise<NpmSearchResult> {
    try {
      const params = new URLSearchParams({
        text: query,
        size: (options.size || 20).toString(),
        from: (options.from || 0).toString(),
      });

      // Add scoring parameters if specified
      if (options.quality !== undefined) {
        params.append('quality', options.quality.toString());
      }
      if (options.popularity !== undefined) {
        params.append('popularity', options.popularity.toString());
      }
      if (options.maintenance !== undefined) {
        params.append('maintenance', options.maintenance.toString());
      }

      logger.info(`Searching npm registry for: "${query}"`);

      const response = await this.client.get<NpmSearchResult>(
        `/-/v1/search?${params}`
      );

      logger.info(`Found ${response.data.total} npm packages for query: "${query}"`);

      return response.data;
    } catch (error) {
      logger.error('Error searching npm packages:', error);
      throw new Error(`Failed to search npm packages: ${error}`);
    }
  }

  /**
   * Get detailed information about a specific package
   */
  async getPackageInfo(packageName: string): Promise<NpmPackageInfo> {
    try {
      logger.debug(`Fetching npm package info: ${packageName}`);

      const response = await this.client.get<NpmPackageInfo>(
        `/-/package/${encodeURIComponent(packageName)}/dist-tags`
      );

      // The dist-tags endpoint gives us basic info, but we need the full package info
      // Let's get the latest version details
      const latestVersion = response.data['latest'];
      const fullResponse = await this.client.get<NpmPackageInfo>(
        `/${encodeURIComponent(packageName)}`
      );

      return fullResponse.data;
    } catch (error) {
      logger.error(`Error fetching npm package ${packageName}:`, error);
      throw new Error(`Failed to fetch npm package ${packageName}`);
    }
  }

  /**
   * Get specific version information for a package
   */
  async getPackageVersion(packageName: string, version: string): Promise<NpmPackageVersion> {
    try {
      logger.debug(`Fetching npm package version: ${packageName}@${version}`);

      const response = await this.client.get<NpmPackageVersion>(
        `/${encodeURIComponent(packageName)}/${version}`
      );

      return response.data;
    } catch (error) {
      logger.error(`Error fetching npm package version ${packageName}@${version}:`, error);
      throw new Error(`Failed to fetch npm package version ${packageName}@${version}`);
    }
  }

  /**
   * Get download statistics for a package
   */
  async getDownloadStats(
    packageName: string,
    period: 'last-day' | 'last-week' | 'last-month' | 'last-year' = 'last-month'
  ): Promise<NpmDownloadStats> {
    try {
      logger.debug(`Fetching download stats for ${packageName} (${period})`);

      const response = await this.client.get<NpmDownloadStats>(
        `/-/package/${encodeURIComponent(packageName)}/stats/${period}`
      );

      return response.data;
    } catch (error) {
      logger.error(`Error fetching download stats for ${packageName}:`, error);
      // Return default stats if API fails
      return {
        downloads: 0,
        start: new Date().toISOString(),
        end: new Date().toISOString(),
        package: packageName,
      };
    }
  }

  /**
   * Extract GitHub repository URL from npm package info
   */
  extractGitHubUrl(packageInfo: NpmPackageInfo): string | null {
    const repository = packageInfo.repository;

    if (!repository) return null;

    if (typeof repository === 'string') {
      // Handle string format like "git+https://github.com/user/repo.git"
      const match = repository.match(/github\.com\/([^\/]+)\/([^\/\.]+)/);
      return match ? `https://github.com/${match[1]}/${match[2]}` : null;
    }

    if (repository.url) {
      // Handle object format
      const match = repository.url.match(/github\.com\/([^\/]+)\/([^\/\.]+)/);
      return match ? `https://github.com/${match[1]}/${match[2]}` : null;
    }

    return null;
  }

  /**
   * Check if package is likely maintained (not too old)
   */
  isRecentlyMaintained(packageInfo: NpmPackageInfo): boolean {
    const modifiedDate = new Date(packageInfo.time.modified);
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    return modifiedDate > sixMonthsAgo;
  }

  /**
   * Get the latest version of a package
   */
  getLatestVersion(packageInfo: NpmPackageInfo): string {
    return packageInfo['dist-tags'].latest;
  }
}

// Export singleton instance
export const npmClient = new NpmRegistryClient();