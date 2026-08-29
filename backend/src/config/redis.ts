import Redis from 'ioredis';

const redisUrl = process.env.REDIS_URL;

export const redisConfig = {
  maxRetriesPerRequest: null,
};

export const getRedisConnection = () => {
  if (redisUrl) {
    return new Redis(redisUrl, redisConfig);
  }

  return new Redis({
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
    ...redisConfig,
  });
};

export const redisConnection = getRedisConnection();

redisConnection.on('connect', () => {
  console.log('Successfully connected to Redis.');
});

redisConnection.on('error', (err) => {
  console.error('Redis connection error:', err);
});