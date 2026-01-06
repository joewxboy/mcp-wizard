import { Request, Response, NextFunction } from 'express';
import { verifyAccessToken, JWTPayload } from '../config/jwt';
import { logger } from '../utils/logger';

// Extend Express Request interface to include user
declare global {
  namespace Express {
    interface Request {
      user?: JWTPayload;
    }
  }
}

// Authentication middleware
export const authenticate = (
  req: Request,
  res: Response,
  next: NextFunction
): Response | void => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        error: {
          message: 'Authorization token required',
          type: 'AuthenticationError',
        },
      });
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix
    const decoded = verifyAccessToken(token);

    // Attach user to request object
    req.user = decoded;

    next();
  } catch (error) {
    logger.warn('Authentication failed:', error);
    return res.status(401).json({
      success: false,
      error: {
        message: 'Invalid or expired token',
        type: 'AuthenticationError',
      },
    });
  }
};

// Optional authentication middleware (doesn't fail if no token)
export const optionalAuthenticate = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  try {
    const authHeader = req.headers.authorization;

    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      const decoded = verifyAccessToken(token);
      req.user = decoded;
    }
  } catch (error) {
    // Silently ignore auth errors for optional auth
    logger.debug('Optional authentication failed:', error);
  }

  next();
};

// Role-based authorization middleware
export const authorize = (...allowedRoles: string[]) => {
  return (req: Request, res: Response, next: NextFunction): Response | void => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: {
          message: 'Authentication required',
          type: 'AuthenticationError',
        },
      });
    }

    // For now, we don't have roles in our user model
    // This can be extended later when we add role-based access control
    // For example: if (!allowedRoles.includes(req.user.role)) { ... }

    next();
  };
};