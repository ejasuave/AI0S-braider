import { Redis, type RedisOptions } from 'ioredis';
import { getEnv } from '../config/env.js';

let redis: Redis | undefined;

export function getRedisConnectionOptions(): RedisOptions {
  const env = getEnv();
  const url = new URL(env.REDIS_URL);

  return {
    host: url.hostname,
    port: Number(url.port || 6379),
    password: url.password || undefined,
    username: url.username || undefined,
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
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
