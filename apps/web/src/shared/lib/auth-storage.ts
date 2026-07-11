import type { OtpPurpose } from '@project-braids/shared-types/api';

const ACCESS_TOKEN_KEY = 'pb_access_token';

export function getAccessToken(): string | null {
  if (typeof window === 'undefined') return null;
  return sessionStorage.getItem(ACCESS_TOKEN_KEY);
}

export function setAccessToken(token: string): void {
  if (typeof window === 'undefined') return;
  sessionStorage.setItem(ACCESS_TOKEN_KEY, token);
}

export function clearAccessToken(): void {
  sessionStorage.removeItem(ACCESS_TOKEN_KEY);
}

export type PendingOtp = {
  phoneNumber: string;
  purpose: OtpPurpose;
  role: 'stylist' | 'client';
};

const PENDING_OTP_KEY = 'pb_pending_otp';

export function setPendingOtp(pending: PendingOtp): void {
  if (typeof window === 'undefined') return;
  sessionStorage.setItem(PENDING_OTP_KEY, JSON.stringify(pending));
}

export function getPendingOtp(): PendingOtp | null {
  const raw = sessionStorage.getItem(PENDING_OTP_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as PendingOtp;
  } catch {
    return null;
  }
}

export function clearPendingOtp(): void {
  sessionStorage.removeItem(PENDING_OTP_KEY);
}
