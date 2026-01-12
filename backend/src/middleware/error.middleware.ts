import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';
import { ValidationError, NotFoundError, ConflictError } from '@mcp-wizard/shared';

// Custom error class for HTTP errors
export class HttpError extends Error {
  constructor(
    public statusCode: number,
    message: string,
    public isOperational = true,
  ) {
    super(message);
    this.name = 'HttpError';

    // Maintains proper stack trace for where our error was thrown
    Error.captureStackTrace(this, this.constructor);
  }
}

// Error response interface
interface ErrorResponse {
  success: false;
  error: {
    message: string;
    type: string;
    details?: unknown;
    stack?: string;
  };
}

// Error handler middleware
export const errorHandler = (
  error: Error,
  req: Request,
  res: Response,
  _next: NextFunction,
): Response<ErrorResponse> => {
  let statusCode = 500;
  let message = 'Internal server error';
  let type = 'InternalServerError';
  let details: unknown;

  // Log the error
  logger.error('Error occurred:', {
    error: error.message,
    stack: error.stack,
    url: req.url,
    method: req.method,
    ip: req.ip,
  });

  // Handle different error types
  if (error instanceof HttpError) {
    statusCode = error.statusCode;
    message = error.message;
    type = error.name;
  } else if (error instanceof ValidationError) {
    statusCode = 400;
    message = error.message;
    type = 'ValidationError';
    details = error.details;
  } else if (error instanceof NotFoundError) {
    statusCode = 404;
    message = error.message;
    type = 'NotFoundError';
  } else if (error instanceof ConflictError) {
    statusCode = 409;
    message = error.message;
    type = 'ConflictError';
  } else if (error.name === 'ValidationError') {
    // Prisma validation error
    statusCode = 400;
    message = 'Validation failed';
    type = 'ValidationError';
    details = error.message;
  } else if (error.name === 'JsonWebTokenError') {
    statusCode = 401;
    message = 'Invalid token';
    type = 'AuthenticationError';
  } else if (error.name === 'TokenExpiredError') {
    statusCode = 401;
    message = 'Token expired';
    type = 'AuthenticationError';
  }

  // Don't leak error details in production
  const isDevelopment = process.env.NODE_ENV === 'development';
  const stack = isDevelopment ? error.stack : undefined;

  return res.status(statusCode).json({
    success: false,
    error: {
      message,
      type,
      details,
      ...(stack && { stack }),
    },
  });
};

// 404 handler middleware
export const notFoundHandler = (
  req: Request,
  res: Response,
  _next: NextFunction,
): Response<ErrorResponse> => {
  return res.status(404).json({
    success: false,
    error: {
      message: `Route ${req.method} ${req.path} not found`,
      type: 'NotFoundError',
    },
  });
};
