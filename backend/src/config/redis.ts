import Redis from 'ioredis';

export const redisConfig = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379', 10),
  maxRetriesPerRequest: null, // Required by BullMQ
};

export const getRedisConnection = () => {
  return new Redis(redisConfig);
};

export const redisConnection = getRedisConnection();

redisConnection.on('connect', () => {
  console.log('Successfully connected to Redis.');
});

redisConnection.on('error', (err) => {
  console.error('Redis connection error:', err);
});
