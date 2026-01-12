import { prisma } from '../db/database';
import { UserConfig, ValidationError } from '@mcp-wizard/shared';
import { logger } from '../utils/logger';
import { keychainService } from './KeychainService';
import { versionService } from './VersionService';

export interface CreateConfigRequest {
  serverId: string;
  name: string;
  command?: string;
  args?: string[];
  env?: Record<string, string>;
  secrets?: Record<string, string>; // Plain text secrets to be stored securely
  targetClient?: 'claude-desktop' | 'custom';
  customFormat?: string;
}

export interface UpdateConfigRequest {
  name?: string;
  command?: string;
  args?: string[];
  env?: Record<string, string>;
  secrets?: Record<string, string>;
  targetClient?: 'claude-desktop' | 'custom';
  customFormat?: string;
  enabled?: boolean;
}

export class ConfigurationService {
  /**
   * Create a new user configuration
   */
  async createConfig(userId: string, request: CreateConfigRequest): Promise<UserConfig> {
    try {
      logger.info(`Creating configuration for user ${userId}: ${request.name}`);

      // Verify the server exists
      const server = await prisma.mCPServer.findUnique({
        where: { id: request.serverId },
      });

      if (!server) {
        throw new ValidationError(`MCP server with ID ${request.serverId} not found`);
      }

      // Generate configuration template if not provided
      const configTemplate = this.generateConfigTemplate(server, request);

      // Create the configuration first (without secrets)
      const config = await prisma.userConfig.create({
        data: {
          userId,
          serverId: request.serverId,
          name: request.name,
          enabled: true,
          command: configTemplate.command,
          args: configTemplate.args,
          env: configTemplate.env,
          secrets: {}, // Will be updated after storing secrets
          targetClient: request.targetClient || 'claude-desktop',
          customFormat: request.customFormat,
          version: 1,
        },
        include: {
          server: true,
        },
      });

      // Handle secrets securely (store in keychain) using actual config ID
      const secretReferences = await this.storeSecretsSecurely(
        userId,
        config.id,
        request.secrets || {},
      );

      // Update configuration with secret references
      await prisma.userConfig.update({
        where: { id: config.id },
        data: { secrets: secretReferences },
      });

      // Create initial version snapshot
      await versionService.createVersionSnapshot(
        config.id,
        'Initial configuration created',
        userId,
      );

      // Return updated config
      const updatedConfig = { ...config, secrets: secretReferences };
      logger.info(`Configuration created: ${config.id}`);
      return this.mapPrismaToUserConfig(updatedConfig);
    } catch (error) {
      logger.error('Error creating configuration:', error);
      throw error;
    }
  }

  /**
   * Get all configurations for a user
   */
  async getUserConfigs(userId: string): Promise<UserConfig[]> {
    try {
      logger.debug(`Getting configurations for user ${userId}`);

      const configs = await prisma.userConfig.findMany({
        where: { userId },
        include: {
          server: true,
        },
        orderBy: {
          updatedAt: 'desc',
        },
      });

      return configs.map((config) => this.mapPrismaToUserConfig(config));
    } catch (error) {
      logger.error('Error getting user configurations:', error);
      throw new Error('Failed to retrieve configurations');
    }
  }

  /**
   * Get a specific configuration by ID
   */
  async getConfigById(configId: string, userId: string): Promise<UserConfig | null> {
    try {
      logger.debug(`Getting configuration ${configId} for user ${userId}`);

      const config = await prisma.userConfig.findFirst({
        where: {
          id: configId,
          userId, // Ensure user owns this config
        },
        include: {
          server: true,
        },
      });

      if (!config) {
        return null;
      }

      return this.mapPrismaToUserConfig(config);
    } catch (error) {
      logger.error('Error getting configuration:', error);
      throw new Error('Failed to retrieve configuration');
    }
  }

  /**
   * Update a configuration
   */
  async updateConfig(
    configId: string,
    userId: string,
    updates: UpdateConfigRequest,
  ): Promise<UserConfig> {
    try {
      logger.info(`Updating configuration ${configId} for user ${userId}`);

      // Verify the configuration exists and belongs to the user
      const existingConfig = await prisma.userConfig.findFirst({
        where: {
          id: configId,
          userId,
        },
        include: {
          server: true,
        },
      });

      if (!existingConfig) {
        throw new ValidationError('Configuration not found or access denied');
      }

      // Handle secrets if provided
      let secretReferences = existingConfig.secrets;
      if (updates.secrets) {
        // Update existing secrets and add new ones
        secretReferences = await this.updateSecretsSecurely(
          userId,
          configId,
          existingConfig.secrets || [],
          updates.secrets,
        );
      }

      // Update the configuration
      const updatedConfig = await prisma.userConfig.update({
        where: { id: configId },
        data: {
          name: updates.name,
          command: updates.command,
          args: updates.args,
          env: updates.env,
          secrets: secretReferences as any,
          targetClient: updates.targetClient,
          customFormat: updates.customFormat,
          enabled: updates.enabled,
          version: {
            increment: 1,
          },
        },
        include: {
          server: true,
        },
      });

      // Create version snapshot
      await versionService.createVersionSnapshot(configId, 'Configuration updated', userId);

      logger.info(`Configuration updated: ${configId}`);
      return this.mapPrismaToUserConfig(updatedConfig);
    } catch (error) {
      logger.error('Error updating configuration:', error);
      throw error;
    }
  }

  /**
   * Delete a configuration
   */
  async deleteConfig(configId: string, userId: string): Promise<void> {
    try {
      logger.info(`Deleting configuration ${configId} for user ${userId}`);

      // Verify ownership and delete
      const deletedCount = await prisma.userConfig.deleteMany({
        where: {
          id: configId,
          userId,
        },
      });

      if (deletedCount.count === 0) {
        throw new ValidationError('Configuration not found or access denied');
      }

      // Clean up associated secrets
      await this.deleteSecretsSecurely(userId, configId);

      logger.info(`Configuration deleted: ${configId}`);
    } catch (error) {
      logger.error('Error deleting configuration:', error);
      throw error;
    }
  }

  /**
   * Validate a configuration
   */
  async validateConfig(
    configId: string,
    userId: string,
  ): Promise<{ valid: boolean; errors: string[] }> {
    try {
      const config = await this.getConfigById(configId, userId);
      if (!config) {
        return { valid: false, errors: ['Configuration not found'] };
      }

      // Fetch the associated server
      const server = await prisma.mCPServer.findUnique({
        where: { id: config.serverId },
      });

      const errors: string[] = [];

      // Basic validation
      if (!config.command) {
        errors.push('Command is required');
      }

      if (!server) {
        errors.push('Associated MCP server not found');
      }

      // Check required parameters
      if (server?.requiredParams && Array.isArray(server.requiredParams)) {
        for (const param of server.requiredParams as any[]) {
          const envValue = config.env?.[param.key];
          if (!envValue && param.required) {
            errors.push(`Required parameter '${param.key}' is missing`);
          }
        }
      }

      return {
        valid: errors.length === 0,
        errors,
      };
    } catch (error) {
      logger.error('Error validating configuration:', error);
      return {
        valid: false,
        errors: ['Validation failed due to internal error'],
      };
    }
  }

  /**
   * Generate configuration template from server metadata
   */
  private generateConfigTemplate(server: any, request: CreateConfigRequest): any {
    const template = server.configTemplate || {};

    return {
      command: request.command || template.command || 'node',
      args: request.args || template.args || ['./dist/index.js'],
      env: {
        ...template.env,
        ...request.env,
      },
    };
  }

  /**
   * Store secrets securely in keychain
   */
  private async storeSecretsSecurely(
    userId: string,
    configId: string,
    secrets: Record<string, string>,
  ): Promise<any> {
    const references: any = {};

    for (const [key, value] of Object.entries(secrets)) {
      try {
        const secretRef = await keychainService.storeSecret(
          userId,
          configId,
          key,
          value,
          `Secret for ${key}`,
        );
        references[key] = secretRef;
      } catch (error) {
        logger.error(`Failed to store secret ${key}:`, error);
        throw new Error(`Failed to securely store secret: ${key}`);
      }
    }

    return references;
  }

  /**
   * Update secrets securely
   */
  private async updateSecretsSecurely(
    userId: string,
    configId: string,
    existingRefs: any,
    newSecrets: Record<string, string>,
  ): Promise<any> {
    // Start with existing references
    const updatedRefs = { ...existingRefs };

    for (const [key, value] of Object.entries(newSecrets)) {
      try {
        // Check if secret already exists
        if (existingRefs[key]) {
          // Update existing secret
          const secretRef = await keychainService.updateSecret(
            userId,
            configId,
            key,
            value,
            `Secret for ${key}`,
          );
          updatedRefs[key] = secretRef;
        } else {
          // Store new secret
          const secretRef = await keychainService.storeSecret(
            userId,
            configId,
            key,
            value,
            `Secret for ${key}`,
          );
          updatedRefs[key] = secretRef;
        }
      } catch (error) {
        logger.error(`Failed to update secret ${key}:`, error);
        throw new Error(`Failed to securely update secret: ${key}`);
      }
    }

    return updatedRefs;
  }

  /**
   * Delete secrets from keychain
   */
  private async deleteSecretsSecurely(userId: string, configId: string): Promise<void> {
    try {
      await keychainService.deleteConfigSecrets(userId, configId);
    } catch (error) {
      logger.error(`Failed to delete secrets for config ${configId}:`, error);
      // Don't throw - config deletion should succeed even if secrets cleanup fails
    }
  }

  /**
   * Map Prisma config to UserConfig type
   */
  private mapPrismaToUserConfig(config: any): UserConfig {
    return {
      id: config.id,
      userId: config.userId,
      serverId: config.serverId,
      name: config.name,
      enabled: config.enabled,
      command: config.command,
      args: config.args || [],
      env: config.env || {},
      secrets: config.secrets || [],
      targetClient: config.targetClient || 'claude-desktop',
      customFormat: config.customFormat,
      createdAt: config.createdAt,
      updatedAt: config.updatedAt,
      version: config.version,
    };
  }
}

// Export singleton instance
export const configurationService = new ConfigurationService();
