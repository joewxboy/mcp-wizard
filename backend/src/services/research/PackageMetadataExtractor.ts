import { NpmRegistryClient, npmClient, NpmPackageInfo, NpmPackageVersion, NpmSearchResult } from './NpmRegistryClient';
import { MCPServer } from '@mcp-wizard/shared';
import { logger } from '../../utils/logger';

export interface NpmPackageAnalysis {
  packageName: string;
  isMCP: boolean;
  confidence: number; // 0-1 score
  mcpIndicators: string[];
  githubUrl?: string;
  metadata: {
    description?: string;
    version: string;
    author?: string;
    license?: string;
    keywords?: string[];
    homepage?: string;
    downloads?: number;
    isRecent: boolean;
  };
}

export class PackageMetadataExtractor {
  private npmClient: NpmRegistryClient;

  constructor(client: NpmRegistryClient) {
    this.npmClient = client;
  }

  /**
   * Analyze npm search results for MCP packages
   */
  async analyzeSearchResults(searchResult: NpmSearchResult): Promise<NpmPackageAnalysis[]> {
    const analyses: NpmPackageAnalysis[] = [];

    for (const result of searchResult.objects) {
      try {
        const analysis = await this.analyzePackage(result.package.name);
        analyses.push(analysis);
      } catch (error) {
        logger.warn(`Failed to analyze package ${result.package.name}:`, error);
        // Continue with other packages
      }
    }

    return analyses;
  }

  /**
   * Analyze a specific npm package for MCP relevance
   */
  async analyzePackage(packageName: string): Promise<NpmPackageAnalysis> {
    try {
      logger.debug(`Analyzing npm package: ${packageName}`);

      // Get package info
      const packageInfo = await this.npmClient.getPackageInfo(packageName);
      const latestVersion = this.npmClient.getLatestVersion(packageInfo);
      const versionInfo = await this.npmClient.getPackageVersion(packageName, latestVersion);

      // Get download stats
      const downloadStats = await this.npmClient.getDownloadStats(packageName, 'last-month');

      // Analyze for MCP indicators
      const mcpAnalysis = this.analyzeMCPIndicators(packageName, packageInfo, versionInfo);

      // Extract GitHub URL
      const githubUrl = this.npmClient.extractGitHubUrl(packageInfo);

      const analysis: NpmPackageAnalysis = {
        packageName,
        isMCP: mcpAnalysis.isMCP,
        confidence: mcpAnalysis.confidence,
        mcpIndicators: mcpAnalysis.indicators,
        githubUrl,
        metadata: {
          description: versionInfo.description || packageInfo.description,
          version: latestVersion,
          author: this.extractAuthor(versionInfo),
          license: versionInfo.license || packageInfo.license,
          keywords: versionInfo.keywords || packageInfo.keywords || [],
          homepage: versionInfo.homepage || packageInfo.homepage,
          downloads: downloadStats.downloads,
          isRecent: this.npmClient.isRecentlyMaintained(packageInfo),
        },
      };

      logger.debug(`Package analysis complete for ${packageName}: MCP=${analysis.isMCP}, confidence=${analysis.confidence.toFixed(2)}`);

      return analysis;

    } catch (error) {
      logger.error(`Error analyzing npm package ${packageName}:`, error);

      // Return a basic analysis on error
      return {
        packageName,
        isMCP: false,
        confidence: 0,
        mcpIndicators: [],
        metadata: {
          version: 'unknown',
          isRecent: false,
        },
      };
    }
  }

  /**
   * Analyze package for MCP indicators
   */
  private analyzeMCPIndicators(
    packageName: string,
    packageInfo: NpmPackageInfo,
    versionInfo: NpmPackageVersion
  ): { isMCP: boolean; confidence: number; indicators: string[] } {
    const indicators: string[] = [];
    let score = 0;
    const maxScore = 100;

    // Package name analysis (40 points max)
    const nameLower = packageName.toLowerCase();
    if (nameLower.includes('mcp')) {
      score += 25;
      indicators.push('package-name-contains-mcp');
    }
    if (nameLower.includes('model') && nameLower.includes('context')) {
      score += 15;
      indicators.push('package-name-contains-model-context');
    }

    // Keywords analysis (25 points max)
    const keywords = [...(versionInfo.keywords || []), ...(packageInfo.keywords || [])];
    const mcpKeywords = keywords.filter(k =>
      k.toLowerCase().includes('mcp') ||
      k.toLowerCase().includes('model context protocol')
    );
    if (mcpKeywords.length > 0) {
      score += Math.min(25, mcpKeywords.length * 10);
      indicators.push(`keywords: ${mcpKeywords.join(', ')}`);
    }

    // Description analysis (20 points max)
    const description = versionInfo.description || packageInfo.description || '';
    const descLower = description.toLowerCase();
    if (descLower.includes('mcp') || descLower.includes('model context protocol')) {
      score += 20;
      indicators.push('description-contains-mcp');
    } else if (descLower.includes('model context')) {
      score += 10;
      indicators.push('description-contains-model-context');
    }

    // Dependencies analysis (15 points max)
    const allDeps = {
      ...versionInfo.dependencies,
      ...versionInfo.devDependencies,
      ...versionInfo.peerDependencies,
    };

    const mcpDeps = Object.keys(allDeps).filter(dep =>
      dep.toLowerCase().includes('@modelcontextprotocol') ||
      dep.toLowerCase().includes('mcp')
    );

    if (mcpDeps.length > 0) {
      score += Math.min(15, mcpDeps.length * 8);
      indicators.push(`dependencies: ${mcpDeps.join(', ')}`);
    }

    // Repository analysis (bonus points)
    const githubUrl = this.npmClient.extractGitHubUrl(packageInfo);
    if (githubUrl) {
      // We can analyze the GitHub repo later, but for now just note it exists
      score += 5;
      indicators.push('has-github-repository');
    }

    // Maintenance score (penalty for old packages)
    const isRecent = this.npmClient.isRecentlyMaintained(packageInfo);
    if (!isRecent) {
      score *= 0.7; // 30% penalty for old packages
      indicators.push('package-not-recently-maintained');
    }

    // Download score (bonus for popular packages)
    const downloads = this.getDownloadEstimate(packageInfo);
    if (downloads > 1000) {
      score += 5;
      indicators.push('high-download-count');
    } else if (downloads > 100) {
      score += 2;
      indicators.push('moderate-download-count');
    }

    const confidence = Math.min(score / maxScore, 1);
    const isMCP = confidence >= 0.3; // 30% confidence threshold

    return {
      isMCP,
      confidence,
      indicators,
    };
  }

  /**
   * Estimate download count (rough approximation)
   */
  private getDownloadEstimate(packageInfo: NpmPackageInfo): number {
    // This is a rough estimate - in production you'd use the actual download stats API
    // For now, we'll return a placeholder
    return 0;
  }

  /**
   * Extract author information
   */
  private extractAuthor(versionInfo: NpmPackageVersion): string {
    const author = versionInfo.author;

    if (!author) return 'Unknown';

    if (typeof author === 'string') {
      return author;
    }

    return author.name;
  }

  /**
   * Convert npm package analysis to MCPServer format
   */
  analysisToMCPServer(analysis: NpmPackageAnalysis): MCPServer {
    const server: MCPServer = {
      id: `npm:${analysis.packageName}`,
      name: analysis.packageName,
      description: analysis.metadata.description || `${analysis.packageName} MCP server`,
      source: 'npm',
      sourceUrl: `https://www.npmjs.com/package/${analysis.packageName}`,
      packageName: analysis.packageName,
      version: analysis.metadata.version,
      author: analysis.metadata.author || 'Unknown',
      license: analysis.metadata.license || 'Unknown',
      tags: this.generateTags(analysis),
      readme: this.generateReadme(analysis),
      tools: [], // Will be populated by GitHub analysis if available
      resources: [], // Will be populated by GitHub analysis if available
      prompts: [], // Will be populated by GitHub analysis if available
      configTemplate: this.generateConfigTemplate(analysis),
      requiredParams: [],
      optionalParams: [],
      createdAt: new Date(),
      updatedAt: new Date(),
      lastResearchedAt: new Date(),
      popularity: analysis.metadata.downloads || 0,
      verified: false, // npm packages need manual verification
    };

    return server;
  }

  /**
   * Generate tags from analysis
   */
  private generateTags(analysis: NpmPackageAnalysis): string[] {
    const tags = new Set<string>();

    // Add MCP-related tags
    if (analysis.isMCP) {
      tags.add('mcp');
      tags.add('npm');
      tags.add('model-context-protocol');
    }

    // Add keywords
    analysis.metadata.keywords?.forEach(keyword => {
      tags.add(keyword.toLowerCase());
    });

    // Add source tag
    tags.add('npm-package');

    return Array.from(tags);
  }

  /**
   * Generate README content from package info
   */
  private generateReadme(analysis: NpmPackageAnalysis): string {
    let readme = `# ${analysis.packageName}\n\n`;

    if (analysis.metadata.description) {
      readme += `${analysis.metadata.description}\n\n`;
    }

    readme += `## Installation\n\n`;
    readme += `\`\`\`bash\n`;
    readme += `npm install ${analysis.packageName}`;
    readme += `\`\`\`\n\n`;

    if (analysis.githubUrl) {
      readme += `## Repository\n\n`;
      readme += `[GitHub](${analysis.githubUrl})\n\n`;
    }

    if (analysis.metadata.homepage) {
      readme += `## Homepage\n\n`;
      readme += `[${analysis.metadata.homepage}](${analysis.metadata.homepage})\n\n`;
    }

    if (analysis.mcpIndicators.length > 0) {
      readme += `## MCP Indicators\n\n`;
      readme += `This package was identified as MCP-related due to:\n`;
      analysis.mcpIndicators.forEach(indicator => {
        readme += `- ${indicator}\n`;
      });
      readme += `\n`;
      readme += `Confidence score: ${(analysis.confidence * 100).toFixed(1)}%\n\n`;
    }

    return readme;
  }

  /**
   * Generate basic configuration template
   */
  private generateConfigTemplate(analysis: NpmPackageAnalysis): any {
    return {
      command: 'node',
      args: [`./node_modules/.bin/${analysis.packageName}`],
      env: {},
      transport: 'stdio',
    };
  }
}

// Export singleton instance
export const packageMetadataExtractor = new PackageMetadataExtractor();