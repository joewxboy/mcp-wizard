import { ConfigurationService } from '../../src/services/ConfigurationService';
import { prisma } from '../../src/db/database';
import { keychainService } from '../../src/services/KeychainService';
import { versionService } from '../../src/services/VersionService';
import { ValidationError } from '@mcp-wizard/shared';

const mockPrisma = prisma as jest.Mocked<typeof prisma>;
const mockKeychain = keychainService as jest.Mocked<typeof keychainService>;
const mockVersion = versionService as jest.Mocked<typeof versionService>;

describe('ConfigurationService', () => {
  let configService: ConfigurationService;

  beforeEach(() => {
    jest.clearAllMocks();
    configService = new ConfigurationService();
  });

  describe('createConfig', () => {
    const mockUserId = 'test-user-123';
    const mockRequest = {
      serverId: 'test-server-456',
      name: 'Test Configuration',
      command: 'node',
      args: ['server.js'],
      env: { PORT: '3000' },
      secrets: { API_KEY: 'secret-key' },
    };

    it('should create a configuration successfully', async () => {
      // Mock server lookup
      mockPrisma.mCPServer.findUnique.mockResolvedValue(global.testUtils.mockServer);

      // Mock config creation
      const mockConfig = {
        id: 'config-123',
        userId: mockUserId,
        serverId: mockRequest.serverId,
        name: mockRequest.name,
        command: mockRequest.command,
        args: mockRequest.args,
        env: mockRequest.env,
        secrets: { API_KEY: { keychainId: 'secret-123' } },
        targetClient: 'claude-desktop',
        customFormat: null,
        version: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      mockPrisma.userConfig.create.mockResolvedValue(mockConfig);

      // Mock keychain operations
      mockKeychain.storeSecret.mockResolvedValue({
        keychainId: 'secret-123',
        description: 'Secret for API_KEY',
        createdAt: new Date(),
      });

      // Mock version snapshot
      mockVersion.createVersionSnapshot.mockResolvedValue(undefined);

      const result = await configService.createConfig(mockUserId, mockRequest);

      expect(mockPrisma.mCPServer.findUnique).toHaveBeenCalledWith({
        where: { id: mockRequest.serverId },
      });

      expect(mockPrisma.userConfig.create).toHaveBeenCalled();
      expect(mockKeychain.storeSecret).toHaveBeenCalledWith(
        mockUserId,
        expect.any(String),
        'API_KEY',
        'secret-key',
        'Secret for API_KEY'
      );
      expect(mockVersion.createVersionSnapshot).toHaveBeenCalled();

      expect(result).toMatchObject({
        id: 'config-123',
        name: 'Test Configuration',
        command: 'node',
      });
    });

    it('should throw ValidationError if server not found', async () => {
      mockPrisma.mCPServer.findUnique.mockResolvedValue(null);

      await expect(configService.createConfig(mockUserId, mockRequest))
        .rejects
        .toThrow(ValidationError);

      expect(mockPrisma.userConfig.create).not.toHaveBeenCalled();
    });

    it('should handle keychain storage failures', async () => {
      mockPrisma.mCPServer.findUnique.mockResolvedValue(global.testUtils.mockServer);
      mockKeychain.storeSecret.mockRejectedValue(new Error('Keychain error'));

      await expect(configService.createConfig(mockUserId, mockRequest))
        .rejects
        .toThrow('Failed to securely store secret: API_KEY');

      expect(mockPrisma.userConfig.create).not.toHaveBeenCalled();
    });
  });

  describe('getUserConfigs', () => {
    it('should return user configurations with server data', async () => {
      const mockUserId = 'test-user-123';
      const mockConfigs = [
        {
          id: 'config-1',
          userId: mockUserId,
          serverId: 'server-1',
          name: 'Config 1',
          command: 'node',
          args: [],
          env: {},
          secrets: {},
          targetClient: 'claude-desktop',
          customFormat: null,
          version: 1,
          createdAt: new Date(),
          updatedAt: new Date(),
          server: global.testUtils.mockServer,
        },
      ];

      mockPrisma.userConfig.findMany.mockResolvedValue(mockConfigs);

      const result = await configService.getUserConfigs(mockUserId);

      expect(mockPrisma.userConfig.findMany).toHaveBeenCalledWith({
        where: { userId: mockUserId },
        include: { server: true },
        orderBy: { updatedAt: 'desc' },
      });

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        id: 'config-1',
        name: 'Config 1',
      });
    });
  });

  describe('getConfigById', () => {
    it('should return configuration if found and owned by user', async () => {
      const mockUserId = 'test-user-123';
      const mockConfigId = 'config-123';
      const mockConfig = {
        id: mockConfigId,
        userId: mockUserId,
        serverId: 'server-1',
        name: 'Test Config',
        command: 'node',
        args: [],
        env: {},
        secrets: {},
        targetClient: 'claude-desktop',
        customFormat: null,
        version: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
        server: global.testUtils.mockServer,
      };

      mockPrisma.userConfig.findFirst.mockResolvedValue(mockConfig);

      const result = await configService.getConfigById(mockConfigId, mockUserId);

      expect(mockPrisma.userConfig.findFirst).toHaveBeenCalledWith({
        where: {
          id: mockConfigId,
          userId: mockUserId,
        },
        include: { server: true },
      });

      expect(result).toMatchObject({
        id: mockConfigId,
        name: 'Test Config',
      });
    });

    it('should return null if configuration not found', async () => {
      mockPrisma.userConfig.findFirst.mockResolvedValue(null);

      const result = await configService.getConfigById('non-existent', 'user-123');

      expect(result).toBeNull();
    });
  });

  describe('updateConfig', () => {
    it('should update configuration successfully', async () => {
      const mockUserId = 'test-user-123';
      const mockConfigId = 'config-123';
      const mockUpdates = {
        name: 'Updated Config',
        env: { NEW_VAR: 'value' },
      };

      const existingConfig = {
        id: mockConfigId,
        userId: mockUserId,
        serverId: 'server-1',
        name: 'Old Name',
        command: 'node',
        args: [],
        env: {},
        secrets: {},
        version: 1,
      };

      const updatedConfig = {
        ...existingConfig,
        name: mockUpdates.name,
        env: mockUpdates.env,
        version: 2,
        server: global.testUtils.mockServer,
      };

      mockPrisma.userConfig.findFirst.mockResolvedValue(existingConfig);
      mockPrisma.userConfig.update.mockResolvedValue(updatedConfig);
      mockVersion.createVersionSnapshot.mockResolvedValue(undefined);

      const result = await configService.updateConfig(mockConfigId, mockUserId, mockUpdates);

      expect(mockPrisma.userConfig.update).toHaveBeenCalled();
      expect(mockVersion.createVersionSnapshot).toHaveBeenCalledWith(
        mockConfigId,
        'Configuration updated',
        mockUserId
      );

      expect(result.name).toBe('Updated Config');
      expect(result.version).toBe(2);
    });

    it('should throw error if configuration not found', async () => {
      mockPrisma.userConfig.findFirst.mockResolvedValue(null);

      await expect(configService.updateConfig('non-existent', 'user-123', {}))
        .rejects
        .toThrow(ValidationError);
    });
  });

  describe('deleteConfig', () => {
    it('should delete configuration successfully', async () => {
      const mockUserId = 'test-user-123';
      const mockConfigId = 'config-123';

      mockPrisma.userConfig.deleteMany.mockResolvedValue({ count: 1 });
      mockKeychain.deleteConfigSecrets.mockResolvedValue(1);

      await configService.deleteConfig(mockConfigId, mockUserId);

      expect(mockPrisma.userConfig.deleteMany).toHaveBeenCalledWith({
        where: {
          id: mockConfigId,
          userId: mockUserId,
        },
      });

      expect(mockKeychain.deleteConfigSecrets).toHaveBeenCalledWith(mockUserId, mockConfigId);
    });

    it('should throw error if configuration not found', async () => {
      mockPrisma.userConfig.deleteMany.mockResolvedValue({ count: 0 });

      await expect(configService.deleteConfig('non-existent', 'user-123'))
        .rejects
        .toThrow(ValidationError);
    });
  });

  describe('validateConfig', () => {
    it('should return valid result for valid configuration', async () => {
      const mockConfig = {
        id: 'config-123',
        name: 'Test Config',
        command: 'node',
        server: global.testUtils.mockServer,
      };

      mockPrisma.userConfig.findFirst.mockResolvedValue(mockConfig as any);

      const result = await configService.validateConfig('config-123', 'user-123');

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should return invalid result with errors', async () => {
      const mockConfig = {
        id: 'config-123',
        name: 'Test Config',
        command: '', // Invalid - empty command
        server: null, // Invalid - no server
      };

      mockPrisma.userConfig.findFirst.mockResolvedValue(mockConfig as any);

      const result = await configService.validateConfig('config-123', 'user-123');

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Command is required');
      expect(result.errors).toContain('Associated MCP server not found');
    });
  });
});