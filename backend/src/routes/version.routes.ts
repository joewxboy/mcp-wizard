import express from 'express';
import { versionService } from '../services/VersionService';
import { authenticate } from '../middleware/auth.middleware';
import { validators, handleValidationErrors } from '../middleware/validation.middleware';
import { logger } from '../utils/logger';

const router = express.Router();

// Apply authentication to all routes
router.use(authenticate);

// Get all versions for a configuration
router.get('/:id/versions',
  validators.id,
  handleValidationErrors,
  async (req, res) => {
    try {
      const userId = req.user!.userId;
      const { id } = req.params;

      const versions = await versionService.getConfigVersions(id, userId);

      res.json({
        configId: id,
        versions,
        count: versions.length,
      });
    } catch (error) {
      logger.error('Error getting config versions:', error);

      if (error instanceof Error && error.message.includes('not found')) {
        return res.status(404).json({
          error: 'Configuration not found',
          message: error.message,
        });
      }

      res.status(500).json({
        error: 'Failed to retrieve versions',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
);

// Get a specific version
router.get('/:id/versions/:version',
  validators.id,
  async (req, res) => {
    try {
      const userId = req.user!.userId;
      const { id, version } = req.params;
      const versionNum = parseInt(version, 10);

      if (isNaN(versionNum)) {
        return res.status(400).json({
          error: 'Invalid version number',
        });
      }

      const versionInfo = await versionService.getConfigVersion(id, versionNum, userId);

      if (!versionInfo) {
        return res.status(404).json({
          error: 'Version not found',
        });
      }

      res.json({
        configId: id,
        version: versionInfo,
      });
    } catch (error) {
      logger.error('Error getting config version:', error);

      if (error instanceof Error && error.message.includes('not found')) {
        return res.status(404).json({
          error: 'Configuration not found',
          message: error.message,
        });
      }

      res.status(500).json({
        error: 'Failed to retrieve version',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
);

// Rollback configuration to a specific version
router.post('/:id/rollback/:version',
  validators.id,
  express.json(),
  async (req, res) => {
    try {
      const userId = req.user!.userId;
      const { id, version } = req.params;
      const versionNum = parseInt(version, 10);
      const { reason } = req.body;

      if (isNaN(versionNum)) {
        return res.status(400).json({
          error: 'Invalid version number',
        });
      }

      const rollbackResult = await versionService.rollbackConfig(id, versionNum, userId, reason);

      res.json({
        rollback: rollbackResult,
        message: `Configuration rolled back to version ${versionNum}`,
      });
    } catch (error) {
      logger.error('Error rolling back configuration:', error);

      if (error instanceof Error && error.message.includes('not found')) {
        return res.status(404).json({
          error: 'Configuration or version not found',
          message: error.message,
        });
      }

      res.status(500).json({
        error: 'Failed to rollback configuration',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
);

// Compare two versions
router.get('/:id/compare/:v1/:v2',
  validators.id,
  async (req, res) => {
    try {
      const userId = req.user!.userId;
      const { id, v1, v2 } = req.params;
      const version1 = parseInt(v1, 10);
      const version2 = parseInt(v2, 10);

      if (isNaN(version1) || isNaN(version2)) {
        return res.status(400).json({
          error: 'Invalid version numbers',
        });
      }

      const comparison = await versionService.compareVersions(id, version1, version2, userId);

      res.json({
        comparison,
        message: comparison.hasDifferences
          ? 'Versions have differences'
          : 'Versions are identical',
      });
    } catch (error) {
      logger.error('Error comparing versions:', error);

      if (error instanceof Error && error.message.includes('not found')) {
        return res.status(404).json({
          error: 'Configuration not found',
          message: error.message,
        });
      }

      res.status(500).json({
        error: 'Failed to compare versions',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
);

export default router;