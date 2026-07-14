import { Redis, type RedisOptions } from 'ioredis';
import { getEnv } from '../config/env.js';

let redis: Redis | undefined;

export function getRedisConnectionOptions(): RedisOptions {
  const env = getEnv();
  const url = new URL(env.REDIS_URL);
  const useTls = url.protocol === 'rediss:';

  return {
    host: url.hostname,
    port: Number(url.port || 6379),
    password: url.password || undefined,
    username: url.username || undefined,
    ...(useTls ? { tls: {} } : {}),
    // BullMQ requires maxRetriesPerRequest: null on the shared connection.
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
    lazyConnect: true,
    enableOfflineQueue: false,
    connectTimeout: 5_000,
    commandTimeout: 5_000,
    retryStrategy: () => null,
  };
}

export function getRedis(): Redis {
  if (!redis) {
    redis = new Redis(getRedisConnectionOptions());
  }
  return redis;
}

export async function closeRedis(): Promise<void> {
  if (redis) {
    await redis.quit();
    redis = undefined;
  }
}
