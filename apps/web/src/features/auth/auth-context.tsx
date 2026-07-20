'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  AuthSessionResponse,
  AuthUser,
  BusinessStaffPermissions,
  OtpPurpose,
} from '@project-braids/shared-types/api';
import { ApiClientError, apiFetchData, refreshAccessToken } from '@/shared/lib/api-client';
import {
  clearAccessToken,
  clearPendingOtp,
  getAccessToken,
  setAccessToken,
  setPendingOtp,
} from '@/shared/lib/auth-storage';

type AuthMe = {
  user: AuthUser;
  stylistId: string | null;
  businessId: string | null;
  permissions: BusinessStaffPermissions | null;
};

type RegisterResponse = {
  userId?: string;
  otpRequired: true;
  otpPurpose: OtpPurpose;
};

type OtpVerifyResponse = AuthSessionResponse | { verified: true };

type AuthContextValue = {
  user: AuthUser | null;
  stylistId: string | null;
  businessId: string | null;
  permissions: BusinessStaffPermissions | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  isStylist: boolean;
  isClient: boolean;
  login: (input: { email: string; password: string }) => Promise<AuthUser>;
  registerStylist: (input: {
    phoneNumber: string;
    email: string;
    password: string;
  }) => Promise<void>;
  registerClient: (input: { phoneNumber: string }) => Promise<void>;
  verifyOtp: (input: {
    phoneNumber: string;
    code: string;
    purpose: OtpPurpose;
  }) => Promise<AuthUser>;
  logout: () => Promise<void>;
  refreshMe: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

const AUTH_ME_KEY = ['auth', 'me'] as const;

async function fetchMe(): Promise<AuthMe> {
  try {
    return await apiFetchData<AuthMe>('/auth/me');
  } catch (error) {
    if (error instanceof ApiClientError && error.status === 401) {
      const token = await refreshAccessToken();
      if (token) {
        return apiFetchData<AuthMe>('/auth/me');
      }
    }
    throw error;
  }
}

function isSessionResponse(value: OtpVerifyResponse): value is AuthSessionResponse {
  return 'tokens' in value && Boolean(value.tokens?.accessToken);
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient();
  const [bootstrapped, setBootstrapped] = useState(false);
  const [hasToken, setHasToken] = useState(false);
  /** Login/OTP response user — does not wait on /auth/me. */
  const [sessionUser, setSessionUser] = useState<AuthUser | null>(null);

  useEffect(() => {
    setBootstrapped(true);
    setHasToken(Boolean(getAccessToken()));
  }, []);

  const meQuery = useQuery({
    queryKey: AUTH_ME_KEY,
    queryFn: fetchMe,
    enabled: bootstrapped && hasToken,
    retry: false,
    // Avoid QueryClient default retry:1 delaying login/dashboard forever.
    staleTime: 30_000,
  });

  // Mirror /auth/me into sessionUser when cold-loading from a stored token.
  useEffect(() => {
    if (meQuery.data?.user) {
      setSessionUser(meQuery.data.user);
    }
  }, [meQuery.data?.user]);

  // Only clear session on auth failure (401), not on transient network/DB errors.
  useEffect(() => {
    if (!bootstrapped || !hasToken) return;
    if (!meQuery.isError) return;
    const err = meQuery.error;
    const isUnauthorized = err instanceof ApiClientError && err.status === 401;
    if (!isUnauthorized) return;
    clearAccessToken();
    setHasToken(false);
    setSessionUser(null);
    queryClient.setQueryData(AUTH_ME_KEY, null);
  }, [bootstrapped, hasToken, meQuery.isError, meQuery.error, queryClient]);

  const applySession = useCallback(
    (session: AuthSessionResponse) => {
      setAccessToken(session.tokens.accessToken);
      setSessionUser(session.user);
      queryClient.setQueryData<AuthMe>(AUTH_ME_KEY, {
        user: session.user,
        stylistId: null,
        businessId: null,
        permissions: null,
      });
      setHasToken(true);
    },
    [queryClient],
  );

  const refreshMe = useCallback(async () => {
    setHasToken(Boolean(getAccessToken()));
    await queryClient.invalidateQueries({ queryKey: AUTH_ME_KEY });
  }, [queryClient]);

  const login = useCallback(
    async (input: { email: string; password: string }) => {
      // Drop any half-dead session first so RequireAuth /auth/me cannot race login.
      clearAccessToken();
      setHasToken(false);
      setSessionUser(null);
      queryClient.setQueryData(AUTH_ME_KEY, null);

      const session = await apiFetchData<AuthSessionResponse>('/auth/login', {
        auth: false,
        method: 'POST',
        json: input,
      });
      applySession(session);
      // Enrich stylistId/permissions in the background — never block navigation.
      void queryClient
        .fetchQuery({
          queryKey: AUTH_ME_KEY,
          queryFn: fetchMe,
          staleTime: 0,
        })
        .catch(() => {
          /* session user is enough to enter the app */
        });
      return session.user;
    },
    [applySession, queryClient],
  );

  const registerStylist = useCallback(
    async (input: { phoneNumber: string; email: string; password: string }) => {
      const result = await apiFetchData<RegisterResponse>('/auth/register/stylist', {
        auth: false,
        method: 'POST',
        json: input,
      });
      setPendingOtp({
        phoneNumber: input.phoneNumber,
        purpose: result.otpPurpose,
        role: 'stylist',
      });
    },
    [],
  );

  const registerClient = useCallback(async (input: { phoneNumber: string }) => {
    const result = await apiFetchData<RegisterResponse>('/auth/register/client', {
      auth: false,
      method: 'POST',
      json: input,
    });
    setPendingOtp({
      phoneNumber: input.phoneNumber,
      purpose: result.otpPurpose,
      role: 'client',
    });
  }, []);

  const verifyOtp = useCallback(
    async (input: { phoneNumber: string; code: string; purpose: OtpPurpose }) => {
      const result = await apiFetchData<OtpVerifyResponse>('/auth/otp/verify', {
        auth: false,
        method: 'POST',
        json: input,
      });

      if (!isSessionResponse(result)) {
        throw new ApiClientError('Verification did not return a session', 500);
      }

      applySession(result);
      clearPendingOtp();

      try {
        const me = await queryClient.fetchQuery({
          queryKey: AUTH_ME_KEY,
          queryFn: fetchMe,
          staleTime: 0,
        });
        return me.user;
      } catch (error) {
        if (error instanceof ApiClientError && error.status === 401) {
          clearAccessToken();
          setHasToken(false);
          setSessionUser(null);
          queryClient.setQueryData(AUTH_ME_KEY, null);
          throw error;
        }
        // Network/DB blip — still admit with OTP session user.
        return result.user;
      }
    },
    [applySession, queryClient],
  );

  const logout = useCallback(async () => {
    try {
      await apiFetchData('/auth/logout', { method: 'POST', json: {} });
    } finally {
      clearAccessToken();
      clearPendingOtp();
      setHasToken(false);
      setSessionUser(null);
      queryClient.setQueryData(AUTH_ME_KEY, null);
    }
  }, [queryClient]);

  const value = useMemo<AuthContextValue>(() => {
    const user = sessionUser ?? meQuery.data?.user ?? null;
    const stylistId = meQuery.data?.stylistId ?? null;
    const businessId = meQuery.data?.businessId ?? null;
    const permissions = meQuery.data?.permissions ?? null;

    // Only block the UI before we know if a stored token can resolve a user.
    // Once we have sessionUser (from login/OTP) or /auth/me data, never spin forever.
    const waitingForStoredSession =
      hasToken && !user && !meQuery.isError && (meQuery.isPending || !meQuery.isFetched);

    return {
      user,
      stylistId,
      businessId,
      permissions,
      isLoading: !bootstrapped || waitingForStoredSession,
      isAuthenticated: Boolean(user),
      isStylist: user?.role === 'stylist_owner' || user?.role === 'stylist_staff',
      isClient: user?.role === 'client',
      login,
      registerStylist,
      registerClient,
      verifyOtp,
      logout,
      refreshMe,
    };
  }, [
    bootstrapped,
    hasToken,
    login,
    logout,
    meQuery.data,
    meQuery.isError,
    meQuery.isPending,
    meQuery.isFetched,
    refreshMe,
    registerClient,
    registerStylist,
    sessionUser,
    verifyOtp,
  ]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

export function getPostAuthPath(user: AuthUser): '/stylist' | '/client' {
  return user.role === 'client' ? '/client' : '/stylist';
}
