const POST_AUTH_NEXT_KEY = 'pb_post_auth_next';

export function isSafeNextPath(next: string): boolean {
  return next.startsWith('/') && !next.startsWith('//');
}

export function setPostAuthNext(next: string): void {
  if (typeof window === 'undefined' || !isSafeNextPath(next)) return;
  sessionStorage.setItem(POST_AUTH_NEXT_KEY, next);
}

export function getPostAuthNext(): string | null {
  if (typeof window === 'undefined') return null;
  const next = sessionStorage.getItem(POST_AUTH_NEXT_KEY);
  if (!next || !isSafeNextPath(next)) return null;
  return next;
}

export function clearPostAuthNext(): void {
  sessionStorage.removeItem(POST_AUTH_NEXT_KEY);
}

export function resolvePostAuthRedirect(
  role: 'client' | 'stylist',
  next?: string | null,
): '/client' | '/stylist' | string {
  if (role === 'client') {
    const stored = next ?? getPostAuthNext();
    if (stored && isSafeNextPath(stored)) {
      return stored;
    }
  }
  return role === 'client' ? '/client' : '/stylist';
}
