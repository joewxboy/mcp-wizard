import express from 'express';
import { keychainService } from '../services/KeychainService';
import { authenticate } from '../middleware/auth.middleware';
import { logger } from '../utils/logger';

const router = express.Router();

// Apply authentication to all routes
router.use(authenticate);

// Store a secret
router.post('/store',
  express.json(),
  async (req, res) => {
    try {
      const userId = req.user!.userId;
      const { configId, key, value, description } = req.body;

      if (!configId || !key || !value) {
        return res.status(400).json({
          error: 'Missing required fields',
          message: 'configId, key, and value are required',
        });
      }

      const secretRef = await keychainService.storeSecret(
        userId,
        configId,
        key,
        value,
        description
      );

      res.status(201).json({
        secret: secretRef,
        message: 'Secret stored securely',
      });
    } catch (error) {
      logger.error('Error storing secret:', error);
      res.status(500).json({
        error: 'Failed to store secret',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
);

// Retrieve a secret
router.get('/:configId/:key', async (req, res) => {
  try {
    const userId = req.user!.userId;
    const { configId, key } = req.params;

    const value = await keychainService.getSecret(userId, configId, key);

    if (value === null) {
      return res.status(404).json({
        error: 'Secret not found',
      });
    }

    res.json({
      key,
      value,
      message: 'Secret retrieved successfully',
    });
  } catch (error) {
    logger.error('Error retrieving secret:', error);
    res.status(500).json({
      error: 'Failed to retrieve secret',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// Update a secret
router.put('/update',
  express.json(),
  async (req, res) => {
    try {
      const userId = req.user!.userId;
      const { configId, key, value, description } = req.body;

      if (!configId || !key || !value) {
        return res.status(400).json({
          error: 'Missing required fields',
          message: 'configId, key, and value are required',
        });
      }

      const secretRef = await keychainService.updateSecret(
        userId,
        configId,
        key,
        value,
        description
      );

      res.json({
        secret: secretRef,
        message: 'Secret updated successfully',
      });
    } catch (error) {
      logger.error('Error updating secret:', error);

      if (error instanceof Error && error.message === 'Secret not found') {
        return res.status(404).json({
          error: 'Secret not found',
        });
      }

      res.status(500).json({
        error: 'Failed to update secret',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
);

// Delete a secret
router.delete('/:configId/:key', async (req, res) => {
  try {
    const userId = req.user!.userId;
    const { configId, key } = req.params;

    const deleted = await keychainService.deleteSecret(userId, configId, key);

    if (!deleted) {
      return res.status(404).json({
        error: 'Secret not found',
      });
    }

    res.json({
      message: 'Secret deleted successfully',
    });
  } catch (error) {
    logger.error('Error deleting secret:', error);
    res.status(500).json({
      error: 'Failed to delete secret',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// List all secrets for a configuration
router.get('/config/:configId', async (req, res) => {
  try {
    const userId = req.user!.userId;
    const { configId } = req.params;

    const secrets = await keychainService.listConfigSecrets(userId, configId);

    res.json({
      configId,
      secrets,
      count: secrets.length,
    });
  } catch (error) {
    logger.error('Error listing config secrets:', error);
    res.status(500).json({
      error: 'Failed to list secrets',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// Check keychain availability
router.get('/status/availability', async (req, res) => {
  try {
    const available = await keychainService.isKeychainAvailable();

    res.json({
      available,
      message: available
        ? 'Keychain is available for secure credential storage'
        : 'Keychain is not available on this system',
    });
  } catch (error) {
    logger.error('Error checking keychain availability:', error);
    res.status(500).json({
      error: 'Failed to check keychain availability',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

export default router;