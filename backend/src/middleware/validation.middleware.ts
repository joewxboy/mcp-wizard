import { Request, Response, NextFunction } from 'express';
import { body, param, query, validationResult } from 'express-validator';

// Middleware to handle validation errors
export const handleValidationErrors = (
  req: Request,
  res: Response,
  next: NextFunction
): Response | void => {
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      error: {
        message: 'Validation failed',
        type: 'ValidationError',
        details: errors.array(),
      },
    });
  }

  next();
};

// Common validation rules
export const validators = {
  // User validation
  email: body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Must be a valid email address'),

  password: body('password')
    .isLength({ min: 8 })
    .withMessage('Password must be at least 8 characters long'),

  username: body('username')
    .isLength({ min: 3, max: 50 })
    .matches(/^[a-zA-Z0-9_-]+$/)
    .withMessage('Username must be 3-50 characters and contain only letters, numbers, underscores, and hyphens'),

  // ID validation
  id: param('id')
    .isString()
    .notEmpty()
    .withMessage('ID is required'),

  // Pagination
  page: query('page')
    .optional()
    .isInt({ min: 1 })
    .toInt()
    .withMessage('Page must be a positive integer'),

  limit: query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .toInt()
    .withMessage('Limit must be between 1 and 100'),

  // Search
  search: query('search')
    .optional()
    .isLength({ min: 1, max: 100 })
    .withMessage('Search query must be between 1 and 100 characters'),

  // Server validation
  serverName: body('name')
    .isLength({ min: 1, max: 100 })
    .trim()
    .withMessage('Server name must be between 1 and 100 characters'),

  serverDescription: body('description')
    .isLength({ min: 1, max: 1000 })
    .trim()
    .withMessage('Server description must be between 1 and 1000 characters'),

  sourceUrl: body('sourceUrl')
    .isURL()
    .withMessage('Source URL must be a valid URL'),

  // Config validation
  configName: body('name')
    .isLength({ min: 1, max: 100 })
    .trim()
    .withMessage('Configuration name must be between 1 and 100 characters'),

  command: body('command')
    .isLength({ min: 1, max: 500 })
    .trim()
    .withMessage('Command must be between 1 and 500 characters'),

  targetClient: body('targetClient')
    .isIn(['claude-desktop', 'custom'])
    .withMessage('Target client must be either "claude-desktop" or "custom"'),
};