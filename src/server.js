import Fastify from 'fastify';
import { config } from './config.js';
import { loadAllData } from './data/loader.js';
import { connectRedis, closeRedis } from './data/redis.js';
import { riskRoutes } from './routes/risk.js';
import { feedbackRoutes } from './routes/feedback.js';
import cron from 'node-cron';
import { exec } from 'child_process';
import util from 'util';

const execPromise = util.promisify(exec);

const fastify = Fastify({
  logger: process.env.NODE_ENV === 'production' ? true : {
    level: 'info',
    transport: {
      target: 'pino-pretty',
      options: { translateTime: 'HH:MM:ss', ignore: 'pid,hostname' },
    },
  },
  trustProxy: true,
});

// ── Health check ──
fastify.get('/health', async () => ({
  status: 'ok',
  uptime: process.uptime(),
  version: config.version,
}));

// ── Ping check ──
fastify.get('/ping', async () => 'pong\n');

// ── Root ──
fastify.get('/', async () => ({
  name: 'Privi Anti-Fraud API',
  version: config.version,
  docs: 'GET /v1/risk?ip=1.2.3.4&email=user@example.com',
}));

// ── Register routes ──
fastify.register(riskRoutes);
fastify.register(feedbackRoutes);

// ── RapidAPI Gateway Authentication ──
if (config.rapidapi.proxySecret) {
  fastify.addHook('preHandler', async (request, reply) => {
    // Allow health checks, root docs, and ping to pass without auth
    if (request.url === '/health' || request.url === '/ping' || request.url === '/') return;

    const proxySecret = request.headers['x-rapidapi-proxy-secret'];
    if (proxySecret !== config.rapidapi.proxySecret) {
      return reply.status(401).send({
        error: 'Unauthorized',
        message: 'Direct API access is not allowed. Please use the RapidAPI gateway.',
      });
    }
  });
}

// ── Global error handler ──
fastify.setErrorHandler((error, request, reply) => {
  fastify.log.error(error);

  if (error.validation) {
    return reply.status(400).send({
      error: 'Validation Error',
      message: error.message,
    });
  }

  return reply.status(500).send({
    error: 'Internal Server Error',
    message: 'An unexpected error occurred',
  });
});

// ── Startup ──
async function start() {
  try {
    // Load all in-memory data (JSON snapshots + MaxMind DBs)
    await loadAllData();

    // Connect to Redis (for WHOIS/MX caching + feedback storage)
    try {
      await connectRedis();
    } catch (err) {
      console.warn('[Server] Redis connection failed — caching disabled:', err.message);
      console.warn('[Server] The API will still work but WHOIS/MX lookups won\'t be cached');
    }

    // Start listening
    await fastify.listen({ port: config.port, host: config.host });
    console.log(`\n🛡️  Privi Anti-Fraud API v${config.version}`);
    console.log(`   Listening on http://${config.host}:${config.port}`);
    console.log(`   Try: curl "http://localhost:${config.port}/v1/risk?ip=1.1.1.1&email=test@mailinator.com"\n`);

    // ── Auto Updates (Cron) ──
    cron.schedule('0 0 * * *', async () => {
      fastify.log.info('[AutoUpdate] Starting daily threat data refresh...');
      try {
        await execPromise('node scripts/refresh-all.js', { timeout: 300000 });
        fastify.log.info('[AutoUpdate] Data refreshed on disk. Hot-loading into memory...');
        await loadAllData(true);
        fastify.log.info('[AutoUpdate] Global memory hot-load complete.');
      } catch (err) {
        fastify.log.error(`[AutoUpdate] Failed during auto-refresh: ${err.message}`);
      }
    });

  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
}

// ── Graceful shutdown ──
async function shutdown(signal) {
  console.log(`\n[Server] ${signal} received — shutting down...`);
  await fastify.close();
  await closeRedis();
  process.exit(0);
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

start();
