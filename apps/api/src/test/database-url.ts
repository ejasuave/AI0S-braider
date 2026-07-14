const DEFAULT_TEST_DATABASE_URL = 'postgresql://braids:braids@localhost:5432/braids_test';

function stripPgBouncer(url: string): string {
  return url
    .replace(/([?&])pgbouncer=true&?/g, '$1')
    .replace(/[?&]$/, '')
    .replace(/\?$/, '');
}

function appendQueryParam(url: string, key: string, value: string): string {
  const separator = url.includes('?') ? '&' : '?';
  return `${url}${separator}${key}=${value}`;
}

/** Integration tests always target an isolated DB; never run against braids_dev. */
function useTestDatabaseName(url: string): string {
  try {
    const parsed = new URL(url.replace(/^postgresql:/, 'http:'));
    if (parsed.pathname.endsWith('/braids_dev') || parsed.pathname.endsWith('/template1')) {
      parsed.pathname = parsed.pathname.replace(/\/[^/]+$/, '/braids_test');
    }
    return stripPgBouncer(parsed.toString().replace(/^http:/, 'postgresql:'));
  } catch {
    return stripPgBouncer(url);
  }
}

/** Prisma Dev pools connections — Prisma must disable prepared statements (`pgbouncer=true`). */
function withPrismaDevCompat(url: string): string {
  if (!/:5121\d/.test(url)) {
    return url;
  }
  if (url.includes('pgbouncer=true')) {
    return url;
  }
  let next = appendQueryParam(url, 'pgbouncer', 'true');
  if (!next.includes('connection_limit=')) {
    next = appendQueryParam(next, 'connection_limit', '1');
  }
  return next;
}

export function resolveTestDatabaseUrl(): string {
  const raw =
    process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL ?? DEFAULT_TEST_DATABASE_URL;
  return withPrismaDevCompat(useTestDatabaseName(raw));
}
