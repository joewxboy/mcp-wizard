import { GitHubAPIClient, githubClient } from './GitHubAPIClient';
import { logger } from '../../utils/logger';
import { MCPServer } from '@mcp-wizard/shared';

export interface PackageJson {
  name?: string;
  version?: string;
  description?: string;
  main?: string;
  scripts?: Record<string, string>;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  keywords?: string[];
  author?: string | { name: string; email?: string };
  license?: string;
  repository?: string | { url: string; type?: string };
  homepage?: string;
  bugs?: string | { url: string };
}

export interface MCPMetadata {
  hasMCP: boolean;
  tools: any[];
  resources: any[];
  prompts: any[];
  transport: 'stdio' | 'sse' | null;
  command: string | null;
  args: string[] | null;
  env: Record<string, string> | null;
}

export class RepositoryMetadataExtractor {
  private githubClient: GitHubAPIClient;

  constructor(client: GitHubAPIClient) {
    this.githubClient = client;
  }

  /**
   * Analyze a GitHub repository for MCP server information
   */
  async analyzeRepository(owner: string, repo: string): Promise<MCPServer | null> {
    try {
      logger.info(`Analyzing repository: ${owner}/${repo}`);

      // Get repository information
      const repoInfo = await this.githubClient.getRepository(owner, repo);

      // Skip if repository has too few stars (likely not maintained)
      if (repoInfo.stargazers_count < 5) {
        logger.debug(`Skipping repository ${owner}/${repo} - too few stars (${repoInfo.stargazers_count})`);
        return null;
      }

      // Get package.json
      let packageJson: PackageJson | null = null;
      try {
        const packageJsonContent = await this.githubClient.downloadFile(owner, repo, 'package.json');
        packageJson = JSON.parse(packageJsonContent);
      } catch (error) {
        logger.debug(`No package.json found in ${owner}/${repo}`);
      }

      // Get README
      let readme: string = '';
      const readmePaths = ['README.md', 'readme.md', 'README.MD'];
      for (const readmePath of readmePaths) {
        try {
          readme = await this.githubClient.downloadFile(owner, repo, readmePath);
          break;
        } catch (error) {
          continue;
        }
      }

      // Extract MCP metadata
      const mcpMetadata = await this.extractMCPMetadata(owner, repo, packageJson, readme);

      // Skip if no MCP information found
      if (!mcpMetadata.hasMCP) {
        logger.debug(`No MCP information found in ${owner}/${repo}`);
        return null;
      }

      // Generate configuration template
      const configTemplate = this.generateConfigTemplate(mcpMetadata, packageJson);

      // Determine required and optional parameters
      const { requiredParams, optionalParams } = this.extractParameters(configTemplate);

      // Create MCPServer object
      const mcpServer: MCPServer = {
        id: `${owner}/${repo}`,
        name: packageJson?.name || repo,
        description: packageJson?.description || repoInfo.description || '',
        source: 'github',
        sourceUrl: repoInfo.html_url,
        packageName: packageJson?.name,
        version: packageJson?.version || 'latest',
        author: this.extractAuthor(packageJson),
        license: packageJson?.license || repoInfo.license?.name || '',
        tags: this.extractTags(packageJson, repoInfo),
        readme,
        tools: mcpMetadata.tools,
        resources: mcpMetadata.resources,
        prompts: mcpMetadata.prompts,
        configTemplate,
        requiredParams,
        optionalParams,
        createdAt: new Date(),
        updatedAt: new Date(),
        lastResearchedAt: new Date(),
        popularity: repoInfo.stargazers_count,
        verified: false, // Will be set by manual verification
      };

      logger.info(`Successfully analyzed MCP server: ${owner}/${repo}`);
      return mcpServer;

    } catch (error) {
      logger.error(`Error analyzing repository ${owner}/${repo}:`, error);
      return null;
    }
  }

  /**
   * Extract MCP metadata from repository files
   */
  private async extractMCPMetadata(
    owner: string,
    repo: string,
    packageJson: PackageJson | null,
    readme: string
  ): Promise<MCPMetadata> {
    const metadata: MCPMetadata = {
      hasMCP: false,
      tools: [],
      resources: [],
      prompts: [],
      transport: null,
      command: null,
      args: null,
      env: null,
    };

    // Check if package.json indicates MCP usage
    if (packageJson) {
      const isMCP = this.checkPackageForMCP(packageJson);
      if (isMCP) {
        metadata.hasMCP = true;
        metadata.command = packageJson.name;
      }
    }

    // Check README for MCP information
    if (readme) {
      const readmeMCP = this.extractMCPFromReadme(readme);
      if (readmeMCP.hasMCP) {
        metadata.hasMCP = true;
        Object.assign(metadata, readmeMCP);
      }
    }

    // Try to find MCP schema files
    try {
      const rootContents = await this.githubClient.getRepositoryContents(owner, repo);
      const mcpFiles = rootContents.filter(file =>
        file.name.includes('mcp') ||
        file.name.includes('schema') ||
        file.name.endsWith('.json') ||
        file.name.endsWith('.yaml') ||
        file.name.endsWith('.yml')
      );

      for (const file of mcpFiles.slice(0, 5)) { // Limit to first 5 files
        try {
          const content = await this.githubClient.downloadFile(owner, repo, file.path);
          const fileMetadata = this.extractMCPFromSchemaFile(content, file.name);
          if (fileMetadata.hasMCP) {
            metadata.hasMCP = true;
            metadata.tools.push(...fileMetadata.tools);
            metadata.resources.push(...fileMetadata.resources);
            metadata.prompts.push(...fileMetadata.prompts);
          }
        } catch (error) {
          logger.debug(`Could not parse MCP file ${file.path}:`, error);
        }
      }
    } catch (error) {
      logger.debug(`Could not access repository contents for ${owner}/${repo}:`, error);
    }

    return metadata;
  }

  /**
   * Check if package.json indicates MCP usage
   */
  private checkPackageForMCP(packageJson: PackageJson): boolean {
    const { dependencies = {}, devDependencies = {}, keywords = [], description = '' } = packageJson;

    // Check dependencies for MCP-related packages
    const allDeps = { ...dependencies, ...devDependencies };
    const hasMCPDeps = Object.keys(allDeps).some(dep =>
      dep.toLowerCase().includes('mcp') ||
      dep.toLowerCase().includes('model-context-protocol')
    );

    // Check keywords
    const hasMCPKeywords = keywords.some(keyword =>
      keyword.toLowerCase().includes('mcp') ||
      keyword.toLowerCase().includes('model context protocol')
    );

    // Check description
    const hasMCPDescription = description.toLowerCase().includes('mcp') ||
                             description.toLowerCase().includes('model context protocol');

    return hasMCPDeps || hasMCPKeywords || hasMCPDescription;
  }

  /**
   * Extract MCP information from README
   */
  private extractMCPFromReadme(readme: string): Partial<MCPMetadata> {
    const metadata: Partial<MCPMetadata> = { hasMCP: false };

    // Check for MCP mentions
    const hasMCP = /MCP|Model Context Protocol/i.test(readme);
    if (!hasMCP) return metadata;

    metadata.hasMCP = true;

    // Try to extract command information
    const commandMatch = readme.match(/```(?:json|bash|sh)\s*\n\s*{\s*"mcpServers"\s*:\s*{[^}]*"command"\s*:\s*"([^"]+)"/s);
    if (commandMatch) {
      metadata.command = commandMatch[1];
    }

    // Try to extract transport information
    if (readme.includes('stdio')) {
      metadata.transport = 'stdio';
    } else if (readme.includes('sse') || readme.includes('server-sent events')) {
      metadata.transport = 'sse';
    }

    return metadata;
  }

  /**
   * Extract MCP information from schema files
   */
  private extractMCPFromSchemaFile(content: string, filename: string): Partial<MCPMetadata> {
    const metadata: Partial<MCPMetadata> = { hasMCP: false, tools: [], resources: [], prompts: [] };

    try {
      let data: any;

      if (filename.endsWith('.json')) {
        data = JSON.parse(content);
      } else if (filename.endsWith('.yaml') || filename.endsWith('.yml')) {
        // Simple YAML parsing for common patterns
        data = this.parseSimpleYAML(content);
      } else {
        return metadata;
      }

      // Check for MCP schema patterns
      if (data.tools && Array.isArray(data.tools)) {
        metadata.hasMCP = true;
        metadata.tools = data.tools;
      }

      if (data.resources && Array.isArray(data.resources)) {
        metadata.hasMCP = true;
        metadata.resources = data.resources;
      }

      if (data.prompts && Array.isArray(data.prompts)) {
        metadata.hasMCP = true;
        metadata.prompts = data.prompts;
      }

    } catch (error) {
      logger.debug(`Error parsing schema file ${filename}:`, error);
    }

    return metadata;
  }

  /**
   * Simple YAML parser for basic structures
   */
  private parseSimpleYAML(content: string): any {
    // This is a very basic YAML parser for common MCP schema patterns
    // In production, you might want to use a proper YAML library
    const lines = content.split('\n');
    const result: any = {};

    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.startsWith('#') || trimmed === '') continue;

      const colonIndex = trimmed.indexOf(':');
      if (colonIndex > 0) {
        const key = trimmed.substring(0, colonIndex).trim();
        const value = trimmed.substring(colonIndex + 1).trim();

        if (value.startsWith('[') && value.endsWith(']')) {
          // Simple array parsing
          result[key] = value.slice(1, -1).split(',').map(item => item.trim().replace(/"/g, ''));
        } else if (value.startsWith('{') && value.endsWith('}')) {
          // Simple object parsing
          result[key] = JSON.parse(value);
        } else {
          result[key] = value.replace(/"/g, '');
        }
      }
    }

    return result;
  }

  /**
   * Generate configuration template from extracted metadata
   */
  private generateConfigTemplate(metadata: MCPMetadata, packageJson: PackageJson | null): any {
    return {
      command: metadata.command || packageJson?.name || 'node',
      args: metadata.args || (packageJson?.main ? [packageJson.main] : []),
      env: metadata.env || {},
      transport: metadata.transport || 'stdio',
    };
  }

  /**
   * Extract required and optional parameters from config template
   */
  private extractParameters(configTemplate: any): { requiredParams: any[]; optionalParams: any[] } {
    const requiredParams: any[] = [];
    const optionalParams: any[] = [];

    // Extract from environment variables
    if (configTemplate.env) {
      Object.entries(configTemplate.env).forEach(([key, value]) => {
        const param = {
          key,
          type: this.inferParamType(value as string),
          description: `Environment variable for ${key}`,
          required: !value || value === '', // Required if empty
          default: value || undefined,
        };

        if (param.required) {
          requiredParams.push(param);
        } else {
          optionalParams.push(param);
        }
      });
    }

    return { requiredParams, optionalParams };
  }

  /**
   * Infer parameter type from value
   */
  private inferParamType(value: string): 'string' | 'number' | 'boolean' | 'path' | 'secret' {
    if (!value) return 'string';

    // Check for API keys/secrets
    if (value.toLowerCase().includes('key') ||
        value.toLowerCase().includes('token') ||
        value.toLowerCase().includes('secret')) {
      return 'secret';
    }

    // Check for paths
    if (value.includes('/') || value.includes('\\') || value.includes('.')) {
      return 'path';
    }

    // Check for numbers
    if (!isNaN(Number(value))) {
      return 'number';
    }

    // Check for booleans
    if (value.toLowerCase() === 'true' || value.toLowerCase() === 'false') {
      return 'boolean';
    }

    return 'string';
  }

  /**
   * Extract author information
   */
  private extractAuthor(packageJson: PackageJson | null): string {
    if (!packageJson?.author) return 'Unknown';

    if (typeof packageJson.author === 'string') {
      return packageJson.author;
    }

    return packageJson.author.name;
  }

  /**
   * Extract tags/topics
   */
  private extractTags(packageJson: PackageJson | null, repoInfo: GitHubRepo): string[] {
    const tags = new Set<string>();

    // Add GitHub topics
    repoInfo.topics?.forEach(topic => tags.add(topic));

    // Add package keywords
    packageJson?.keywords?.forEach(keyword => tags.add(keyword));

    // Add MCP-related tags
    tags.add('mcp');
    tags.add('model-context-protocol');

    return Array.from(tags);
  }
}