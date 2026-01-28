
const { redis } = require('./redis');

const LIMITS = {
  free: 5,   // requests per minute
  pro: 60,
};

async function checkRateLimit({ userId, tier }) {
  const limit = LIMITS[tier] || LIMITS.free;

  // per-minute bucket key
  const bucket = Math.floor(Date.now() / 60000);
  const key = `rl:${tier}:${userId}:${bucket}`;

  const count = await redis.incr(key);
  if (count === 1) {
    await redis.expire(key, 60);
  }

  return {
    allowed: count <= limit,
    limit,
    count,
    reset_seconds: 60,
  };
}

module.exports = { checkRateLimit };
