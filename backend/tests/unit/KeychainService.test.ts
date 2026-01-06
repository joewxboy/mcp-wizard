import { KeychainService } from '../../src/services/KeychainService';
import keytar from 'keytar';

// Mock keytar
jest.mock('keytar', () => ({
  setPassword: jest.fn(),
  getPassword: jest.fn(),
  deletePassword: jest.fn(),
  findCredentials: jest.fn(),
}));

const mockKeytar = keytar as jest.Mocked<typeof keytar>;

describe('KeychainService', () => {
  let keychainService: KeychainService;

  beforeEach(() => {
    jest.clearAllMocks();
    keychainService = new KeychainService();
  });

  describe('storeSecret', () => {
    it('should store secret successfully', async () => {
      const userId = 'test-user-123';
      const configId = 'config-456';
      const key = 'API_KEY';
      const value = 'secret-value';
      const description = 'API Key for service';

      mockKeytar.setPassword.mockResolvedValue(true);

      const result = await keychainService.storeSecret(
        userId,
        configId,
        key,
        value,
        description
      );

      expect(mockKeytar.setPassword).toHaveBeenCalledWith(
        'mcp-wizard',
        `${userId}:${configId}:${key}`,
        expect.any(String)
      );

      expect(result).toMatchObject({
        keychainId: expect.stringContaining(`${userId}_${configId}_${key}`),
        description,
      });

      // Verify the stored data structure
      const storedData = JSON.parse(mockKeytar.setPassword.mock.calls[0][2]);
      expect(storedData.description).toBe(description);
      expect(storedData.createdAt).toBeDefined();
    });

    it('should throw error if keytar fails', async () => {
      mockKeytar.setPassword.mockResolvedValue(false);

      await expect(keychainService.storeSecret('user', 'config', 'key', 'value'))
        .rejects
        .toThrow('Failed to store secret securely');
    });
  });

  describe('getSecret', () => {
    it('should retrieve secret successfully', async () => {
      const userId = 'test-user-123';
      const configId = 'config-456';
      const key = 'API_KEY';
      const storedValue = 'encrypted-secret';

      const metadata = {
        value: storedValue,
        description: 'API Key',
        createdAt: new Date().toISOString(),
      };

      mockKeytar.getPassword.mockResolvedValue(JSON.stringify(metadata));

      // Mock decrypt to return the original value
      const decryptSpy = jest.spyOn(keychainService as any, 'decrypt');
      decryptSpy.mockReturnValue('original-secret');

      const result = await keychainService.getSecret(userId, configId, key);

      expect(mockKeytar.getPassword).toHaveBeenCalledWith(
        'mcp-wizard',
        `${userId}:${configId}:${key}`
      );

      expect(result).toBe('original-secret');
      expect(decryptSpy).toHaveBeenCalledWith(storedValue);
    });

    it('should return null if secret not found', async () => {
      mockKeytar.getPassword.mockResolvedValue(null);

      const result = await keychainService.getSecret('user', 'config', 'key');

      expect(result).toBeNull();
    });
  });

  describe('updateSecret', () => {
    it('should update existing secret', async () => {
      const userId = 'test-user-123';
      const configId = 'config-456';
      const key = 'API_KEY';
      const newValue = 'new-secret';
      const newDescription = 'Updated API Key';

      const existingMetadata = {
        value: 'old-encrypted',
        description: 'Old description',
        createdAt: new Date().toISOString(),
      };

      mockKeytar.getPassword.mockResolvedValue(JSON.stringify(existingMetadata));
      mockKeytar.setPassword.mockResolvedValue(true);

      const result = await keychainService.updateSecret(
        userId,
        configId,
        key,
        newValue,
        newDescription
      );

      expect(mockKeytar.getPassword).toHaveBeenCalled();
      expect(mockKeytar.setPassword).toHaveBeenCalled();

      expect(result.description).toBe(newDescription);
    });

    it('should throw error if secret not found', async () => {
      mockKeytar.getPassword.mockResolvedValue(null);

      await expect(keychainService.updateSecret('user', 'config', 'key', 'value'))
        .rejects
        .toThrow('Secret not found');
    });
  });

  describe('deleteSecret', () => {
    it('should delete secret successfully', async () => {
      mockKeytar.deletePassword.mockResolvedValue(true);

      const result = await keychainService.deleteSecret('user', 'config', 'key');

      expect(mockKeytar.deletePassword).toHaveBeenCalledWith(
        'mcp-wizard',
        'user:config:key'
      );

      expect(result).toBe(true);
    });

    it('should return false if secret not found', async () => {
      mockKeytar.deletePassword.mockResolvedValue(false);

      const result = await keychainService.deleteSecret('user', 'config', 'key');

      expect(result).toBe(false);
    });
  });

  describe('deleteConfigSecrets', () => {
    it('should delete all secrets for a configuration', async () => {
      const userId = 'test-user-123';
      const configId = 'config-456';

      const mockCredentials = [
        { account: `${userId}:${configId}:API_KEY`, password: '{}' },
        { account: `${userId}:${configId}:SECRET_KEY`, password: '{}' },
        { account: `other-user:other-config:KEY`, password: '{}' }, // Should not be deleted
      ];

      mockKeytar.findCredentials.mockResolvedValue(mockCredentials);
      mockKeytar.deletePassword.mockResolvedValue(true);

      const result = await keychainService.deleteConfigSecrets(userId, configId);

      expect(mockKeytar.findCredentials).toHaveBeenCalledWith('mcp-wizard');
      expect(mockKeytar.deletePassword).toHaveBeenCalledTimes(2);
      expect(result).toBe(2);
    });
  });

  describe('listConfigSecrets', () => {
    it('should list all secrets for a configuration', async () => {
      const userId = 'test-user-123';
      const configId = 'config-456';

      const mockCredentials = [
        {
          account: `${userId}:${configId}:API_KEY`,
          password: JSON.stringify({
            description: 'API Key',
            createdAt: new Date().toISOString(),
          }),
        },
        {
          account: `${userId}:${configId}:SECRET_KEY`,
          password: JSON.stringify({
            description: 'Secret Key',
            createdAt: new Date().toISOString(),
          }),
        },
      ];

      mockKeytar.findCredentials.mockResolvedValue(mockCredentials);

      const result = await keychainService.listConfigSecrets(userId, configId);

      expect(result).toHaveLength(2);
      expect(result[0]).toMatchObject({
        keychainId: expect.stringContaining(`${userId}_${configId}_API_KEY`),
        description: 'API Key',
      });
      expect(result[1]).toMatchObject({
        keychainId: expect.stringContaining(`${userId}_${configId}_SECRET_KEY`),
        description: 'Secret Key',
      });
    });
  });

  describe('isKeychainAvailable', () => {
    it('should return true when keychain works', async () => {
      mockKeytar.setPassword.mockResolvedValue(true);
      mockKeytar.getPassword.mockResolvedValue('test');
      mockKeytar.deletePassword.mockResolvedValue(true);

      const result = await keychainService.isKeychainAvailable();

      expect(result).toBe(true);
      expect(mockKeytar.setPassword).toHaveBeenCalled();
      expect(mockKeytar.getPassword).toHaveBeenCalled();
      expect(mockKeytar.deletePassword).toHaveBeenCalled();
    });

    it('should return false when keychain fails', async () => {
      mockKeytar.setPassword.mockRejectedValue(new Error('Keychain unavailable'));

      const result = await keychainService.isKeychainAvailable();

      expect(result).toBe(false);
    });
  });

  describe('encryption/decryption', () => {
    it('should encrypt and decrypt values correctly', () => {
      const service = keychainService as any; // Access private methods
      const originalValue = 'test-secret-value';

      const encrypted = service.encrypt(originalValue);
      const decrypted = service.decrypt(encrypted);

      expect(encrypted).not.toBe(originalValue);
      expect(decrypted).toBe(originalValue);
      expect(encrypted).toContain('eyJ'); // Base64 encoded
    });

    it('should throw error for invalid encrypted data', () => {
      const service = keychainService as any;

      expect(() => service.decrypt('invalid-data')).toThrow();
    });
  });
});