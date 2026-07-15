import type { ApiEnv } from '@project-braids/shared-types/env';

const DEV_LAN_ORIGIN = /^http:\/\/192\.168\.\d{1,3}\.\d{1,3}:3000$/;

function allowedOrigins(env: ApiEnv): Set<string> {
  return new Set(
    [env.CORS_ORIGIN, env.WEB_APP_URL, 'http://localhost:3000', 'http://127.0.0.1:3000'].filter(
      (value): value is string => Boolean(value),
    ),
  );
}

/**
 * Credentialed fetches require Access-Control-Allow-Origin to echo the request
 * Origin exactly. A static string breaks every host that isn't that exact URL
 * (Vercel aliases, localhost hitting staging, etc.) — the browser blocks the
 * response and the UI can look "stuck" on Signing in…
 */
export function resolveCorsOrigin(env: ApiEnv) {
  const allowed = allowedOrigins(env);

  return (
    origin: string | undefined,
    callback: (err: Error | null, allow: boolean | string) => void,
  ) => {
    if (!origin) {
      // Non-browser clients (curl, health checks) — allow without reflecting.
      callback(null, true);
      return;
    }

    if (allowed.has(origin) || DEV_LAN_ORIGIN.test(origin)) {
      callback(null, origin);
      return;
    }

    callback(null, false);
  };
}
