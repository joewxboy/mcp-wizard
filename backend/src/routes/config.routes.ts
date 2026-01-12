import express from 'express';
import { configurationService } from '../services/ConfigurationService';
import { ConfigConverters, ExportFormat } from '../services/ConfigConverters';
import { ConfigValidator, CreateConfigInput, UpdateConfigInput } from '../services/ConfigValidator';
import { validators, handleValidationErrors } from '../middleware/validation.middleware';
import { logger } from '../utils/logger';
import { prisma } from '../db/database';

const router = express.Router();

// Apply authentication to all routes
// TEMP: Skip authentication for testing - will be enabled once auth is implemented
// router.use(authenticate);

// Mock user for testing - create user in database if needed
const getMockUser = async () => {
  const userId = 'test-user-123';

  // Check if user exists
  let user = await prisma.user.findUnique({
    where: { id: userId },
  });

  // Create user if doesn't exist
  if (!user) {
    user = await prisma.user.create({
      data: {
        id: userId,
        email: 'test@example.com',
        username: 'testuser',
        password: 'hashed-password-placeholder', // In real auth, this would be hashed
      },
    });
  }

  return { userId: user.id, email: user.email, username: user.username };
};

// Get all user configurations
router.get('/', async (req, res) => {
  try {
    const mockUser = await getMockUser();
    const userId = mockUser.userId; // TEMP: Using mock user
    const configs = await configurationService.getUserConfigs(userId);

    res.json({
      configs,
      count: configs.length,
    });
  } catch (error) {
    logger.error('Error getting configurations:', error);
    res.status(500).json({
      error: 'Failed to retrieve configurations',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// Get specific configuration
router.get('/:id', validators.id, handleValidationErrors, async (req, res) => {
  try {
    const mockUser = await getMockUser();
    const userId = mockUser.userId;
    const { id } = req.params;

    const config = await configurationService.getConfigById(id, userId);

    if (!config) {
      return res.status(404).json({
        error: 'Configuration not found',
      });
    }

    res.json({ config });
  } catch (error) {
    logger.error('Error getting configuration:', error);
    res.status(500).json({
      error: 'Failed to retrieve configuration',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// Create new configuration
router.post('/', express.json(), async (req, res) => {
  try {
    const mockUser = await getMockUser();
    const userId = mockUser.userId; // TEMP: Using mock user

    // Validate input
    const validation = ConfigValidator.validateCreateConfig(req.body);
    if (!validation.success) {
      return res.status(400).json({
        error: 'Validation failed',
        details: validation.error.errors,
      });
    }

    const configData: CreateConfigInput = validation.data;

    // Additional validations
    const commandErrors = ConfigValidator.validateCommand(configData.command || 'node');
    const argsErrors = configData.args ? ConfigValidator.validateArguments(configData.args) : [];
    const envErrors = configData.env
      ? ConfigValidator.validateEnvironmentVariables(configData.env)
      : [];
    const secretErrors = configData.secrets
      ? ConfigValidator.validateSecrets(configData.secrets)
      : [];

    const allErrors = [...commandErrors, ...argsErrors, ...envErrors, ...secretErrors];
    if (allErrors.length > 0) {
      return res.status(400).json({
        error: 'Validation failed',
        details: allErrors,
      });
    }

    const config = await configurationService.createConfig(userId, configData);

    res.status(201).json({
      config,
      message: 'Configuration created successfully',
    });
  } catch (error) {
    logger.error('Error creating configuration:', error);

    if (error instanceof Error && error.message.includes('not found')) {
      return res.status(400).json({
        error: 'Invalid server ID',
        message: error.message,
      });
    }

    res.status(500).json({
      error: 'Failed to create configuration',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// Update configuration
router.put('/:id', validators.id, handleValidationErrors, express.json(), async (req, res) => {
  try {
    const mockUser = await getMockUser();
    const userId = mockUser.userId;
    const { id } = req.params;

    // Validate input
    const validation = ConfigValidator.validateUpdateConfig(req.body);
    if (!validation.success) {
      return res.status(400).json({
        error: 'Validation failed',
        details: validation.error.errors,
      });
    }

    const updateData: UpdateConfigInput = validation.data;

    // Additional validations if data is provided
    if (updateData.command) {
      const commandErrors = ConfigValidator.validateCommand(updateData.command);
      if (commandErrors.length > 0) {
        return res.status(400).json({
          error: 'Validation failed',
          details: commandErrors,
        });
      }
    }

    if (updateData.args) {
      const argsErrors = ConfigValidator.validateArguments(updateData.args);
      if (argsErrors.length > 0) {
        return res.status(400).json({
          error: 'Validation failed',
          details: argsErrors,
        });
      }
    }

    if (updateData.env) {
      const envErrors = ConfigValidator.validateEnvironmentVariables(updateData.env);
      if (envErrors.length > 0) {
        return res.status(400).json({
          error: 'Validation failed',
          details: envErrors,
        });
      }
    }

    if (updateData.secrets) {
      const secretErrors = ConfigValidator.validateSecrets(updateData.secrets);
      if (secretErrors.length > 0) {
        return res.status(400).json({
          error: 'Validation failed',
          details: secretErrors,
        });
      }
    }

    const config = await configurationService.updateConfig(id, userId, updateData);

    res.json({
      config,
      message: 'Configuration updated successfully',
    });
  } catch (error) {
    logger.error('Error updating configuration:', error);

    if (error instanceof Error && error.message.includes('not found')) {
      return res.status(404).json({
        error: 'Configuration not found',
        message: error.message,
      });
    }

    res.status(500).json({
      error: 'Failed to update configuration',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// Delete configuration
router.delete('/:id', validators.id, handleValidationErrors, async (req, res) => {
  try {
    const mockUser = await getMockUser();
    const userId = mockUser.userId;
    const { id } = req.params;

    await configurationService.deleteConfig(id, userId);

    res.json({
      message: 'Configuration deleted successfully',
    });
  } catch (error) {
    logger.error('Error deleting configuration:', error);

    if (error instanceof Error && error.message.includes('not found')) {
      return res.status(404).json({
        error: 'Configuration not found',
        message: error.message,
      });
    }

    res.status(500).json({
      error: 'Failed to delete configuration',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// Validate configuration
router.post('/:id/validate', validators.id, handleValidationErrors, async (req, res) => {
  try {
    const mockUser = await getMockUser();
    const userId = mockUser.userId;
    const { id } = req.params;

    const validation = await configurationService.validateConfig(id, userId);

    res.json({
      valid: validation.valid,
      errors: validation.errors,
      message: validation.valid ? 'Configuration is valid' : 'Configuration has errors',
    });
  } catch (error) {
    logger.error('Error validating configuration:', error);
    res.status(500).json({
      error: 'Validation failed',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// Export configuration
router.post(
  '/:id/export',
  validators.id,
  handleValidationErrors,
  express.json(),
  async (req, res) => {
    try {
      const mockUser = await getMockUser();
      const userId = mockUser.userId;
      const { id } = req.params;
      const { format = 'claude-desktop' as ExportFormat, template } = req.body;

      const config = await configurationService.getConfigById(id, userId);
      if (!config) {
        return res.status(404).json({
          error: 'Configuration not found',
        });
      }

      // Fetch the associated server
      const server = await prisma.mCPServer.findUnique({
        where: { id: config.serverId },
      });

      if (!server) {
        return res.status(404).json({
          error: 'Associated server not found',
        });
      }

      let exportResult;
      switch (format) {
        case 'claude-desktop':
          exportResult = ConfigConverters.toClaudeDesktop(config, server as any);
          break;
        case 'mcp-config':
          exportResult = ConfigConverters.toMCPConfig(config, server as any);
          break;
        case 'custom':
          exportResult = ConfigConverters.toCustomFormat(config, server as any, template);
          break;
        default:
          return res.status(400).json({
            error: 'Unsupported export format',
            supported: ConfigConverters.getSupportedFormats().map((f) => f.value),
          });
      }

      // Validate the export
      const validation = ConfigConverters.validateExport(exportResult);
      if (!validation.valid) {
        return res.status(500).json({
          error: 'Export validation failed',
          details: validation.errors,
        });
      }

      res.setHeader('Content-Type', exportResult.contentType);
      res.setHeader('Content-Disposition', `attachment; filename="${exportResult.filename}"`);

      res.send(exportResult.content);
    } catch (error) {
      logger.error('Error exporting configuration:', error);
      res.status(500).json({
        error: 'Export failed',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  },
);

// Get supported export formats
router.get('/export/formats', (req, res) => {
  res.json({
    formats: ConfigConverters.getSupportedFormats(),
  });
});

export default router;
