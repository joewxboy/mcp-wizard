import { prisma } from '../db/database';
import { logger } from '../utils/logger';

export interface VersionInfo {
  id: string;
  version: number;
  changeDescription: string;
  createdAt: Date;
  createdBy: string;
  config: any; // The complete config snapshot
}

export class VersionService {
  /**
   * Get all versions for a configuration
   */
  async getConfigVersions(configId: string, userId: string): Promise<VersionInfo[]> {
    try {
      logger.debug(`Getting versions for config ${configId} owned by ${userId}`);

      // First verify the user owns this config
      const config = await prisma.userConfig.findFirst({
        where: {
          id: configId,
          userId,
        },
      });

      if (!config) {
        throw new Error('Configuration not found or access denied');
      }

      const versions = await prisma.configVersion.findMany({
        where: { configId },
        orderBy: { version: 'desc' },
      });

      return versions.map((v) => ({
        id: v.id,
        version: v.version,
        changeDescription: v.changeDescription || 'No description',
        createdAt: v.createdAt,
        createdBy: v.createdBy,
        config: v.config,
      }));
    } catch (error) {
      logger.error('Error getting config versions:', error);
      throw new Error('Failed to retrieve configuration versions');
    }
  }

  /**
   * Get a specific version of a configuration
   */
  async getConfigVersion(
    configId: string,
    version: number,
    userId: string,
  ): Promise<VersionInfo | null> {
    try {
      logger.debug(`Getting version ${version} for config ${configId} owned by ${userId}`);

      // First verify the user owns this config
      const config = await prisma.userConfig.findFirst({
        where: {
          id: configId,
          userId,
        },
      });

      if (!config) {
        throw new Error('Configuration not found or access denied');
      }

      const versionData = await prisma.configVersion.findFirst({
        where: {
          configId,
          version,
        },
      });

      if (!versionData) {
        return null;
      }

      return {
        id: versionData.id,
        version: versionData.version,
        changeDescription: versionData.changeDescription || 'No description',
        createdAt: versionData.createdAt,
        createdBy: versionData.createdBy,
        config: versionData.config,
      };
    } catch (error) {
      logger.error('Error getting config version:', error);
      throw new Error('Failed to retrieve configuration version');
    }
  }

  /**
   * Rollback configuration to a specific version
   */
  async rollbackConfig(
    configId: string,
    version: number,
    userId: string,
    rollbackReason?: string,
  ): Promise<any> {
    try {
      logger.info(`Rolling back config ${configId} to version ${version} for user ${userId}`);

      // Get the target version
      const targetVersion = await this.getConfigVersion(configId, version, userId);
      if (!targetVersion) {
        throw new Error(`Version ${version} not found for configuration ${configId}`);
      }

      // Get current config to verify ownership
      const currentConfig = await prisma.userConfig.findFirst({
        where: {
          id: configId,
          userId,
        },
      });

      if (!currentConfig) {
        throw new Error('Configuration not found or access denied');
      }

      // Extract the config data from the version snapshot
      const versionedConfig = targetVersion.config;

      // Update the current configuration with the versioned data
      const updatedConfig = await prisma.userConfig.update({
        where: { id: configId },
        data: {
          name: versionedConfig.name,
          command: versionedConfig.command,
          args: versionedConfig.args,
          env: versionedConfig.env,
          secrets: versionedConfig.secrets,
          targetClient: versionedConfig.targetClient,
          customFormat: versionedConfig.customFormat,
          // Keep the current version number but increment it
          version: {
            increment: 1,
          },
        },
        include: {
          server: true,
        },
      });

      // Create a new version snapshot for the rollback
      const changeDescription =
        rollbackReason || `Rolled back to version ${version}: ${targetVersion.changeDescription}`;

      await prisma.configVersion.create({
        data: {
          configId,
          version: updatedConfig.version,
          config: updatedConfig,
          changeDescription,
          createdBy: userId,
        },
      });

      logger.info(`Configuration ${configId} rolled back to version ${version}`);

      return {
        configId,
        rolledBackToVersion: version,
        newVersion: updatedConfig.version,
        changeDescription,
      };
    } catch (error) {
      logger.error('Error rolling back configuration:', error);
      throw error;
    }
  }

  /**
   * Compare two versions of a configuration
   */
  async compareVersions(
    configId: string,
    version1: number,
    version2: number,
    userId: string,
  ): Promise<any> {
    try {
      logger.debug(`Comparing versions ${version1} and ${version2} for config ${configId}`);

      const [v1, v2] = await Promise.all([
        this.getConfigVersion(configId, version1, userId),
        this.getConfigVersion(configId, version2, userId),
      ]);

      if (!v1 || !v2) {
        throw new Error('One or both versions not found');
      }

      // Perform a deep comparison of the configurations
      const differences = this.compareConfigurations(v1.config, v2.config);

      return {
        configId,
        versionsCompared: {
          v1: { version: version1, createdAt: v1.createdAt, description: v1.changeDescription },
          v2: { version: version2, createdAt: v2.createdAt, description: v2.changeDescription },
        },
        differences,
        hasDifferences: Object.keys(differences).length > 0,
      };
    } catch (error) {
      logger.error('Error comparing versions:', error);
      throw new Error('Failed to compare configuration versions');
    }
  }

  /**
   * Delete old versions (keep only the most recent N versions)
   */
  async cleanupOldVersions(configId: string, keepVersions: number = 10): Promise<number> {
    try {
      logger.debug(
        `Cleaning up old versions for config ${configId}, keeping ${keepVersions} versions`,
      );

      // Get all versions for this config
      const allVersions = await prisma.configVersion.findMany({
        where: { configId },
        orderBy: { version: 'desc' },
        select: { id: true, version: true },
      });

      if (allVersions.length <= keepVersions) {
        return 0; // No cleanup needed
      }

      // Keep the most recent versions, delete the rest
      const versionsToDelete = allVersions.slice(keepVersions);
      const deletedCount = await prisma.configVersion.deleteMany({
        where: {
          id: { in: versionsToDelete.map((v) => v.id) },
        },
      });

      logger.info(`Cleaned up ${deletedCount.count} old versions for config ${configId}`);
      return deletedCount.count;
    } catch (error) {
      logger.error('Error cleaning up old versions:', error);
      throw new Error('Failed to cleanup old versions');
    }
  }

  /**
   * Create a version snapshot (internal method)
   */
  async createVersionSnapshot(
    configId: string,
    changeDescription: string,
    userId: string,
  ): Promise<void> {
    try {
      const config = await prisma.userConfig.findUnique({
        where: { id: configId },
      });

      if (config) {
        await prisma.configVersion.create({
          data: {
            configId,
            version: config.version,
            config: config as any,
            changeDescription,
            createdBy: userId,
          },
        });

        // Optionally cleanup old versions
        await this.cleanupOldVersions(configId);
      }
    } catch (error) {
      logger.error('Error creating version snapshot:', error);
      // Don't throw - version snapshots are not critical
    }
  }

  /**
   * Compare two configuration objects and return differences
   */
  private compareConfigurations(config1: any, config2: any): any {
    const differences: any = {};

    // Compare simple properties
    const simpleProps = ['name', 'command', 'targetClient', 'customFormat', 'enabled'];
    for (const prop of simpleProps) {
      if (config1[prop] !== config2[prop]) {
        differences[prop] = {
          from: config1[prop],
          to: config2[prop],
        };
      }
    }

    // Compare arrays
    if (JSON.stringify(config1.args) !== JSON.stringify(config2.args)) {
      differences.args = {
        from: config1.args,
        to: config2.args,
      };
    }

    // Compare environment variables
    const env1 = config1.env || {};
    const env2 = config2.env || {};
    const envDiff: any = {};

    const allEnvKeys = new Set([...Object.keys(env1), ...Object.keys(env2)]);
    for (const key of allEnvKeys) {
      if (env1[key] !== env2[key]) {
        envDiff[key] = {
          from: env1[key],
          to: env2[key],
        };
      }
    }

    if (Object.keys(envDiff).length > 0) {
      differences.env = envDiff;
    }

    // Compare secrets (just check if they exist, don't compare values)
    const secrets1 = config1.secrets || {};
    const secrets2 = config2.secrets || {};
    const secretKeys1 = Object.keys(secrets1);
    const secretKeys2 = Object.keys(secrets2);

    if (
      secretKeys1.length !== secretKeys2.length ||
      !secretKeys1.every((key) => secretKeys2.includes(key))
    ) {
      differences.secrets = {
        from: secretKeys1,
        to: secretKeys2,
      };
    }

    return differences;
  }
}

// Export singleton instance
export const versionService = new VersionService();
