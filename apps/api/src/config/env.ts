import { parseApiEnv, type ApiEnv } from '@project-braids/shared-types/env';

let cachedEnv: ApiEnv | undefined;

export function getEnv(): ApiEnv {
  if (!cachedEnv) {
    cachedEnv = parseApiEnv(process.env);
  }
  return cachedEnv;
}

export function resetEnvCache(): void {
  cachedEnv = undefined;
}
