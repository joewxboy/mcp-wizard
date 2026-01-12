import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

export const config = {
  // Server configuration
  port: parseInt(process.env.PORT || '3001'),
  nodeEnv: process.env.NODE_ENV || 'development',
  corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:5173',

  // Database configuration
  databaseUrl:
    process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/mcp_wizard',

  // Redis configuration
  redisUrl: process.env.REDIS_URL || 'redis://localhost:6379',

  // JWT configuration
  jwtSecret: process.env.JWT_SECRET || 'dev-secret-change-in-production',
  jwtRefreshSecret: process.env.JWT_REFRESH_SECRET || 'dev-refresh-secret',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '15m',
  jwtRefreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',

  // GitHub API configuration
  githubToken: process.env.GITHUB_TOKEN,

  // Logging configuration
  logLevel: process.env.LOG_LEVEL || 'info',

  // File paths
  configOutputDir: process.env.CONFIG_OUTPUT_DIR || './configs',
  backupDir: process.env.BACKUP_DIR || './backups',
} as const;

// Validate required configuration
if (!config.jwtSecret || config.jwtSecret === 'dev-secret-change-in-production') {
  if (config.nodeEnv === 'production') {
    throw new Error('JWT_SECRET must be set in production');
  }
  console.warn('⚠️  Using default JWT secret. Set JWT_SECRET environment variable.');
}

if (!config.githubToken) {
  console.warn('⚠️  GITHUB_TOKEN not set. Research service will have rate limits.');
}
