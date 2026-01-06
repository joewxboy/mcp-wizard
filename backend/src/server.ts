import { server } from './app';
import { config } from './config';
import { logger } from './utils/logger';
import { prisma } from './db/database';
import { connectRedis, disconnectRedis } from './config/redis';

const startServer = async () => {
  try {
    // Connect to database
    await prisma.$connect();
    logger.info('Connected to PostgreSQL database');

    // Connect to Redis
    await connectRedis();
    logger.info('Connected to Redis');

    server.listen(config.port, () => {
      logger.info(`Server running on port ${config.port}`);
      logger.info(`Environment: ${config.nodeEnv}`);
      logger.info(`Health check: http://localhost:${config.port}/api/health`);
    });

    // Graceful shutdown
    const gracefulShutdown = async () => {
      logger.info('Shutting down gracefully...');

      server.close(async () => {
        try {
          // Disconnect from database
          await prisma.$disconnect();
          logger.info('Disconnected from database');

          // Disconnect from Redis
          await disconnectRedis();
          logger.info('Disconnected from Redis');

          logger.info('Process terminated');
          process.exit(0);
        } catch (error) {
          logger.error('Error during shutdown:', error);
          process.exit(1);
        }
      });
    };

    process.on('SIGTERM', gracefulShutdown);
    process.on('SIGINT', gracefulShutdown);

  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
};

startServer();