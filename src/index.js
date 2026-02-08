const express = require('express');

if (process.env.NODE_ENV !== 'production') {
  require('dotenv').config();
}

const crypto = require('crypto');
const os = require('os');

const { db } = require('./db');
const { redis } = require('./redis');
const { checkRateLimit } = require('./rateLimit');
const { generateReply } = require('./llm');

const app = express();

// Limit JSON body size to avoid huge payloads
app.use(express.json({ limit: '1mb' }));

// Health check for ALB/ECS (fast, no dependencies)
app.get('/health', (req, res) => {
  res.json({ ok: true });
});

// Identify which instance handled the request (useful for ALB/ASG demo)
app.get('/whoami', (req, res) => {
  res.json({
    hostname: os.hostname(),
    pid: process.pid,
  });
});

// Diagnostic endpoints only in non-production
if (process.env.NODE_ENV !== 'production') {
  app.get('/db', async (req, res) => {
    try {
      const result = await db.query('SELECT now() AS now');
      res.json({ ok: true, now: result.rows[0].now });
    } catch (err) {
      res.status(500).json({ ok: false, error: err.message });
    }
  });

  app.get('/redis', async (req, res) => {
    try {
      await redis.set('ping', 'pong', 'EX', 10);
      const value = await redis.get('ping');
      res.json({ ok: true, value });
    } catch (err) {
      res.status(500).json({ ok: false, error: err.message });
    }
  });
}

// Main endpoint
app.post('/v1/chat', async (req, res) => {
  try {
    const user_id = String(req.body.user_id || '').trim();
    const tier = String(req.body.tier || 'free').trim();
    const prompt = String(req.body.prompt || '').trim();

    if (!user_id) return res.status(400).json({ ok: false, error: 'user_id required' });
    if (!prompt) return res.status(400).json({ ok: false, error: 'prompt required' });
    if (!['free', 'pro'].includes(tier)) {
      return res.status(400).json({ ok: false, error: 'tier must be free|pro' });
    }

    const rl = await checkRateLimit({ userId: user_id, tier });
    if (!rl.allowed) {
      return res.status(429).json({
        ok: false,
        error: 'rate_limited',
        limit: rl.limit,
        count: rl.count,
        reset_seconds: rl.reset_seconds,
      });
    }

    let reply;
    try {
      reply = await generateReply(prompt);
    } catch (err) {
      console.error('LLM error:', err.message);
      return res.status(503).json({ ok: false, error: 'llm_unavailable' });
    }

    const id = crypto.randomUUID();

    // Best-effort persistence: do not fail the API if DB is unavailable.
    try {
      await db.query(
        'INSERT INTO requests (id, user_id, tier, prompt, response) VALUES ($1,$2,$3,$4,$5)',
        [id, user_id, tier, prompt, reply]
      );
    } catch (err) {
      console.error('db write failed:', err.message);
    }

    res.json({ ok: true, id, reply });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

const PORT = process.env.PORT || 3000;

const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`listening on :${PORT}`);
});

// Graceful shutdown for ECS/ALB deployments
const shutdown = (signal) => {
  console.log(`received ${signal}, shutting down gracefully`);

  server.close(() => {
    console.log('http server closed');
    process.exit(0);
  });

  setTimeout(() => {
    console.error('forced shutdown');
    process.exit(1);
  }, 10000);
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
