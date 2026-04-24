import Redis from 'ioredis';
import { config } from '../config.js';

let client = null;

/**
 * Get or create a lazy Redis connection.
 * In serverless, this persists across warm invocations.
 * Connection is only established when first used.
 */
export function getRedis() {
  if (client && client.status === 'ready') return client;
  if (client && client.status === 'connecting') return client;

  client = new Redis(config.redis.url, {
    maxRetriesPerRequest: 3,
    retryStrategy(times) {
      if (times > 5) return null; // stop retrying
      return Math.min(times * 200, 2000);
    },
    lazyConnect: true,
    enableOfflineQueue: true,
    connectTimeout: 5000,
  });

  client.on('error', (err) => {
    console.error('[Redis] Connection error:', err.message);
  });

  client.on('connect', () => {
    console.log('[Redis] Connected');
  });

  return client;
}

/**
 * Ensure connection is established (call once at startup or first request).
 */
export async function connectRedis() {
  const redis = getRedis();
  if (redis.status === 'wait') {
    await redis.connect();
  }
  return redis;
}

/**
 * Gracefully close.
 */
export async function closeRedis() {
  if (client) {
    await client.quit();
    client = null;
  }
}

// ── Cache helpers ──

/**
 * Get a cached hash object. Returns null if not found.
 */
export async function cacheGetHash(key) {
  try {
    const redis = getRedis();
    const data = await redis.hgetall(key);
    if (!data || Object.keys(data).length === 0) return null;
    return data;
  } catch {
    return null;
  }
}

/**
 * Set a hash with TTL.
 */
export async function cacheSetHash(key, obj, ttlSeconds) {
  try {
    const redis = getRedis();
    const pipeline = redis.pipeline();
    pipeline.hset(key, obj);
    if (ttlSeconds) pipeline.expire(key, ttlSeconds);
    await pipeline.exec();
  } catch (err) {
    console.error('[Redis] cacheSetHash error:', err.message);
  }
}

/**
 * Append to a list (for feedback storage).
 */
export async function listPush(key, value) {
  try {
    const redis = getRedis();
    await redis.rpush(key, typeof value === 'string' ? value : JSON.stringify(value));
  } catch (err) {
    console.error('[Redis] listPush error:', err.message);
  }
}
