import keytar from 'keytar';
import { logger } from '../utils/logger';
import crypto from 'crypto';

export interface SecretReference {
  keychainId: string;
  description: string;
  createdAt: Date;
}

export interface StoredSecret {
  value: string;
  description: string;
  createdAt: Date;
  lastAccessed?: Date;
}

export class KeychainService {
  private static readonly SERVICE_NAME = 'mcp-wizard';
  private static readonly ENCRYPTION_KEY =
    process.env.KEYCHAIN_ENCRYPTION_KEY || 'default-key-change-in-production-32-chars';

  /**
   * Store a secret securely in the system keychain
   */
  async storeSecret(
    userId: string,
    configId: string,
    key: string,
    value: string,
    description?: string,
  ): Promise<SecretReference> {
    try {
      const keychainId = this.generateKeychainId(userId, configId, key);
      const accountName = `${userId}:${configId}:${key}`;

      // Encrypt the value before storing
      const encryptedValue = this.encrypt(value);

      // Store metadata in the encrypted value
      const metadata = {
        value: encryptedValue,
        description: description || `Secret for ${key}`,
        createdAt: new Date().toISOString(),
      };

      await keytar.setPassword(KeychainService.SERVICE_NAME, accountName, JSON.stringify(metadata));

      logger.info(`Secret stored securely for user ${userId}, config ${configId}, key ${key}`);

      return {
        keychainId,
        description: metadata.description,
        createdAt: new Date(metadata.createdAt),
      };
    } catch (error) {
      logger.error('Error storing secret in keychain:', error);
      throw new Error('Failed to store secret securely');
    }
  }

  /**
   * Retrieve a secret from the system keychain
   */
  async getSecret(userId: string, configId: string, key: string): Promise<string | null> {
    try {
      const accountName = `${userId}:${configId}:${key}`;

      const storedData = await keytar.getPassword(KeychainService.SERVICE_NAME, accountName);

      if (!storedData) {
        return null;
      }

      const metadata: StoredSecret = JSON.parse(storedData);

      // Update last accessed time
      metadata.lastAccessed = new Date();
      await keytar.setPassword(KeychainService.SERVICE_NAME, accountName, JSON.stringify(metadata));

      // Decrypt and return the value
      const decryptedValue = this.decrypt(metadata.value);

      logger.debug(`Secret retrieved for user ${userId}, config ${configId}, key ${key}`);

      return decryptedValue;
    } catch (error) {
      logger.error('Error retrieving secret from keychain:', error);
      throw new Error('Failed to retrieve secret');
    }
  }

  /**
   * Update an existing secret
   */
  async updateSecret(
    userId: string,
    configId: string,
    key: string,
    newValue: string,
    newDescription?: string,
  ): Promise<SecretReference> {
    try {
      const accountName = `${userId}:${configId}:${key}`;

      // Get existing data
      const existingData = await keytar.getPassword(KeychainService.SERVICE_NAME, accountName);

      if (!existingData) {
        throw new Error('Secret not found');
      }

      const metadata: StoredSecret = JSON.parse(existingData);

      // Update the value and metadata
      metadata.value = this.encrypt(newValue);
      if (newDescription) {
        metadata.description = newDescription;
      }
      metadata.lastAccessed = new Date();

      await keytar.setPassword(KeychainService.SERVICE_NAME, accountName, JSON.stringify(metadata));

      logger.info(`Secret updated for user ${userId}, config ${configId}, key ${key}`);

      return {
        keychainId: this.generateKeychainId(userId, configId, key),
        description: metadata.description,
        createdAt: new Date(metadata.createdAt),
      };
    } catch (error) {
      logger.error('Error updating secret:', error);
      throw new Error('Failed to update secret');
    }
  }

  /**
   * Delete a secret from the keychain
   */
  async deleteSecret(userId: string, configId: string, key: string): Promise<boolean> {
    try {
      const accountName = `${userId}:${configId}:${key}`;

      const success = await keytar.deletePassword(KeychainService.SERVICE_NAME, accountName);

      if (success) {
        logger.info(`Secret deleted for user ${userId}, config ${configId}, key ${key}`);
      } else {
        logger.warn(
          `Secret not found for deletion: user ${userId}, config ${configId}, key ${key}`,
        );
      }

      return success;
    } catch (error) {
      logger.error('Error deleting secret:', error);
      throw new Error('Failed to delete secret');
    }
  }

  /**
   * Delete all secrets for a configuration
   */
  async deleteConfigSecrets(userId: string, configId: string): Promise<number> {
    try {
      logger.info(`Deleting all secrets for config ${configId} owned by user ${userId}`);

      // Get all keychain entries for this service
      const credentials = await keytar.findCredentials(KeychainService.SERVICE_NAME);

      let deletedCount = 0;
      for (const credential of credentials) {
        // Parse the account name to check ownership
        const [credUserId, credConfigId] = credential.account.split(':');

        if (credUserId === userId && credConfigId === configId) {
          await keytar.deletePassword(KeychainService.SERVICE_NAME, credential.account);
          deletedCount++;
        }
      }

      logger.info(`Deleted ${deletedCount} secrets for config ${configId}`);
      return deletedCount;
    } catch (error) {
      logger.error('Error deleting config secrets:', error);
      throw new Error('Failed to delete configuration secrets');
    }
  }

  /**
   * List all secrets for a configuration (without values)
   */
  async listConfigSecrets(userId: string, configId: string): Promise<SecretReference[]> {
    try {
      const credentials = await keytar.findCredentials(KeychainService.SERVICE_NAME);

      const secrets: SecretReference[] = [];

      for (const credential of credentials) {
        const [credUserId, credConfigId, key] = credential.account.split(':');

        if (credUserId === userId && credConfigId === configId) {
          const metadata: StoredSecret = JSON.parse(credential.password);
          secrets.push({
            keychainId: this.generateKeychainId(userId, configId, key),
            description: metadata.description,
            createdAt: new Date(metadata.createdAt),
          });
        }
      }

      return secrets;
    } catch (error) {
      logger.error('Error listing config secrets:', error);
      throw new Error('Failed to list configuration secrets');
    }
  }

  /**
   * Check if keychain is available on this system
   */
  async isKeychainAvailable(): Promise<boolean> {
    try {
      // Try to store and retrieve a test value
      const testAccount = 'test-keychain-availability';
      const testValue = 'test';

      await keytar.setPassword(KeychainService.SERVICE_NAME, testAccount, testValue);
      const retrieved = await keytar.getPassword(KeychainService.SERVICE_NAME, testAccount);
      await keytar.deletePassword(KeychainService.SERVICE_NAME, testAccount);

      return retrieved === testValue;
    } catch (error) {
      logger.warn('Keychain not available:', error);
      return false;
    }
  }

  /**
   * Generate a unique keychain ID
   */
  private generateKeychainId(userId: string, configId: string, key: string): string {
    return `secret_${userId}_${configId}_${key}_${Date.now()}`;
  }

  /**
   * Encrypt a value using AES-256-GCM
   */
  private encrypt(value: string): string {
    try {
      const key = crypto.scryptSync(KeychainService.ENCRYPTION_KEY, 'salt', 32);
      const _iv = crypto.randomBytes(16);
      const cipher = crypto.createCipher('aes-256-gcm', key);

      let encrypted = cipher.update(value, 'utf8', 'hex');
      encrypted += cipher.final('hex');

      const authTag = cipher.getAuthTag();

      // Combine IV, auth tag, and encrypted data
      return Buffer.concat([_iv, authTag, Buffer.from(encrypted, 'hex')]).toString('base64');
    } catch (error) {
      logger.error('Error encrypting value:', error);
      throw new Error('Encryption failed');
    }
  }

  /**
   * Decrypt a value using AES-256-GCM
   */
  private decrypt(encryptedData: string): string {
    try {
      const key = crypto.scryptSync(KeychainService.ENCRYPTION_KEY, 'salt', 32);
      const buffer = Buffer.from(encryptedData, 'base64');

      // Extract IV (not used in decryption), auth tag, and encrypted data
      const authTag = buffer.subarray(16, 32);
      const encrypted = buffer.subarray(32);

      const decipher = crypto.createDecipher('aes-256-gcm', key);
      decipher.setAuthTag(authTag);

      let decrypted = decipher.update(encrypted);
      decrypted = Buffer.concat([decrypted, decipher.final()]);

      return decrypted.toString('utf8');
    } catch (error) {
      logger.error('Error decrypting value:', error);
      throw new Error('Decryption failed');
    }
  }
}

// Export singleton instance
export const keychainService = new KeychainService();
