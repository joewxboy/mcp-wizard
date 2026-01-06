import { GitHubAPIClient, githubClient } from './GitHubAPIClient';
import { RepositoryMetadataExtractor } from './RepositoryMetadataExtractor';
import { NpmRegistryClient, npmClient } from './NpmRegistryClient';
import { PackageMetadataExtractor, packageMetadataExtractor } from './PackageMetadataExtractor';
import { MCPServer } from '@mcp-wizard/shared';
import { logger } from '../../utils/logger';
import { setCache, getCache } from '../../config/redis';
import { prisma } from '../../db/database';

export interface ResearchOptions {
  query?: string;
  maxResults?: number;
  minStars?: number;
  includeForks?: boolean;
}

export interface ResearchJob {
  id: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  query: string;
  results: MCPServer[];
  error?: string;
  startedAt?: Date;
  completedAt?: Date;
}

export class ResearchService {
  private githubClient: GitHubAPIClient;
  private metadataExtractor: RepositoryMetadataExtractor;
  private npmClient: NpmRegistryClient;
  private packageExtractor: PackageMetadataExtractor;
  private activeJobs: Map<string, ResearchJob> = new Map();

  constructor(
    githubClient: GitHubAPIClient,
    metadataExtractor: RepositoryMetadataExtractor,
    npmClient: NpmRegistryClient,
    packageExtractor: PackageMetadataExtractor
  ) {
    this.githubClient = githubClient;
    this.metadataExtractor = metadataExtractor;
    this.npmClient = npmClient;
    this.packageExtractor = packageExtractor;
  }

  /**
   * Discover MCP servers from various sources (GitHub + npm)
   */
  async discoverMCPServers(options: ResearchOptions = {}): Promise<MCPServer[]> {
    const {
      query = 'MCP server',
      maxResults = 50,
      minStars = 10,
      includeForks = false,
    } = options;

    logger.info(`Starting MCP server discovery with query: "${query}"`);

    const cacheKey = `research:${query}:${maxResults}:${minStars}`;
    const cached = await getCache<MCPServer[]>(cacheKey);

    if (cached) {
      logger.info(`Returning cached results for query: "${query}"`);
      return cached;
    }

    try {
      // Search both GitHub and npm in parallel
      const [githubResults, npmResults] = await Promise.allSettled([
        this.searchGitHub(query, maxResults, minStars, includeForks),
        this.searchNpm(query, maxResults),
      ]);

      // Extract successful results
      const githubServers = githubResults.status === 'fulfilled' ? githubResults.value : [];
      const npmServers = npmResults.status === 'fulfilled' ? npmResults.value : [];

      logger.info(`GitHub search found ${githubServers.length} servers`);
      logger.info(`npm search found ${npmServers.length} servers`);

      // Combine and deduplicate results
      const allServers = this.deduplicateAndMerge(githubServers, npmServers);

      // Sort by relevance/popularity and limit results
      const sortedServers = allServers
        .sort((a, b) => (b.popularity || 0) - (a.popularity || 0))
        .slice(0, maxResults);

      // Save discovered servers to database
      await this.saveDiscoveredServers(sortedServers);

      // Cache results for 1 hour
      await setCache(cacheKey, sortedServers, 3600);

      logger.info(`Discovery complete. Found ${sortedServers.length} unique MCP servers.`);

      return sortedServers;

    } catch (error) {
      logger.error('Error during MCP server discovery:', error);
      throw new Error(`Failed to discover MCP servers: ${error}`);
    }
  }

  /**
   * Search GitHub repositories for MCP servers
   */
  private async searchGitHub(
    query: string,
    maxResults: number,
    minStars: number,
    includeForks: boolean
  ): Promise<MCPServer[]> {
    const servers: MCPServer[] = [];

    try {
      const searchResults = await this.githubClient.searchRepositories(query, {
        sort: 'stars',
        order: 'desc',
        per_page: Math.min(maxResults * 2, 100),
      });

      logger.debug(`GitHub search returned ${searchResults.total_count} repositories`);

      // Process repositories in parallel
      const processPromises = searchResults.items
        .filter(repo => {
          if (repo.stargazers_count < minStars) return false;
          if (!includeForks && repo.forks_count > repo.stargazers_count * 2) return false;
          return true;
        })
        .slice(0, maxResults)
        .map(async (repo) => {
          try {
            const [owner, name] = repo.full_name.split('/');
            const server = await this.metadataExtractor.analyzeRepository(owner, name);
            return server;
          } catch (error) {
            logger.warn(`Failed to analyze GitHub repository ${repo.full_name}:`, error);
            return null;
          }
        });

      const results = await Promise.allSettled(processPromises);

      for (const result of results) {
        if (result.status === 'fulfilled' && result.value) {
          servers.push(result.value);
        }
      }

    } catch (error) {
      logger.error('Error during GitHub search:', error);
      // Don't throw - we can still return npm results
    }

    return servers;
  }

  /**
   * Search npm registry for MCP packages
   */
  private async searchNpm(query: string, maxResults: number): Promise<MCPServer[]> {
    const servers: MCPServer[] = [];

    try {
      const searchResults = await this.npmClient.searchPackages(query, {
        size: maxResults * 2, // Get more to account for filtering
        quality: 0.5, // Require decent quality score
        popularity: 0.1, // Some popularity
        maintenance: 0.5, // Active maintenance
      });

      logger.debug(`npm search returned ${searchResults.total} packages`);

      // Analyze packages for MCP relevance
      const analyses = await this.packageExtractor.analyzeSearchResults(searchResults);

      // Convert MCP packages to MCPServer format
      for (const analysis of analyses) {
        if (analysis.isMCP && analysis.confidence >= 0.3) {
          const server = this.packageExtractor.analysisToMCPServer(analysis);
          servers.push(server);
        }
      }

    } catch (error) {
      logger.error('Error during npm search:', error);
      // Don't throw - we can still return GitHub results
    }

    return servers;
  }

  /**
   * Deduplicate and merge results from GitHub and npm
   */
  private deduplicateAndMerge(githubServers: MCPServer[], npmServers: MCPServer[]): MCPServer[] {
    const serverMap = new Map<string, MCPServer>();

    // Add GitHub servers first (higher priority)
    for (const server of githubServers) {
      serverMap.set(server.id, server);
    }

    // Add npm servers, but check for duplicates
    for (const npmServer of npmServers) {
      const existingServer = serverMap.get(npmServer.id);

      if (!existingServer) {
        // No duplicate, add npm server
        serverMap.set(npmServer.id, npmServer);
      } else if (existingServer.source === 'github' && npmServer.source === 'npm') {
        // GitHub server exists, enhance it with npm data if available
        const enhanced = this.mergeGitHubAndNpmData(existingServer, npmServer);
        serverMap.set(existingServer.id, enhanced);
      }
    }

    return Array.from(serverMap.values());
  }

  /**
   * Merge GitHub and npm data for the same server
   */
  private mergeGitHubAndNpmData(githubServer: MCPServer, npmServer: MCPServer): MCPServer {
    // Prefer GitHub data for most fields, but enhance with npm data
    return {
      ...githubServer,
      // Use npm download count if GitHub doesn't have popularity
      popularity: githubServer.popularity || npmServer.popularity || 0,
      // Combine tags
      tags: Array.from(new Set([...githubServer.tags, ...npmServer.tags])),
      // Use npm README if GitHub doesn't have one or it's shorter
      readme: githubServer.readme.length > npmServer.readme.length ? githubServer.readme : npmServer.readme,
    };
  }

  /**
   * Analyze a specific repository URL
   */
  async analyzeRepository(url: string): Promise<MCPServer | null> {
    try {
      // Extract owner/repo from GitHub URL
      const match = url.match(/github\.com\/([^\/]+)\/([^\/]+)/);
      if (!match) {
        throw new Error('Invalid GitHub repository URL');
      }

      const [, owner, repo] = match;
      const cleanRepo = repo.replace(/\.git$/, '');

      logger.info(`Analyzing specific repository: ${owner}/${cleanRepo}`);

      const cacheKey = `repo:${owner}/${cleanRepo}`;
      const cached = await getCache<MCPServer>(cacheKey);

      if (cached) {
        logger.info(`Returning cached analysis for ${owner}/${cleanRepo}`);
        return cached;
      }

      const server = await this.metadataExtractor.analyzeRepository(owner, cleanRepo);

      if (server) {
        // Cache for 6 hours
        await setCache(cacheKey, server, 21600);
      }

      return server;

    } catch (error) {
      logger.error(`Error analyzing repository ${url}:`, error);
      throw new Error(`Failed to analyze repository: ${error}`);
    }
  }

  /**
   * Start an asynchronous research job
   */
  async startResearchJob(options: ResearchOptions = {}): Promise<string> {
    const jobId = `job_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const job: ResearchJob = {
      id: jobId,
      status: 'pending',
      query: options.query || 'MCP server',
      results: [],
      startedAt: new Date(),
    };

    this.activeJobs.set(jobId, job);

    // Start the job asynchronously
    this.runResearchJob(jobId, options);

    logger.info(`Started research job: ${jobId}`);
    return jobId;
  }

  /**
   * Get the status of a research job
   */
  getResearchJobStatus(jobId: string): ResearchJob | null {
    return this.activeJobs.get(jobId) || null;
  }

  /**
   * Run a research job asynchronously
   */
  private async runResearchJob(jobId: string, options: ResearchOptions): Promise<void> {
    const job = this.activeJobs.get(jobId);
    if (!job) return;

    job.status = 'running';

    try {
      logger.info(`Running research job: ${jobId}`);

      const results = await this.discoverMCPServers(options);

      job.status = 'completed';
      job.results = results;
      job.completedAt = new Date();

      logger.info(`Completed research job: ${jobId} - Found ${results.length} servers`);

    } catch (error) {
      job.status = 'failed';
      job.error = error instanceof Error ? error.message : 'Unknown error';
      job.completedAt = new Date();

      logger.error(`Failed research job: ${jobId} -`, error);
    }

    // Clean up job after some time
    setTimeout(() => {
      this.activeJobs.delete(jobId);
    }, 3600000); // Keep for 1 hour
  }

  /**
   * Get rate limit status for GitHub API
   */
  getGitHubRateLimitStatus() {
    return this.githubClient.getRateLimitStatus();
  }

  /**
   * Check if GitHub API is available
   */
  isGitHubAPIAvailable(): boolean {
    return this.githubClient.canMakeRequest();
  }

  /**
   * Get combined API status for GitHub and npm
   */
  getAPIStatus() {
    return {
      github: {
        available: this.isGitHubAPIAvailable(),
        rateLimit: this.getGitHubRateLimitStatus(),
      },
      npm: {
        available: true, // npm registry doesn't have rate limits in the same way
        rateLimit: null,
      },
    };
  }

  /**
   * Save discovered servers to database
   */
  private async saveDiscoveredServers(servers: MCPServer[]): Promise<void> {
    try {
      logger.info(`Saving ${servers.length} discovered servers to database`);

      let savedCount = 0;
      for (const server of servers) {
        try {
          logger.debug(`Saving server: ${server.id}`);

          // Use upsert to avoid duplicates
          await prisma.mCPServer.upsert({
            where: { id: server.id },
            update: {
              name: server.name,
              description: server.description,
              version: server.version,
              author: server.author,
              license: server.license,
              tags: server.tags,
              readme: server.readme,
              tools: server.tools,
              resources: server.resources,
              prompts: server.prompts,
              configTemplate: server.configTemplate,
              requiredParams: server.requiredParams,
              optionalParams: server.optionalParams,
              popularity: server.popularity,
              lastResearchedAt: new Date(),
            },
            create: {
              id: server.id,
              name: server.name,
              description: server.description,
              source: server.source,
              sourceUrl: server.sourceUrl,
              packageName: server.packageName,
              version: server.version,
              author: server.author,
              license: server.license,
              tags: server.tags,
              readme: server.readme,
              tools: server.tools,
              resources: server.resources,
              prompts: server.prompts,
              configTemplate: server.configTemplate,
              requiredParams: server.requiredParams,
              optionalParams: server.optionalParams,
              popularity: server.popularity,
              verified: server.verified,
              lastResearchedAt: new Date(),
            },
          });

          savedCount++;
        } catch (error) {
          logger.warn(`Failed to save server ${server.id}:`, error);
          // Continue with other servers
        }
      }

      logger.info(`Successfully saved ${savedCount}/${servers.length} discovered servers to database`);

    } catch (error) {
      logger.error('Error saving discovered servers:', error);
      // Don't throw - discovery should succeed even if saving fails
    }
  }

  /**
   * Clear research cache
   */
  async clearCache(): Promise<void> {
    // This would need to be implemented with a more sophisticated cache clearing
    // For now, we'll just log that manual cache clearing might be needed
    logger.info('Cache clearing requested - Redis cache will expire naturally');
  }
}

// Export factory function to create service instances
export const createResearchService = () => new ResearchService(
  githubClient,
  new RepositoryMetadataExtractor(githubClient),
  npmClient,
  new PackageMetadataExtractor(npmClient)
);