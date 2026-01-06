import { createClient } from 'redis';
import { config } from '../config';
import { logger } from '../utils/logger';

let redisClient: ReturnType<typeof createClient>;

export const getRedisClient = () => {
  if (!redisClient) {
    redisClient = createClient({
      url: config.redisUrl,
    });

    redisClient.on('error', (err) => {
      logger.error('Redis Client Error:', err);
    });

    redisClient.on('connect', () => {
      logger.info('Connected to Redis');
    });

    redisClient.on('ready', () => {
      logger.info('Redis client ready');
    });

    redisClient.on('end', () => {
      logger.info('Redis connection ended');
    });
  }

  return redisClient;
};

export const connectRedis = async () => {
  const client = getRedisClient();
  if (!client.isOpen) {
    await client.connect();
  }
  return client;
};

export const disconnectRedis = async () => {
  const client = getRedisClient();
  if (client.isOpen) {
    await client.disconnect();
  }
};

// Cache helper functions
export const setCache = async (key: string, value: any, ttl?: number) => {
  const client = getRedisClient();
  const serializedValue = JSON.stringify(value);

  if (ttl) {
    await client.setEx(key, ttl, serializedValue);
  } else {
    await client.set(key, serializedValue);
  }
};

export const getCache = async <T>(key: string): Promise<T | null> => {
  const client = getRedisClient();
  const value = await client.get(key);

  if (value) {
    return JSON.parse(value);
  }

  return null;
};

export const deleteCache = async (key: string) => {
  const client = getRedisClient();
  await client.del(key);
};

export const clearCache = async (pattern: string) => {
  const client = getRedisClient();
  const keys = await client.keys(pattern);

  if (keys.length > 0) {
    await client.del(keys);
  }
};