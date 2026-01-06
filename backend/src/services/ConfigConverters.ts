import { UserConfig, MCPServer } from '@mcp-wizard/shared';
import { logger } from '../utils/logger';

export type ExportFormat = 'claude-desktop' | 'mcp-config' | 'custom';

export interface ExportResult {
  format: ExportFormat;
  content: string;
  filename: string;
  contentType: string;
}

/**
 * Configuration format converters
 */
export class ConfigConverters {
  /**
   * Convert configuration to Claude Desktop format
   */
  static toClaudeDesktop(config: UserConfig, server: MCPServer): ExportResult {
    try {
      const claudeConfig = {
        mcpServers: {
          [config.name]: {
            command: config.command,
            args: config.args,
            env: config.env,
          },
        },
      };

      // Add any secrets that are available (resolved from keychain)
      if (config.secrets && Object.keys(config.secrets).length > 0) {
        // In a real implementation, secrets would be resolved from keychain
        logger.debug('Would resolve secrets from keychain for Claude Desktop export');
      }

      return {
        format: 'claude-desktop',
        content: JSON.stringify(claudeConfig, null, 2),
        filename: `claude-desktop-${config.name}.json`,
        contentType: 'application/json',
      };
    } catch (error) {
      logger.error('Error converting to Claude Desktop format:', error);
      throw new Error('Failed to convert configuration to Claude Desktop format');
    }
  }

  /**
   * Convert configuration to generic MCP format
   */
  static toMCPConfig(config: UserConfig, server: MCPServer): ExportResult {
    try {
      const mcpConfig = {
        server: config.name,
        version: '1.0',
        command: config.command,
        args: config.args,
        env: config.env,
        mcp: {
          serverInfo: {
            name: server.name,
            version: server.version,
            description: server.description,
          },
          capabilities: {
            tools: server.tools || [],
            resources: server.resources || [],
            prompts: server.prompts || [],
          },
          transport: {
            type: 'stdio', // Default to stdio
            args: config.args,
          },
        },
      };

      return {
        format: 'mcp-config',
        content: JSON.stringify(mcpConfig, null, 2),
        filename: `${config.name}-mcp-config.json`,
        contentType: 'application/json',
      };
    } catch (error) {
      logger.error('Error converting to MCP config format:', error);
      throw new Error('Failed to convert configuration to MCP format');
    }
  }

  /**
   * Convert configuration to custom format
   */
  static toCustomFormat(config: UserConfig, server: MCPServer, template?: string): ExportResult {
    try {
      let content: string;

      if (template) {
        // Use custom template with variable substitution
        content = this.applyCustomTemplate(template, config, server);
      } else {
        // Default custom format (YAML-like)
        content = this.generateDefaultCustomFormat(config, server);
      }

      return {
        format: 'custom',
        content,
        filename: `${config.name}-config.yaml`,
        contentType: 'application/x-yaml',
      };
    } catch (error) {
      logger.error('Error converting to custom format:', error);
      throw new Error('Failed to convert configuration to custom format');
    }
  }

  /**
   * Generate default custom format (YAML)
   */
  private static generateDefaultCustomFormat(config: UserConfig, server: MCPServer): string {
    const lines: string[] = [];

    lines.push(`# MCP Configuration: ${config.name}`);
    lines.push(`# Generated for: ${server.name}`);
    lines.push('');
    lines.push('server:');
    lines.push(`  name: "${config.name}"`);
    lines.push(`  command: "${config.command}"`);

    if (config.args && config.args.length > 0) {
      lines.push('  args:');
      config.args.forEach(arg => {
        lines.push(`    - "${arg}"`);
      });
    }

    if (config.env && Object.keys(config.env).length > 0) {
      lines.push('  env:');
      Object.entries(config.env).forEach(([key, value]) => {
        lines.push(`    ${key}: "${value}"`);
      });
    }

    lines.push('');
    lines.push('# MCP Server Information:');
    lines.push(`# Name: ${server.name}`);
    lines.push(`# Description: ${server.description}`);
    lines.push(`# Author: ${server.author}`);
    lines.push(`# Version: ${server.version}`);

    return lines.join('\n');
  }

  /**
   * Apply custom template with variable substitution
   */
  private static applyCustomTemplate(template: string, config: UserConfig, server: MCPServer): string {
    let result = template;

    // Replace configuration variables
    result = result.replace(/\{\{config\.name\}\}/g, config.name);
    result = result.replace(/\{\{config\.command\}\}/g, config.command);
    result = result.replace(/\{\{config\.args\}\}/g, JSON.stringify(config.args));
    result = result.replace(/\{\{config\.env\}\}/g, JSON.stringify(config.env, null, 2));

    // Replace server variables
    result = result.replace(/\{\{server\.name\}\}/g, server.name);
    result = result.replace(/\{\{server\.description\}\}/g, server.description || '');
    result = result.replace(/\{\{server\.author\}\}/g, server.author || '');
    result = result.replace(/\{\{server\.version\}\}/g, server.version || '');
    result = result.replace(/\{\{server\.license\}\}/g, server.license || '');

    return result;
  }

  /**
   * Validate exported configuration
   */
  static validateExport(result: ExportResult): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    try {
      if (result.format === 'claude-desktop' || result.format === 'mcp-config') {
        JSON.parse(result.content);
      }

      if (!result.filename) {
        errors.push('Filename is required');
      }

      if (!result.contentType) {
        errors.push('Content type is required');
      }

      if (result.content.length === 0) {
        errors.push('Content cannot be empty');
      }

    } catch (error) {
      errors.push(`Invalid ${result.format} format: ${error}`);
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Get supported export formats
   */
  static getSupportedFormats(): { value: ExportFormat; label: string; description: string }[] {
    return [
      {
        value: 'claude-desktop',
        label: 'Claude Desktop',
        description: 'Configuration format for Anthropic Claude Desktop application',
      },
      {
        value: 'mcp-config',
        label: 'MCP Config',
        description: 'Generic MCP configuration format with server metadata',
      },
      {
        value: 'custom',
        label: 'Custom Format',
        description: 'Customizable format using templates with variable substitution',
      },
    ];
  }
}