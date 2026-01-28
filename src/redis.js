
const Redis = require('ioredis');
require('dotenv').config();

if (!process.env.REDIS_URL) {
  throw new Error('REDIS_URL is missing in .env');
}

const redis = new Redis(process.env.REDIS_URL);

redis.on('connect', () => {
  console.log('redis connected');
});

redis.on('error', (err) => {
  console.error('redis error', err);
});

module.exports = { redis };
