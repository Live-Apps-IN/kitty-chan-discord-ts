import { Redis } from 'ioredis';

const client = new Redis({
  host: process.env.REDIS_HOST,
  port: 6379,
  password: process.env.REDIS_PASS,
  db: 1,
  retryStrategy: () => {
    return null;
  },
});

client.on('connect', () => {
  console.log('Redis connection established.');
});

client.on('error', (err) => {
  console.log('Error connecting to Redis: ' + err);
});

export default client;
