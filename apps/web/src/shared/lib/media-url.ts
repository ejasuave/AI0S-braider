/** Resolve relative storage URLs against the API origin. */
export function resolveMediaUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  const apiBase = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';
  return `${apiBase}${url.startsWith('/') ? url : `/${url}`}`;
}
