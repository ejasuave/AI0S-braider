import type { ApiEnv } from '@project-braids/shared-types/env';

const DEV_LAN_ORIGIN = /^http:\/\/192\.168\.\d{1,3}\.\d{1,3}:3000$/;

function devAllowedOrigins(env: ApiEnv): Set<string> {
  return new Set(
    [env.CORS_ORIGIN, env.WEB_APP_URL, 'http://localhost:3000', 'http://127.0.0.1:3000'].filter(
      Boolean,
    ),
  );
}

export function resolveCorsOrigin(env: ApiEnv) {
  if (env.NODE_ENV === 'production' || env.NODE_ENV === 'staging') {
    return env.CORS_ORIGIN;
  }

  const allowed = devAllowedOrigins(env);

  return (
    origin: string | undefined,
    callback: (err: Error | null, allow: boolean | string) => void,
  ) => {
    if (!origin) {
      callback(null, env.CORS_ORIGIN);
      return;
    }

    if (allowed.has(origin) || DEV_LAN_ORIGIN.test(origin)) {
      callback(null, origin);
      return;
    }

    callback(null, false);
  };
}
